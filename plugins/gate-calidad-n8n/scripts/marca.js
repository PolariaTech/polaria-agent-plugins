// Marca del veredicto del Gate de Calidad N8N: <git-common-dir>/polaria-gate-n8n/<workflowId>.md.
// Vive dentro de .git/ (nunca se commitea). La escriben registrar-veredicto.js (APROBADO, RECHAZADO,
// RECHAZADO_JUSTIFICADO) y revisar-workflow.js texto (EXENTO_TEXTO); la lee el hook verificar-publicacion.js.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function carpetaGate(directorio = process.cwd()) {
  const comun = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: directorio, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  return path.join(path.resolve(directorio, comun), 'polaria-gate-n8n');
}

// campos: { version_dev, dev_id?, sha256? }
function escribirMarca(workflowId, veredicto, campos, directorio) {
  const carpeta = carpetaGate(directorio);
  fs.mkdirSync(carpeta, { recursive: true });
  const lineas = [`VEREDICTO: ${veredicto}`, `fecha: ${new Date().toISOString()}`];
  for (const [clave, valor] of Object.entries(campos)) if (valor) lineas.push(`${clave}: ${valor}`);
  fs.writeFileSync(path.join(carpeta, `${workflowId}.md`), `${lineas.join('\n')}\n`);
}

module.exports = { carpetaGate, escribirMarca };
