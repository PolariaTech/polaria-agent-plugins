#!/usr/bin/env node
// Hook de terminal del plugin trabajo-en-paralelo. Cierra los rodeos al límite de escritura que se hacen por la
// terminal del asistente. Solo actúa si el repo tiene un CLAIM.md ACTIVO, y rechaza:
//   1. Saltarse los hooks de git: --no-verify, commit -n o cambiar core.hooksPath.
//   2. Escribir, mover o borrar el CLAIM.md por la terminal (solo paralelo.js reclamar / autorizar / liberar).
//   3. Escribir la caché del plugin (<git>/polaria-paralelo) o el hook pre-commit.
// Es un límite de mejor esfuerzo: reconoce las formas habituales de escribir, no todas las posibles. La red de
// seguridad real es el pre-commit, que rechaza cualquier commit con archivos fuera del CLAIM.md.
//
// Claude Code (PreToolUse sobre Bash): recibe { tool_input: { command }, cwd }, rechaza con código 2 y stderr.
// Cursor (beforeShellExecution): recibe { command, cwd }, responde { permission: 'deny' | 'allow' }.
// Ante cualquier error deja pasar.

const lib = require('../scripts/lib');

const COMANDO_GIT = /(?:^|[;&|(\n])\s*(?:\w+=\S*\s+)*git\b/;
const SALTA_HOOKS = /\bgit\b[^;&|\n]*(?:--no-verify\b|\bcore\.hooksPath\b|\bcommit\b[^;&|\n]*\s-[a-zA-Z]*n[a-zA-Z]*(?:\s|$))/;
const VERBO_DE_ESCRITURA = new RegExp(
  [
    '>',
    '\\btee\\b',
    '\\bsed\\b[^;&|\\n]*\\s-[a-zA-Z]*i',
    '\\b(?:rm|mv|cp|ln|truncate|dd|install)\\b',
    '\\bgit\\s+(?:rm|mv|checkout|restore|reset|stash|clean|apply|am)\\b',
    '\\b(?:Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item|Clear-Content|Rename-Item)\\b',
    '\\b(?:perl|ruby|php)\\b',
    '\\bpython3?\\b',
    '\\bnode\\b',
    '\\b(?:del|erase|move|copy|ren|rename)\\b',
  ].join('|'),
  'i'
);
const TOCA_EL_RECLAMO = /CLAIM\.md/i;
const TOCA_LA_CACHE = /polaria-paralelo|hooks[\\/]+pre-commit/i;
const ES_PARALELO = /paralelo\.js["']?\s+(?:reclamar|liberar|importar-claims|estado|comparar|solapes|iniciar-rama|base)\b/;

// Devuelve el motivo del rechazo, o null si el comando puede seguir.
function evaluar(comando) {
  if (COMANDO_GIT.test(comando) && SALTA_HOOKS.test(comando)) {
    return 'Trabajo en paralelo: no puedes saltarte los hooks de git (--no-verify, commit -n o core.hooksPath) mientras esta rama tenga un CLAIM.md. El pre-commit es lo que cuida que no escribas fuera de tu zona.';
  }
  if (TOCA_EL_RECLAMO.test(comando) && VERBO_DE_ESCRITURA.test(comando) && !ES_PARALELO.test(comando)) {
    return 'Trabajo en paralelo: el CLAIM.md no se escribe, mueve ni borra por la terminal. Solo "paralelo.js reclamar", "paralelo.js autorizar" (lo corre el usuario en su terminal) y "paralelo.js liberar" pueden cambiarlo.';
  }
  if (TOCA_LA_CACHE.test(comando) && VERBO_DE_ESCRITURA.test(comando) && !ES_PARALELO.test(comando)) {
    return 'Trabajo en paralelo: la caché del plugin (polaria-paralelo) y el hook pre-commit no se escriben por la terminal.';
  }
  return null;
}

lib.leerEvento((evento) => {
  try {
    const cursor = lib.esCursor() || !evento.tool_input;
    const comando = String((cursor ? evento.command : evento.tool_input && evento.tool_input.command) || '');
    const permitir = () => (cursor ? lib.salir(0, { permission: 'allow' }) : lib.salir(0));
    if (!comando) return permitir();
    const repo = lib.infoDelRepo(lib.directorioDelEvento(evento));
    const claim = repo && lib.leerClaimPropio(repo.raiz);
    if (!claim || claim.estado !== 'ACTIVO') return permitir();
    const motivo = evaluar(comando);
    if (!motivo) return permitir();
    if (cursor) return lib.salir(2, { permission: 'deny', user_message: motivo, agent_message: motivo });
    process.stderr.write(`${motivo}\n`);
    return lib.salir(2);
  } catch {
    return lib.salir(0);
  }
});
