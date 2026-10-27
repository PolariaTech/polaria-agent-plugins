#!/usr/bin/env node
// CLI de la skill trabajo-en-paralelo-polaria. Desde cualquier carpeta del repo (o de uno de sus worktrees):
//   node paralelo.js importar-claims [--sin-fetch]
//                                              Copia a la caché local el CLAIM.md de cada rama remota (y el propio).
//   node paralelo.js estado                    Muestra qué hay en la caché y qué antigüedad tiene.
//   node paralelo.js comparar --zonas "a/,b.ts#fn" [--issue POL-1]
//                                              Cruza las zonas que se piensa reclamar con los reclamos ajenos.
//   node paralelo.js solapes [--sin-fetch]     Chequea la rama actual contra las ramas y reclamos de los demás.
//   node paralelo.js crear-worktree <rama>     Crea la rama desde la principal y su worktree, sin tracking.
//   node paralelo.js reclamar --zonas "a/,b.ts" --confianza 80 [--compartidos "package.json"] [--responsable R]
//                             [--issue POL-1] [--porque "texto"]
//                                              Crea el CLAIM.md, lo commitea y publica la rama. Se detiene si choca.
//   node paralelo.js autorizar <ruta>...       Amplía el CLAIM.md. SOLO lo corre una persona: pide confirmación en una
//                                              terminal interactiva; sin terminal no hace nada.
//   node paralelo.js liberar                   Borra el CLAIM.md (commit y push) y deja el resultado en el mensaje.
//   node paralelo.js base                      Imprime la rama principal (origin/main, origin/master...).
// Salida siempre en texto. Códigos: 0 bien, 1 cancelado por el usuario, 2 error de uso, 3 choca con otra rama,
// 4 falta una terminal interactiva, 5 el commit quedó pero el push falló.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const lib = require('./lib');
const claims = require('./claims');
const { analizar, formatear, ramaBase } = require('./solapes');

function falla(mensaje, codigo = 2) {
  process.stderr.write(`${mensaje}\n`);
  process.exit(codigo);
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

function listaDe(texto) {
  return texto ? texto.split(',').map((t) => t.trim()).filter(Boolean) : [];
}

function terminarCon(resultado) {
  (resultado.codigo === 0 ? console.log : (m) => process.stderr.write(`${m}\n`))(resultado.mensaje);
  process.exit(resultado.codigo);
}

function importarClaims(argumentos) {
  const repo = repoActual();
  const importacion = claims.importarClaims(repo, { fetch: !argumentos.includes('--sin-fetch') });
  console.log(claims.resumenDeImportacion(importacion, lib.issueDeRama(repo.rama)));
}

function estado() {
  const repo = repoActual();
  const cache = lib.leerCache(repo);
  if (!cache) return console.log('No hay caché de reclamos en este repo: corre "paralelo.js importar-claims".');
  const horas = Math.round(lib.edadDeCacheEnHoras(cache) * 10) / 10;
  console.log(`Caché sincronizada hace ${horas} h${lib.cacheVencida(cache) ? ' (VENCIDA: corre importar-claims de nuevo)' : ''}. Issue de esta rama: ${lib.issueDeRama(repo.rama) || 'ninguno'}.`);
  cache.reclamos.forEach((r) => {
    const etiqueta = r.estado === 'ACTIVO' && lib.estaInactivo(r) ? 'INACTIVO' : r.estado;
    console.log(`  - ${r.issue} ${etiqueta} (${r.responsable || 'sin responsable'}) rama ${r.rama || '?'}: ${r.zonas.map((z) => z.ruta).join(', ')}`);
  });
}

function comparar(argumentos) {
  const texto = valorDe(argumentos, '--zonas');
  if (!texto) falla('Uso: paralelo.js comparar --zonas "src/auth/,src/lib/a.ts#fn" [--issue POL-1]');
  const repo = repoActual();
  const issuePropio = (valorDe(argumentos, '--issue') || lib.issueDeRama(repo.rama) || '').toUpperCase() || null;
  const cache = lib.leerCache(repo);
  const mias = listaDe(texto).map(claims.zonaDeTexto).filter((z) => z.ruta);
  const hallazgos = claims.buscarChoques(cache, issuePropio, mias);
  if (!cache) console.log('AVISO: no hay caché de reclamos; corre importar-claims antes de comparar.');
  else if (lib.cacheVencida(cache)) console.log('AVISO: la caché de reclamos está vencida; corre importar-claims antes de comparar.');
  lib.reclamosInactivos(cache, issuePropio).forEach((r) => console.log(`AVISO: el reclamo de ${r.issue} está inactivo (más de ${lib.DIAS_INACTIVIDAD} días sin commits en su rama) y se ignora.`));
  if (!hallazgos.length) return console.log(`Sin solape con los reclamos ajenos activos (${lib.reclamosAjenos(cache, issuePropio).length} revisado(s)).`);
  hallazgos.forEach((h) => console.log(claims.formatearChoque(h)));
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

function reclamar(argumentos) {
  const confianza = valorDe(argumentos, '--confianza');
  terminarCon(
    claims.reclamar(repoActual(), {
      issue: valorDe(argumentos, '--issue'),
      responsable: valorDe(argumentos, '--responsable'),
      confianza: confianza === null ? NaN : Number(confianza),
      zonas: listaDe(valorDe(argumentos, '--zonas')),
      compartidos: listaDe(valorDe(argumentos, '--compartidos')),
      porque: valorDe(argumentos, '--porque') || '',
    })
  );
}

function confirmarEnTerminal(texto) {
  const interfaz = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    interfaz.question(`${texto}\nEscribe SI para autorizar: `, (respuesta) => {
      interfaz.close();
      resolve(/^(si|sí)$/i.test(respuesta.trim()));
    });
  });
}

async function autorizar(argumentos) {
  // Primera comprobación, antes de leer nada: el shell de un asistente no tiene terminal interactiva, así que no puede autorizarse solo.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    falla('autorizar solo lo puede correr una persona, en una terminal interactiva. Sin terminal no se cambia nada. Pídele al usuario que lo ejecute él mismo.', 4);
  }
  terminarCon(await claims.ampliar(repoActual(), argumentos.filter((a) => !a.startsWith('--')), { confirmar: confirmarEnTerminal }));
}

const [comando, ...argumentos] = process.argv.slice(2);
switch (comando) {
  case 'importar-claims':
    importarClaims(argumentos);
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
  case 'reclamar':
    reclamar(argumentos);
    break;
  case 'autorizar':
    autorizar(argumentos);
    break;
  case 'liberar':
    terminarCon(claims.liberar(repoActual()));
    break;
  case 'base':
    console.log(ramaBase(repoActual().raiz) || 'sin rama principal');
    break;
  default:
    falla('Comandos: importar-claims | estado | comparar | solapes | crear-worktree | reclamar | autorizar | liberar | base. Ver la cabecera de paralelo.js.');
}
