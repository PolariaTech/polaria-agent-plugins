#!/usr/bin/env node
// Registra el veredicto del Gate de Calidad N8N para el workflow de producción que se va a publicar.
// Lo escribe dentro de .git/ (no se commitea) en polaria-gate-n8n/<workflowId>.md; es lo único que
// lee el hook verificar-publicacion.js antes de dejar pasar publish_workflow del MCP de n8n.
// EXENTO_TEXTO no se registra aquí: solo lo escribe revisar-workflow.js texto cuando lo demuestra.
//
// Uso (desde la raíz del repo del proyecto):
//   node registrar-veredicto.js <workflowId de producción> <APROBADO|RECHAZADO|RECHAZADO_JUSTIFICADO> <versionId de la copia DEV revisada> <ID de la copia DEV>

const { escribirMarca } = require('./marca');

const [workflowId, veredicto, versionDev, devId] = process.argv.slice(2);
if (veredicto === 'EXENTO_TEXTO') {
  process.stderr.write('EXENTO_TEXTO solo lo registra `revisar-workflow.js texto` cuando el script demuestra que el cambio es de solo texto (sección 5.1 del protocolo).\n');
  process.exit(1);
}
if (!workflowId || !['APROBADO', 'RECHAZADO', 'RECHAZADO_JUSTIFICADO'].includes(veredicto) || !versionDev || !devId) {
  process.stderr.write('Uso: node registrar-veredicto.js <workflowId de producción> <APROBADO|RECHAZADO|RECHAZADO_JUSTIFICADO> <versionId DEV> <ID de la copia DEV>\n');
  process.exit(1);
}

try {
  escribirMarca(workflowId, veredicto, { version_dev: versionDev, dev_id: devId });
} catch {
  process.stderr.write('No estás dentro del repo git del proyecto: el gate n8n necesita el repo (N9 de los Estándares N8N).\n');
  process.exit(1);
}
process.stdout.write(`Veredicto ${veredicto} registrado para el workflow ${workflowId} (copia DEV ${versionDev}).\n`);
