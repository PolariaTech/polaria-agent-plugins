#!/usr/bin/env node
// Registra el veredicto del gate-calidad-tecnica para el commit actual (HEAD) en
// <git-dir>/polaria-gate/<sha>.md, que es lo único que leen los hooks del push.
// Lo ejecuta la skill gate-calidad-tecnica-pre-merge-polaria en su Paso 3, desde la raíz del repo:
//   node "$(git rev-parse --git-common-dir)/polaria-gate/registrar-veredicto.js" APROBADO
// (instalar-pre-push.js lo copia ahí en cada sesión). Escribe solo dentro de .git/: no crea archivos
// en el proyecto ni temporales. El reporte completo vive en el chat y en el PR/Linear, no aquí.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VEREDICTOS = ['APROBADO', 'RECHAZADO', 'RECHAZADO_JUSTIFICADO'];

const veredicto = process.argv[2];
if (!VEREDICTOS.includes(veredicto)) {
  process.stderr.write(`Uso: registrar-veredicto.js <${VEREDICTOS.join(' | ')}>\n`);
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

fs.mkdirSync(carpetaGate, { recursive: true });
fs.writeFileSync(
  path.join(carpetaGate, `${commit}.md`),
  `VEREDICTO: ${veredicto}\nRegistrado: ${new Date().toISOString()}\n`
);
process.stdout.write(`Veredicto ${veredicto} registrado para el commit ${commit.slice(0, 7)}.\n`);
