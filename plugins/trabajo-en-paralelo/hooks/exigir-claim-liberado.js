#!/usr/bin/env node
// Hook de PR del plugin trabajo-en-paralelo. Antes de `gh pr create`, exige que el CLAIM.md ya esté liberado en la rama:
// si llegara con el PR, el reclamo terminaría en la rama principal y liberarlo obligaría a abrir otro PR solo para eso.
// Un push intermedio (sin PR por crear) no pasa por aquí y conserva el reclamo; el push final es el de la rama sobre la
// que se crea el PR, y se reconoce por el comando `gh pr create`.
//
// Bloquea si el CLAIM.md sigue en el último commit de la rama, o si la rama publicada (origin/<rama>) todavía lo trae
// aunque ya lo hayas borrado en local. La salida es liberar con "paralelo.js liberar" (que commitea y publica) y repetir.
//
// Claude Code (PreToolUse sobre Bash, hooks.json): recibe { tool_input: { command }, cwd }, rechaza con código 2 y stderr.
// Cursor (beforeShellExecution, cursor-hooks.json): recibe { command, cwd }, responde { permission: 'deny' | 'allow' }.
// Ante cualquier error deja pasar: este hook nunca debe impedir un PR por una falla propia.

const path = require('path');
const lib = require('../scripts/lib');

// `gh pr create` como comando (al inicio o tras ; && || | ( o salto de línea, con variables de entorno opcionales delante).
const ES_PR_CREATE = /(?:^|[;&|(\n])\s*(?:\w+=\S*\s+)*gh\s+pr\s+create\b/;

const traeElReclamo = (raiz, ref) => {
  try {
    lib.git(raiz, ['cat-file', '-e', `${ref}:${lib.ARCHIVO_RECLAMO}`]);
    return true;
  } catch {
    return false;
  }
};

// Devuelve el motivo del rechazo, o null si el PR puede seguir.
function evaluar(repo) {
  if (!repo.rama) return null;
  const liberar = `node "${path.resolve(__dirname, '..', 'scripts', 'paralelo.js')}" liberar`;
  if (traeElReclamo(repo.raiz, 'HEAD')) {
    return `Trabajo en paralelo: la rama ${repo.rama} todavía tiene el ${lib.ARCHIVO_RECLAMO} y el PR lo llevaría a la rama principal. Antes de crear el PR, libera el reclamo (borra el archivo con un commit y lo publica): ${liberar} (sin --volver; el reclamo se libera antes del PR y volver a la rama principal se hace después de que lo mergeen). Luego repite gh pr create.`;
  }
  if (traeElReclamo(repo.raiz, `origin/${repo.rama}`)) {
    return `Trabajo en paralelo: ya borraste el ${lib.ARCHIVO_RECLAMO} en local, pero origin/${repo.rama} todavía lo trae y el PR sale de la rama publicada. Publica la liberación (git push origin ${repo.rama}) y repite gh pr create.`;
  }
  return null;
}

lib.leerEvento((evento) => {
  try {
    const cursor = lib.esCursor() || !evento.tool_input;
    const comando = String((cursor ? evento.command : evento.tool_input && evento.tool_input.command) || '');
    const permitir = () => (cursor ? lib.salir(0, { permission: 'allow' }) : lib.salir(0));
    if (!ES_PR_CREATE.test(comando)) return permitir();
    const repo = lib.infoDelRepo(lib.directorioDelEvento(evento));
    const motivo = repo && evaluar(repo);
    if (!motivo) return permitir();
    if (cursor) return lib.salir(2, { permission: 'deny', user_message: motivo, agent_message: motivo });
    process.stderr.write(`${motivo}\n`);
    return lib.salir(2);
  } catch {
    return lib.salir(0);
  }
});
