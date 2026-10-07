#!/usr/bin/env node
// Hook del plugin gate-calidad-n8n, compartido por Claude Code y Cursor.
// Bloquea publish_workflow del MCP de n8n si el workflow no tiene un veredicto APROBADO,
// RECHAZADO_JUSTIFICADO o EXENTO_TEXTO de las últimas 24 horas, registrado por la skill
// gate-calidad-n8n-polaria en <git-common-dir>/polaria-gate-n8n/<workflowId>.md.
// Si la persona tiene N8N_API_KEY y la marca trae dev_id, también bloquea cuando la copia DEV
// cambió después del veredicto (su versionId ya no es el revisado).
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
const PERMITEN_PUBLICAR = /^VEREDICTO: (APROBADO|RECHAZADO_JUSTIFICADO|EXENTO_TEXTO)\s*$/;

let esCursor = false;
// Tras consultar la API no se llama a process.exit(): en Windows, salir con conexiones de fetch aún
// cerrándose tumba a Node con otro código de salida, y Claude Code solo bloquea con el 2.
let trasConsultarApi = false;

function terminar(codigo) {
  process.exitCode = codigo;
  if (!trasConsultarApi) process.exit(codigo);
}

function permitir() {
  if (esCursor) process.stdout.write(JSON.stringify({ permission: 'allow' }));
  terminar(0);
}

function bloquear(mensaje) {
  if (esCursor) process.stdout.write(JSON.stringify({ permission: 'deny', user_message: mensaje, agent_message: mensaje }));
  process.stderr.write(`${mensaje}\n`);
  terminar(2);
}

let entrada = '';
process.stdin.on('data', (fragmento) => (entrada += fragmento));
process.stdin.on('end', () => {
  let evento;
  try {
    evento = JSON.parse(entrada.replace(/^\uFEFF/, ''));
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
    `Gate de Calidad N8N: el workflow ${workflowId} no tiene veredicto APROBADO (ni RECHAZADO_JUSTIFICADO ni EXENTO_TEXTO) ` +
    'de las últimas 24 horas en el repo del proyecto. Corre la skill gate-calidad-n8n-polaria sobre la copia DEV antes de publicar.';
  if (!marca || !PERMITEN_PUBLICAR.test(marca[0])) bloquear(sinVeredicto);
  const campo = (nombre) => (marca.find((l) => l.startsWith(`${nombre}: `)) || '').slice(nombre.length + 2).trim();
  const fecha = Date.parse(campo('fecha'));
  if (!fecha || Date.now() - fecha > VIGENCIA_MS) bloquear(sinVeredicto);

  const devId = campo('dev_id');
  const versionRevisada = campo('version_dev');
  if (!devId || !versionRevisada || !(process.env.N8N_API_KEY || '').trim()) permitir(); // Sin API: se mantiene la verificación de v1.0.
  let api;
  try {
    api = require('../scripts/n8n-api');
  } catch {
    bloquear('Gate de Calidad N8N: falta scripts/n8n-api.js del plugin; reinstala el plugin gate-calidad-n8n antes de publicar.');
  }
  trasConsultarApi = true;
  api
    .obtenerWorkflow(devId)
    .then((copiaDev) => {
      if (copiaDev.versionId !== versionRevisada) {
        return bloquear(`Gate de Calidad N8N: la copia DEV ${devId} cambió después del veredicto (revisada: ${versionRevisada}; actual: ${copiaDev.versionId}). Vuelve a correr la skill gate-calidad-n8n-polaria sobre la versión actual antes de publicar.`);
      }
      return permitir();
    })
    .catch((error) => {
      // Sin conexión con la API se mantiene la verificación de v1.0 (marca vigente), para no dejar sin salida
      // la publicación por MCP; una clave rechazada o una copia DEV inexistente sí bloquean.
      if (error.codigo === 'RED') return permitir();
      return bloquear(`Gate de Calidad N8N: no se pudo comprobar en la API de n8n que la copia DEV ${devId} sigue siendo la revisada (${error.message.split('\n')[0]}). Revisa la clave y vuelve a intentar.`);
    });
});
