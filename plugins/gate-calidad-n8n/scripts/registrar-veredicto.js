#!/usr/bin/env node
// Registra el veredicto del Gate de Calidad N8N para el workflow de producción que se va a publicar.
// Lo escribe dentro de .git/ (no se commitea) en polaria-gate-n8n/<workflowId>.md; es lo único que
// lee el hook verificar-publicacion.js antes de dejar pasar publish_workflow del MCP de n8n.
//
// Uso (desde la raíz del repo del proyecto):
//   node registrar-veredicto.js <workflowId de producción> <APROBADO|RECHAZADO|RECHAZADO_JUSTIFICADO> <versionId de la copia DEV revisada>

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [workflowId, veredicto, versionDev] = process.argv.slice(2);
if (!workflowId || !['APROBADO', 'RECHAZADO', 'RECHAZADO_JUSTIFICADO'].includes(veredicto) || !versionDev) {
  process.stderr.write('Uso: node registrar-veredicto.js <workflowId de producción> <APROBADO|RECHAZADO|RECHAZADO_JUSTIFICADO> <versionId DEV>\n');
  process.exit(1);
}

let directorioGit;
try {
  directorioGit = path.resolve(execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
} catch {
  process.stderr.write('No estás dentro del repo git del proyecto: el gate n8n necesita el repo (N9 de los Estándares N8N).\n');
  process.exit(1);
}

const carpeta = path.join(directorioGit, 'polaria-gate-n8n');
fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, `${workflowId}.md`), `VEREDICTO: ${veredicto}\nfecha: ${new Date().toISOString()}\nversion_dev: ${versionDev}\n`);
process.stdout.write(`Veredicto ${veredicto} registrado para el workflow ${workflowId} (copia DEV ${versionDev}).\n`);
