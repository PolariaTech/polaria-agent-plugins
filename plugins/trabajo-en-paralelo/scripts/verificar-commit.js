#!/usr/bin/env node
// pre-commit de git del plugin trabajo-en-paralelo. instalar-pre-commit.js lo copia a
// <git-common-dir>/polaria-paralelo/bin/ y el hook <hooks>/pre-commit lo ejecuta.
//
// Mira lo que se va a commitear (el índice) y rechaza el commit (código 1) si:
//   1. Incluye un archivo fuera de las zonas y compartidos del CLAIM.md de la rama.
//   2. Crea, cambia o borra el CLAIM.md sin que paralelo.js (reclamar, autorizar, liberar) lo haya registrado.
// En una rama sin CLAIM.md no hace nada. En merges, cherry-picks, reverts y rebases tampoco: traen archivos de otros.
// Ante cualquier falla propia deja pasar el commit: este hook nunca debe impedir un commit por un error suyo.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

function git(argumentos) {
  const r = spawnSync('git', argumentos, { encoding: 'utf8', timeout: 20000 });
  return r.status === 0 ? r.stdout : null;
}

function enMedioDeOtraOperacion(carpetaGit) {
  return ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'].some((n) => fs.existsSync(path.join(carpetaGit, n)));
}

// `git diff --cached --name-status -z` entrega "A\0ruta\0M\0ruta\0...".
function cambiosDelIndice() {
  const salida = git(['diff', '--cached', '--name-status', '--no-renames', '-z']);
  if (salida === null) return [];
  const piezas = salida.split('\0').filter(Boolean);
  const cambios = [];
  for (let i = 0; i + 1 < piezas.length; i += 2) cambios.push({ estado: piezas[i][0], archivo: lib.normalizarRuta(piezas[i + 1]) });
  return cambios;
}

function comandoParaAutorizar(directorioBin) {
  try {
    return `node "${fs.readFileSync(path.join(directorioBin, 'paralelo-ruta.txt'), 'utf8').trim()}" autorizar <ruta>`;
  } catch {
    return 'paralelo.js autorizar <ruta> (del plugin trabajo-en-paralelo)';
  }
}

function verificar() {
  const repo = lib.infoDelRepo(process.cwd());
  if (!repo) return 0;
  const carpetaGit = (git(['rev-parse', '--absolute-git-dir']) || '').trim();
  if (carpetaGit && enMedioDeOtraOperacion(carpetaGit)) return 0;

  const cambios = cambiosDelIndice();
  const delClaim = cambios.find((c) => c.archivo === lib.ARCHIVO_RECLAMO);
  const claimEnIndice = git(['show', `:${lib.ARCHIVO_RECLAMO}`]); // null si el índice no lo tiene
  if (claimEnIndice === null && !delClaim) return 0; // Rama sin reclamo: nada que cuidar.

  const problemas = [];
  if (delClaim) {
    const hash = delClaim.estado === 'D' ? lib.HASH_ELIMINADO : lib.hashDeClaim(claimEnIndice || '');
    if (!lib.estaAutorizado(repo, hash)) {
      problemas.push(
        delClaim.estado === 'D'
          ? 'El CLAIM.md solo se borra con "paralelo.js liberar".'
          : 'El CLAIM.md solo se crea con "paralelo.js reclamar" y solo se amplía con "paralelo.js autorizar", que el usuario corre en su terminal. Este CLAIM.md no fue escrito por ellos.'
      );
    }
  }
  const reclamo = claimEnIndice === null ? null : lib.parsearReclamo(claimEnIndice);
  if (reclamo && reclamo.estado === 'ACTIVO') {
    const fuera = cambios.filter((c) => c.archivo !== lib.ARCHIVO_RECLAMO && !lib.claimCubreArchivo(reclamo, c.archivo)).map((c) => c.archivo);
    if (fuera.length) {
      problemas.push(`El commit incluye archivos fuera de las zonas de tu CLAIM.md:\n${fuera.slice(0, 15).map((a) => `  - ${a}`).join('\n')}${fuera.length > 15 ? `\n  - y ${fuera.length - 15} más` : ''}`);
      problemas.push(`No uses --no-verify. Si el usuario autoriza salir de la zona, él debe correr en su terminal: ${comandoParaAutorizar(__dirname)}`);
    }
  }
  if (!problemas.length) return 0;
  process.stderr.write(`Trabajo en paralelo: commit rechazado.\n${problemas.join('\n')}\n`);
  return 1;
}

try {
  process.exit(verificar());
} catch {
  process.exit(0);
}
