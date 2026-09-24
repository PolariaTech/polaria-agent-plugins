#!/usr/bin/env node
// Hook del plugin gate-calidad-n8n, compartido por Claude Code y Cursor.
// Bloquea publish_workflow del MCP de n8n si el workflow no tiene un veredicto APROBADO o
// RECHAZADO_JUSTIFICADO de las últimas 24 horas, registrado por la skill gate-calidad-n8n-polaria
// en <git-common-dir>/polaria-gate-n8n/<workflowId>.md.
//
// Claude Code (PreToolUse, hooks.json): recibe { tool_name, tool_input: { workflowId }, cwd };
//   salida 0 = deja pasar, salida 2 = bloquea y el mensaje de stderr vuelve a Claude.
// Cursor (beforeMCPExecution, cursor-hooks.json): recibe { tool_name, tool_input (texto JSON), ... };
//   responde por stdout { permission, user_message, agent_message } y además sale con 2 al bloquear.
// No ve lo que se publica desde la interfaz de n8n: eso lo cubre el reporte en Linear (sección 4 del protocolo).

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const PERMITEN_PUBLICAR = /^VEREDICTO: (APROBADO|RECHAZADO_JUSTIFICADO)\s*$/;

let esCursor = false;

function permitir() {
  if (esCursor) process.stdout.write(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
}

function bloquear(mensaje) {
  if (esCursor) process.stdout.write(JSON.stringify({ permission: 'deny', user_message: mensaje, agent_message: mensaje }));
  process.stderr.write(`${mensaje}\n`);
  process.exit(2);
}

let entrada = '';
process.stdin.on('data', (fragmento) => (entrada += fragmento));
process.stdin.on('end', () => {
  let evento;
  try {
    evento = JSON.parse(entrada);
  } catch {
    bloquear('Gate de Calidad N8N: no se pudo leer el evento del hook; no se publica sin verificar el veredicto.');
  }
  esCursor = evento.hook_event_name === 'beforeMCPExecution';
  if (!/(^|__)publish_workflow$/.test(evento.tool_name || '')) permitir(); // unpublish y demás herramientas no se controlan.

  let parametros = evento.tool_input || {};
  if (typeof parametros === 'string') {
    try { parametros = JSON.parse(parametros); } catch { parametros = {}; }
  }
  const workflowId = parametros.workflowId;
  if (!workflowId) bloquear('Gate de Calidad N8N: publish_workflow sin workflowId; no se puede verificar el veredicto.');

  const raiz = evento.workspace_roots && evento.workspace_roots[0] && evento.workspace_roots[0].replace(/^\/([a-zA-Z]:)/, '$1');
  const directorio = evento.cwd || process.env.CURSOR_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || raiz || process.cwd();

  let marca;
  try {
    const directorioGit = path.resolve(directorio, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: directorio, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    marca = fs.readFileSync(path.join(directorioGit, 'polaria-gate-n8n', `${workflowId}.md`), 'utf8').split(/\r?\n/);
  } catch {
    marca = null;
  }

  const sinVeredicto =
    `Gate de Calidad N8N: el workflow ${workflowId} no tiene veredicto APROBADO (ni RECHAZADO_JUSTIFICADO) ` +
    'de las últimas 24 horas en el repo del proyecto. Corre la skill gate-calidad-n8n-polaria sobre la copia DEV antes de publicar.';
  if (!marca || !PERMITEN_PUBLICAR.test(marca[0])) bloquear(sinVeredicto);
  const fecha = Date.parse((marca.find((l) => l.startsWith('fecha: ')) || '').slice(7));
  if (!fecha || Date.now() - fecha > VIGENCIA_MS) bloquear(sinVeredicto);
  permitir();
});
