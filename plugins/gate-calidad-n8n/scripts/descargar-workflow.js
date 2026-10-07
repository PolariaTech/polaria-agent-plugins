#!/usr/bin/env node
// Descarga un workflow de n8n por la API pública (con pin data) para el Gate de Calidad N8N, sin que
// el JSON pase por el asistente. Reemplaza el Download manual del menú del workflow.
//
// Uso (desde la raíz del repo del proyecto):
//   node descargar-workflow.js verificar
//   node descargar-workflow.js <workflowId> [--salida <archivo>]
//
// Sin --salida guarda en <git-common-dir>/polaria-gate-n8n/descargas/<workflowId>-<versionId>.json
// (dentro de .git/: nunca se commitea, porque el pin data puede traer datos de prueba).
// Salidas: 0 = listo; 2 = falta la clave, está vencida o no tiene permiso (imprime la guía);
// 1 = cualquier otro error (usar el Download manual y declararlo en el reporte).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { obtenerWorkflow, verificarClave } = require('./n8n-api');
const { carpetaGate } = require('./marca');

const ERRORES_DE_CLAVE = ['SIN_CLAVE', 'CLAVE_INVALIDA', 'SIN_PERMISO'];

// Después de un fetch se usa process.exitCode y no process.exit(): en Windows, salir con conexiones
// de fetch aún cerrándose tumba a Node (assertion de libuv) y el código de salida se pierde.
function fallar(error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = ERRORES_DE_CLAVE.includes(error.codigo) ? 2 : 1;
}

async function principal() {
  const [primero, ...resto] = process.argv.slice(2);
  if (!primero) {
    process.stderr.write('Uso: node descargar-workflow.js verificar | <workflowId> [--salida <archivo>]\n');
    process.exit(1);
  }
  if (primero === 'verificar') {
    await verificarClave();
    process.stdout.write('Clave de la API de n8n configurada y válida.\n');
    return;
  }

  const workflow = await obtenerWorkflow(primero);
  if (!Array.isArray(workflow.nodes)) {
    process.stderr.write(`La API no devolvió un workflow para ${primero}. Usa el Download manual y decláralo en el reporte.\n`);
    return void (process.exitCode = 1);
  }
  if (!Object.prototype.hasOwnProperty.call(workflow, 'pinData')) {
    process.stderr.write(`La API no devolvió el campo pinData de ${primero}: sin él los criterios 12 y 13 no se pueden revisar. Usa el Download manual y decláralo en el reporte.\n`);
    return void (process.exitCode = 1);
  }

  const indiceSalida = resto.indexOf('--salida');
  let archivo;
  if (indiceSalida !== -1 && resto[indiceSalida + 1]) archivo = path.resolve(resto[indiceSalida + 1]);
  else {
    try {
      archivo = path.join(carpetaGate(), 'descargas', `${primero}-${workflow.versionId || 'sin-version'}.json`);
    } catch {
      process.stderr.write('No estás dentro del repo git del proyecto: pasa --salida o corre el script desde la raíz del repo.\n');
      return void (process.exitCode = 1);
    }
  }
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const contenido = `${JSON.stringify(workflow, null, 2)}\n`;
  fs.writeFileSync(archivo, contenido);

  const conPin = Object.keys(workflow.pinData || {});
  process.stdout.write([
    `Workflow: ${workflow.name}`,
    `ID: ${workflow.id}`,
    `versionId: ${workflow.versionId || 'sin versionId'}`,
    `activeVersionId: ${workflow.activeVersionId || 'sin publicar'}`,
    `Pin data: ${conPin.length ? conPin.join(', ') : 'ninguno'}`,
    `sha256: ${crypto.createHash('sha256').update(contenido).digest('hex')}`,
    `Archivo: ${archivo}`,
  ].join('\n') + '\n');
}

principal().catch(fallar);
