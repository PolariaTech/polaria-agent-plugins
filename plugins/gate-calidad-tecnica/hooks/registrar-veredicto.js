#!/usr/bin/env node
// Registra el veredicto del gate-calidad-tecnica para el commit actual (HEAD) en
// <git-dir>/polaria-gate/<sha>.md, que es lo único que leen los hooks del push.
// Lo ejecuta la skill gate-calidad-tecnica-pre-merge-polaria en su Paso 3, desde la raíz del repo:
//   node "$(git rev-parse --git-common-dir)/polaria-gate/registrar-veredicto.js" APROBADO
//   node "$(git rev-parse --git-common-dir)/polaria-gate/registrar-veredicto.js" RECHAZADO --reporte <<'REPORTE' ... REPORTE
// (instalar-pre-push.js lo copia ahí en cada sesión). Escribe solo dentro de .git/: no crea archivos
// en el proyecto ni temporales.
//
// Con --reporte lee el reporte del revisor por stdin y lo guarda en la marca, junto con los criterios en
// [FAIL] (línea CRITERIOS_FAIL). Es lo que usa ronda-previa.js para acotar la revisión de la ronda siguiente.
// Los hooks de push solo leen la primera línea (VEREDICTO: ...): el reporte no cambia su decisión.
// Sin --reporte la marca queda como antes, solo con el veredicto.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VEREDICTOS = ['APROBADO', 'RECHAZADO', 'RECHAZADO_JUSTIFICADO'];

// Fila de la tabla del reporte: | **3. Secretos / Credenciales** | `[FAIL]` | ...
const FILA_FAIL = /^\|\s*\*\*\s*([1-9])\.[^|]*\|\s*`?\[?\s*FAIL\s*\]?`?\s*\|/;

// Devuelve los números de criterio que el reporte marca como [FAIL], sin repetir y en orden.
function criteriosConFail(reporte) {
  const criterios = new Set();
  for (const linea of reporte.split(/\r?\n/)) {
    const fila = FILA_FAIL.exec(linea.trim());
    if (fila) criterios.add(Number(fila[1]));
  }
  return [...criterios].sort((a, b) => a - b);
}

function leerReporteDeStdin() {
  try {
    return fs.readFileSync(0, 'utf8').replace(/^﻿/, '').trim();
  } catch {
    return '';
  }
}

function main() {
  const veredicto = process.argv[2];
  if (!VEREDICTOS.includes(veredicto)) {
    process.stderr.write(`Uso: registrar-veredicto.js <${VEREDICTOS.join(' | ')}> [--reporte]\n`);
    process.exit(1);
  }

  const git = (...argumentos) =>
    execFileSync('git', argumentos, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  let commit;
  let carpetaGate;
  try {
    commit = git('rev-parse', 'HEAD');
    carpetaGate = path.join(path.resolve(git('rev-parse', '--git-dir')), 'polaria-gate');
  } catch {
    process.stderr.write('No es un repo git con commits: no hay veredicto que registrar.\n');
    process.exit(1);
  }

  const lineas = [`VEREDICTO: ${veredicto}`, `Registrado: ${new Date().toISOString()}`];
  if (process.argv.includes('--reporte')) {
    const reporte = leerReporteDeStdin();
    if (!reporte) {
      process.stderr.write('Se pidió --reporte pero no llegó ningún reporte por stdin: no se registró el veredicto.\n');
      process.exit(1);
    }
    const fallidos = criteriosConFail(reporte);
    if (fallidos.length) lineas.push(`CRITERIOS_FAIL: ${fallidos.join(',')}`);
    lineas.push('---', reporte);
  }

  fs.mkdirSync(carpetaGate, { recursive: true });
  fs.writeFileSync(path.join(carpetaGate, `${commit}.md`), `${lineas.join('\n')}\n`);
  process.stdout.write(`Veredicto ${veredicto} registrado para el commit ${commit.slice(0, 7)}.\n`);
}

if (require.main === module) main();

module.exports = { criteriosConFail };
