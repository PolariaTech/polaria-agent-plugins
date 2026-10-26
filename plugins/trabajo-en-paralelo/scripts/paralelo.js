#!/usr/bin/env node
// CLI de la skill trabajo-en-paralelo-polaria. Desde cualquier carpeta del repo (o de uno de sus worktrees):
//   node paralelo.js importar <archivo.json>   Copia los reclamos leídos de Linear a la caché local.
//   node paralelo.js estado                    Muestra qué hay en la caché y qué antigüedad tiene.
//   node paralelo.js comparar --zonas "a/,b.ts#fn" [--issue POL-1]
//                                              Cruza las zonas que se piensa reclamar con los reclamos ajenos.
//   node paralelo.js solapes [--sin-fetch]     Chequea la rama actual contra las ramas y reclamos de los demás.
//   node paralelo.js crear-worktree <rama>     Crea la rama desde la principal y su worktree, sin tracking.
//   node paralelo.js base                      Imprime la rama principal (origin/main, origin/master...).
// Salida siempre en texto; código 0 salvo error de uso.

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const { analizar, formatear, ramaBase } = require('./solapes');

function falla(mensaje) {
  process.stderr.write(`${mensaje}\n`);
  process.exit(2);
}

function repoActual() {
  const repo = lib.infoDelRepo(process.cwd());
  if (!repo) falla('Esto no es un repo git: corre el comando dentro del repo del proyecto.');
  return repo;
}

function valorDe(argumentos, bandera) {
  const posicion = argumentos.indexOf(bandera);
  return posicion === -1 ? null : argumentos[posicion + 1];
}

function zonaDeTexto(texto) {
  const [archivo, funcion] = lib.normalizarRuta(texto.trim()).split('#');
  const esCarpeta = /\/(\*{1,2})?$/.test(archivo);
  return { ruta: archivo, tipo: funcion ? 'funcion' : esCarpeta ? 'carpeta' : 'archivo', funcion: funcion || null };
}

function importar(argumentos) {
  const archivo = argumentos[0];
  if (!archivo) falla('Uso: paralelo.js importar <archivo.json> (arreglo de { issue, comentarioId, autor, creado, cuerpo }).');
  let entradas;
  try {
    entradas = JSON.parse(fs.readFileSync(archivo, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    falla(`No pude leer ${archivo}: ${error.message}`);
  }
  if (!Array.isArray(entradas)) falla('El archivo debe contener un arreglo.');

  const porIssue = new Map();
  let descartados = 0;
  for (const entrada of entradas) {
    const reclamo = lib.parsearReclamo(entrada.cuerpo);
    if (!reclamo || !entrada.issue) {
      descartados += 1;
      continue;
    }
    const actual = porIssue.get(entrada.issue);
    // De varios reclamos en el mismo issue gana el más reciente.
    if (!actual || String(entrada.creado || '') >= String(actual.creado || '')) {
      porIssue.set(entrada.issue, {
        issue: String(entrada.issue).toUpperCase(),
        comentarioId: entrada.comentarioId || null,
        creado: entrada.creado || null,
        responsable: reclamo.responsable || entrada.autor || '',
        rama: reclamo.rama,
        estado: reclamo.estado,
        confianza: reclamo.confianza,
        zonas: reclamo.zonas,
        compartidos: reclamo.compartidos,
      });
    }
  }
  const repo = repoActual();
  const reclamos = [...porIssue.values()];
  lib.escribirCache(repo, { sincronizado: new Date().toISOString(), reclamos });
  const activos = reclamos.filter((r) => r.estado === 'ACTIVO');
  console.log(`Caché actualizada en ${lib.rutaCache(repo)}: ${activos.length} reclamo(s) activo(s), ${reclamos.length - activos.length} liberado(s), ${descartados} comentario(s) sin formato de reclamo.`);
  activos.forEach((r) => console.log(`  - ${r.issue} (${r.responsable || 'sin responsable'}, ${r.confianza ?? '?'}%): ${r.zonas.map((z) => z.ruta + (z.funcion ? `#${z.funcion}` : '')).join(', ')}`));
}

function estado() {
  const repo = repoActual();
  const cache = lib.leerCache(repo);
  if (!cache) return console.log('No hay caché de reclamos en este repo: corre el modo sincronizar de la skill.');
  const horas = Math.round(lib.edadDeCacheEnHoras(cache) * 10) / 10;
  console.log(`Caché sincronizada hace ${horas} h${lib.cacheVencida(cache) ? ' (VENCIDA: sincroniza de nuevo)' : ''}. Issue de esta rama: ${lib.issueDeRama(repo.rama) || 'ninguno'}.`);
  cache.reclamos.forEach((r) => console.log(`  - ${r.issue} ${r.estado} (${r.responsable || 'sin responsable'}) rama ${r.rama || '?'}: ${r.zonas.map((z) => z.ruta).join(', ')}`));
}

function comparar(argumentos) {
  const texto = valorDe(argumentos, '--zonas');
  if (!texto) falla('Uso: paralelo.js comparar --zonas "src/auth/,src/lib/a.ts#fn" [--issue POL-1]');
  const repo = repoActual();
  const issuePropio = (valorDe(argumentos, '--issue') || lib.issueDeRama(repo.rama) || '').toUpperCase() || null;
  const cache = lib.leerCache(repo);
  const mias = texto.split(',').map(zonaDeTexto).filter((z) => z.ruta);
  const hallazgos = [];
  for (const reclamo of lib.reclamosAjenos(cache, issuePropio)) {
    for (const mia of mias) {
      for (const ajena of reclamo.zonas) {
        if (lib.zonasSeSolapan(mia, ajena)) hallazgos.push({ reclamo, mia, ajena, nivel: 'ZONA' });
      }
      for (const ajena of reclamo.compartidos || []) {
        if (lib.zonasSeSolapan(mia, ajena)) hallazgos.push({ reclamo, mia, ajena, nivel: 'COMPARTIDO' });
      }
    }
  }
  if (!cache) console.log('AVISO: no hay caché de reclamos; sincroniza antes de comparar.');
  else if (lib.cacheVencida(cache)) console.log('AVISO: la caché de reclamos está vencida; sincroniza antes de comparar.');
  if (!hallazgos.length) return console.log(`Sin solape con los reclamos ajenos activos (${lib.reclamosAjenos(cache, issuePropio).length} revisado(s)).`);
  for (const h of hallazgos) {
    const funciones = h.mia.funcion && h.ajena.funcion ? (h.mia.funcion === h.ajena.funcion ? ' MISMA FUNCIÓN' : ' (funciones distintas del mismo archivo)') : '';
    console.log(`${h.nivel === 'ZONA' ? 'SOLAPE' : 'SOLAPE EN COMPARTIDO'}: tu \`${h.mia.ruta}\` ↔ \`${h.ajena.ruta}\` de ${h.reclamo.issue}${h.reclamo.responsable ? ` (${h.reclamo.responsable})` : ''}${funciones}`);
  }
}

function crearWorktree(argumentos) {
  const rama = argumentos[0];
  if (!rama || !/^[\w./-]+$/.test(rama)) falla('Uso: paralelo.js crear-worktree <rama> (solo letras, números, ., _, - y /).');
  const repo = repoActual();
  try {
    lib.git(repo.raiz, ['fetch', '--prune', '--quiet', 'origin'], { timeoutMs: 30000 });
  } catch {
    process.stderr.write('AVISO: no pude hacer git fetch; el worktree sale de la última copia local de la rama principal.\n');
  }
  const base = ramaBase(repo.raiz);
  if (!base) falla('No encontré la rama principal (origin/HEAD, origin/main ni origin/master).');
  // Carpeta hermana del repo: <repo>-<rama>, sin barras.
  const nombreDelRepo = path.basename(path.resolve(repo.directorioComun, '..'));
  const destino = path.resolve(repo.raiz, '..', `${nombreDelRepo}-${rama.replace(/[\\/]/g, '-')}`);
  if (fs.existsSync(destino)) falla(`Ya existe ${destino}. Si es el worktree de esta tarea, úsalo; si no, elige otra rama.`);
  let existe = true;
  try {
    lib.git(repo.raiz, ['rev-parse', '--verify', '-q', `refs/heads/${rama}`]);
  } catch {
    existe = false;
  }
  // --no-track: sin esto la rama nueva queda siguiendo a origin/main y un push iría a la rama principal.
  const argumentosGit = existe ? ['worktree', 'add', destino, rama] : ['worktree', 'add', '--no-track', '-b', rama, destino, base];
  try {
    lib.git(repo.raiz, argumentosGit, { timeoutMs: 60000 });
  } catch (error) {
    falla(`git worktree add falló: ${error.message}`);
  }
  console.log(`Worktree creado: ${destino}\nRama: ${rama}${existe ? ' (ya existía)' : ` (desde ${base}, sin tracking)`}`);
}

const [comando, ...argumentos] = process.argv.slice(2);
switch (comando) {
  case 'importar':
    importar(argumentos);
    break;
  case 'estado':
    estado();
    break;
  case 'comparar':
    comparar(argumentos);
    break;
  case 'solapes':
    console.log(formatear(analizar(process.cwd(), { fetch: !argumentos.includes('--sin-fetch') })));
    break;
  case 'crear-worktree':
    crearWorktree(argumentos);
    break;
  case 'base':
    console.log(ramaBase(repoActual().raiz) || 'sin rama principal');
    break;
  default:
    falla('Comandos: importar | estado | comparar | solapes | crear-worktree | base. Ver la cabecera de paralelo.js.');
}
