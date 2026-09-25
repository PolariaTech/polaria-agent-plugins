#!/usr/bin/env node
// Hook del plugin gate-calidad-tecnica, compartido por Claude Code, Cursor y el hook pre-push de git.
// Bloquea un `git push` si el commit que se publica no tiene un veredicto del gate registrado
// por la skill gate-calidad-tecnica-pre-merge-polaria en <git-dir>/polaria-gate/<sha>.md.
//
// Claude Code (PreToolUse sobre Bash, hooks.json): recibe { tool_input: { command }, cwd };
//   salida 0 = deja pasar, salida 2 = bloquea y el mensaje de stderr vuelve a Claude.
// Cursor (beforeShellExecution, cursor-hooks.json): recibe { command, cwd, hook_event_name };
//   responde por stdout { permission, user_message, agent_message } y además sale con 2 al bloquear.
// git pre-push (--git-pre-push, instalado por instalar-pre-push.js): recibe por stdin una línea
//   "<ref local> <sha local> <ref remota> <sha remota>" por cada ref; salida distinta de 0 = bloquea.
//   Cubre el push que la IA no ve: terminal, panel de Git del editor o una IA sin el plugin cargado.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VEREDICTOS_QUE_PERMITEN_PUSH = /^VEREDICTO: (APROBADO|RECHAZADO_JUSTIFICADO)\s*$/;
const SHA_VACIO = /^0+$/;

let esCursor = false;
let respondido = false;

// Sale solo cuando stdout terminó de vaciarse: con process.exit() justo después de write(), un pipe
// asíncrono puede cerrarse vacío y Cursor (failClosed) lo toma como "returned no output" y corta el comando.
function responder(respuestaCursor, codigo) {
  if (respondido) return;
  respondido = true;
  if (!esCursor) process.exit(codigo);
  process.exitCode = codigo;
  process.stdout.write(JSON.stringify(respuestaCursor), () => process.exit(codigo));
}

function permitir() {
  responder({ permission: 'allow' }, 0);
}

function bloquear(mensaje) {
  process.stderr.write(`${mensaje}\n`);
  responder({ permission: 'deny', user_message: mensaje, agent_message: mensaje }, 2);
}

function tieneVeredicto(directorioGit, commit) {
  try {
    const primeraLinea = fs.readFileSync(path.join(directorioGit, 'polaria-gate', `${commit}.md`), 'utf8').split(/\r?\n/)[0];
    return VEREDICTOS_QUE_PERMITEN_PUSH.test(primeraLinea);
  } catch {
    return false; // Sin marca.
  }
}

function mensajeSinVeredicto(commit) {
  return (
    `Gate de Calidad Técnica Pre-Merge: el commit ${commit.slice(0, 7)} no tiene veredicto APROBADO ` +
    '(ni RECHAZADO_JUSTIFICADO) registrado. Corre la skill gate-calidad-tecnica-pre-merge-polaria sobre ' +
    'este cambio antes del push. Si el veredicto es de un commit anterior, el cambio cambió después de la ' +
    'revisión y hay que revisarlo de nuevo.'
  );
}

// git ejecuta el hook desde la raíz del repo; cada línea de stdin es una ref que se va a publicar.
function verificarPrePushDeGit(entrada) {
  const directorioGit = path.resolve(
    execFileSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  );
  for (const linea of entrada.split(/\r?\n/)) {
    const [refLocal, shaLocal] = linea.trim().split(/\s+/);
    if (!refLocal || !shaLocal) continue;
    if (SHA_VACIO.test(shaLocal)) continue; // Borrar una rama remota no publica código.
    if (refLocal.startsWith('refs/tags/')) continue; // El tag apunta a un commit que ya pasó por el gate en su rama.
    if (!tieneVeredicto(directorioGit, shaLocal)) {
      process.stderr.write(`${mensajeSinVeredicto(shaLocal)}\n`);
      process.exit(1);
    }
  }
  process.exit(0);
}

function verificarEventoDelAgente(evento) {
  // Claude Code manda el comando en tool_input; Cursor lo manda arriba. No depende de hook_event_name.
  esCursor = !evento.tool_input;
  const comando = (esCursor ? evento.command : evento.tool_input.command) || '';
  // Cursor entrega workspace_roots como ruta de URI ("/d:/WORK/repo"), que Node no acepta en Windows.
  const raiz = evento.workspace_roots && evento.workspace_roots[0] && evento.workspace_roots[0].replace(/^\/([a-zA-Z]:)/, '$1');
  const directorio = evento.cwd || process.env.CURSOR_PROJECT_DIR || raiz || process.cwd();

  // `push` como subcomando de git (con opciones globales opcionales como -C <ruta>), no
  // `git stash push` ni la palabra "push" dentro de un mensaje de commit.
  const esPush = /\bgit(?:\s+-[Cc]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+push\b/.test(comando);
  const soloBorraRama = /\bpush\b[^;&|\n]*(--delete\b|\s-d\b)/.test(comando);
  if (!esPush || soloBorraRama) return permitir();

  const git = (...argumentos) =>
    execFileSync('git', argumentos, { cwd: directorio, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  let commitActual;
  let directorioGit;
  try {
    commitActual = git('rev-parse', 'HEAD');
    directorioGit = path.resolve(directorio, git('rev-parse', '--git-dir'));
  } catch {
    return permitir(); // Fuera de un repo git: el push fallará solo, no hay nada que verificar.
  }

  if (tieneVeredicto(directorioGit, commitActual)) return permitir();
  return bloquear(mensajeSinVeredicto(commitActual));
}

let entrada = '';
function procesar(finDeEntrada) {
  if (respondido) return;
  let evento;
  try {
    evento = JSON.parse(entrada);
  } catch {
    // Si el agente no cierra stdin, se decide apenas llega un JSON completo; si nunca llega, se deja pasar.
    if (finDeEntrada) permitir(); // Evento ilegible: no es responsabilidad de este hook decidir.
    return;
  }
  if (!evento || typeof evento !== 'object') return permitir();
  verificarEventoDelAgente(evento);
}

if (process.argv.includes('--git-pre-push')) {
  process.stdin.on('data', (fragmento) => (entrada += fragmento));
  process.stdin.on('end', () => verificarPrePushDeGit(entrada));
} else {
  process.stdin.on('data', (fragmento) => {
    entrada += fragmento;
    procesar(false);
  });
  process.stdin.on('end', () => procesar(true));
}
