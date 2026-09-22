#!/usr/bin/env node
// Hook del plugin gate-calidad-tecnica, compartido por Claude Code y Cursor.
// Bloquea un `git push` si el commit actual (HEAD) no tiene un veredicto del gate registrado
// por la skill gate-calidad-tecnica-pre-merge-polaria en <git-dir>/polaria-gate/<sha>.md.
//
// Claude Code (PreToolUse sobre Bash, hooks.json): recibe { tool_input: { command }, cwd };
//   salida 0 = deja pasar, salida 2 = bloquea y el mensaje de stderr vuelve a Claude.
// Cursor (beforeShellExecution, cursor-hooks.json): recibe { command, cwd, hook_event_name };
//   responde por stdout { permission, user_message, agent_message } y además sale con 2 al bloquear.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VEREDICTOS_QUE_PERMITEN_PUSH = /^VEREDICTO: (APROBADO|RECHAZADO_JUSTIFICADO)\s*$/;

let esCursor = false;

function permitir() {
  if (esCursor) process.stdout.write(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
}

function bloquear(mensaje) {
  if (esCursor) {
    process.stdout.write(JSON.stringify({ permission: 'deny', user_message: mensaje, agent_message: mensaje }));
  }
  process.stderr.write(`${mensaje}\n`);
  process.exit(2);
}

let entrada = '';
process.stdin.on('data', (fragmento) => (entrada += fragmento));
process.stdin.on('end', () => {
  let comando;
  let directorio;
  try {
    const evento = JSON.parse(entrada);
    esCursor = evento.hook_event_name === 'beforeShellExecution';
    comando = esCursor ? evento.command || '' : (evento.tool_input && evento.tool_input.command) || '';
    directorio =
      evento.cwd || (evento.workspace_roots && evento.workspace_roots[0]) || process.env.CURSOR_PROJECT_DIR || process.cwd();
  } catch {
    permitir(); // Evento ilegible: no es responsabilidad de este hook decidir.
  }

  // `push` como subcomando de git (con opciones globales opcionales como -C <ruta>), no
  // `git stash push` ni la palabra "push" dentro de un mensaje de commit.
  const esPush = /\bgit(?:\s+-[Cc]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+push\b/.test(comando);
  const soloBorraRama = /\bpush\b[^;&|\n]*(--delete\b|\s-d\b)/.test(comando);
  if (!esPush || soloBorraRama) permitir();

  const git = (...argumentos) =>
    execFileSync('git', argumentos, { cwd: directorio, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  let commitActual;
  let marca;
  try {
    commitActual = git('rev-parse', 'HEAD');
    marca = path.join(path.resolve(directorio, git('rev-parse', '--git-dir')), 'polaria-gate', `${commitActual}.md`);
  } catch {
    permitir(); // Fuera de un repo git: el push fallará solo, no hay nada que verificar.
  }

  let primeraLinea = '';
  try {
    primeraLinea = fs.readFileSync(marca, 'utf8').split(/\r?\n/)[0];
  } catch {
    // Sin marca: se bloquea abajo.
  }
  if (VEREDICTOS_QUE_PERMITEN_PUSH.test(primeraLinea)) permitir();

  bloquear(
    `Gate de Calidad Técnica Pre-Merge: el commit ${commitActual.slice(0, 7)} no tiene veredicto APROBADO ` +
      '(ni RECHAZADO_JUSTIFICADO) registrado. Corre la skill gate-calidad-tecnica-pre-merge-polaria sobre ' +
      'este cambio antes del push. Si el veredicto es de un commit anterior, el cambio cambió después de la ' +
      'revisión y hay que revisarlo de nuevo.'
  );
});
