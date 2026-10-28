#!/usr/bin/env node
// CLI de la skill trabajo-en-paralelo-polaria. Desde cualquier carpeta del repo:
//   node paralelo.js importar-claims [--sin-fetch]
//                                              Copia a la caché local el CLAIM.md de cada rama remota (y el propio).
//   node paralelo.js estado                    Muestra qué hay en la caché y qué antigüedad tiene.
//   node paralelo.js comparar --zonas "a/,b.ts#fn" [--issue POL-1]
//                                              Cruza las zonas que se piensa reclamar con los reclamos ajenos.
//   node paralelo.js solapes [--sin-fetch]     Chequea la rama actual contra las ramas y reclamos de los demás.
//   node paralelo.js iniciar-rama <rama> [--pausar]
//                                              Cambia a la rama del ticket dentro del mismo proyecto (nueva desde la principal, sin tracking).
//                                              Códigos: 6 hay cambios sin guardar, 7 la rama actual tiene un reclamo activo.
//   node paralelo.js reclamar --zonas "a/,b.ts" --confianza 80 [--compartidos "package.json"] [--responsable R]
//                             [--issue POL-1] [--porque "texto"]
//                                              Crea el CLAIM.md, lo commitea y publica la rama. Se detiene si choca.
//   node paralelo.js autorizar <ruta>...       Amplía el CLAIM.md. SOLO lo corre una persona: pide confirmación en una
//                                              terminal interactiva; sin terminal no hace nada.
//   node paralelo.js liberar [--volver]        Borra el CLAIM.md (commit y push) y deja el resultado en el mensaje. Con --volver,
//                                              vuelve a la rama principal y borra la rama local si ya está mergeada.
//   node paralelo.js base                      Imprime la rama principal (origin/main, origin/master...).
// Salida siempre en texto. Códigos: 0 bien, 1 cancelado por el usuario, 2 error de uso, 3 choca con otra rama,
// 4 falta una terminal interactiva, 5 el commit quedó pero el push falló, 6 hay cambios sin guardar, 7 la rama actual tiene un reclamo activo.

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

// Cambia de rama dentro del mismo proyecto (sin carpetas nuevas): la rama del ticket sale de la principal, sin tracking.
// Se detiene con el árbol sucio (6) o si la rama actual tiene un reclamo activo de otro ticket (7), salvo --pausar.
function iniciarRama(argumentos) {
  const rama = argumentos.find((a) => !a.startsWith('--'));
  if (!rama || !/^[\w./-]+$/.test(rama)) falla('Uso: paralelo.js iniciar-rama <rama> [--pausar] (solo letras, números, ., _, - y /).');
  const repo = repoActual();
  if (repo.rama === rama) return console.log(`Ya estás en ${rama}: no hay nada que cambiar.`);
  let sucio = '';
  try {
    sucio = lib.git(repo.raiz, ['status', '--porcelain']);
  } catch (error) {
    falla(`No pude leer el estado de git: ${error.message}`);
  }
  if (sucio) falla(`Hay cambios sin guardar en ${repo.rama || 'HEAD suelto'}. Haz commit o guárdalos antes de cambiar de rama:\n${sucio}`, 6);
  const claimActual = repo.rama ? lib.leerClaimPropio(repo.raiz) : null;
  if (claimActual && claimActual.estado === 'ACTIVO' && !argumentos.includes('--pausar')) {
    falla(`La rama ${repo.rama} tiene un reclamo activo (${claimActual.issue || 'sin ticket'}). Pregúntale al dev si ese trabajo terminó (paralelo.js liberar --volver, y luego repite este comando) o si lo deja pausado (repite este comando con --pausar: el reclamo sigue vigente).`, 7);
  }
  try {
    lib.git(repo.raiz, ['fetch', '--prune', '--quiet', 'origin'], { timeoutMs: 30000 });
  } catch {
    process.stderr.write('AVISO: no pude hacer git fetch; la rama sale de la última copia local de la rama principal.\n');
  }
  const base = ramaBase(repo.raiz);
  if (!base) falla('No encontré la rama principal (origin/HEAD, origin/main ni origin/master).');
  const existe = (ref) => {
    try {
      lib.git(repo.raiz, ['rev-parse', '--verify', '-q', ref]);
      return true;
    } catch {
      return false;
    }
  };
  const local = existe(`refs/heads/${rama}`);
  const remota = existe(`refs/remotes/origin/${rama}`);
  // --no-track: sin esto la rama nueva queda siguiendo a origin/main y un push iría a la rama principal.
  const argumentosGit = local ? ['switch', rama] : remota ? ['switch', '--track', `origin/${rama}`] : ['switch', '--no-track', '-c', rama, base];
  try {
    lib.git(repo.raiz, argumentosGit, { timeoutMs: 60000 });
  } catch (error) {
    falla(`git switch falló: ${error.message}`);
  }
  console.log(`Rama activa: ${rama} ${local ? '(ya existía)' : remota ? '(traída de origin)' : `(nueva, desde ${base}, sin tracking)`}. Carpeta: ${repo.raiz}`);
}

// Tras liberar: vuelve a la rama principal en el mismo proyecto y borra la rama local si ya está mergeada.
function volverALaPrincipal(repo) {
  const base = ramaBase(repo.raiz);
  if (!base) return console.log('AVISO: no encontré la rama principal; te quedas en la rama actual.');
  const principal = base.replace(/^origin\//, '');
  const anterior = repo.rama;
  try {
    lib.git(repo.raiz, ['fetch', '--prune', '--quiet', 'origin'], { timeoutMs: 30000 });
  } catch {
    // Sin red: se vuelve igual con la copia local.
  }
  try {
    lib.git(repo.raiz, ['switch', principal], { timeoutMs: 60000 });
  } catch (error) {
    return console.log(`AVISO: no pude volver a ${principal} (${error.message.split('\n')[0]}); te quedas en ${anterior}.`);
  }
  try {
    lib.git(repo.raiz, ['merge', '--ff-only', '--quiet', base], { timeoutMs: 60000 });
  } catch {
    // Principal local desactualizada y no avanzable: no es grave.
  }
  console.log(`Ahora estás en ${principal}.`);
  try {
    // Mergeada a la principal (no basta con estar subida a su remota, que es lo que acepta "branch -d" por sí solo).
    lib.git(repo.raiz, ['merge-base', '--is-ancestor', anterior, principal]);
    lib.git(repo.raiz, ['branch', '-d', anterior]);
    console.log(`Rama local ${anterior} borrada (ya estaba mergeada).`);
  } catch {
    console.log(`La rama local ${anterior} se conserva: aún no está mergeada a ${principal}.`);
  }
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

function liberarYVolver(argumentos) {
  const repo = repoActual();
  const resultado = claims.liberar(repo);
  if (resultado.codigo !== 0 || !argumentos.includes('--volver')) return terminarCon(resultado);
  console.log(resultado.mensaje);
  volverALaPrincipal(repo);
  process.exit(0);
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
  case 'iniciar-rama':
    iniciarRama(argumentos);
    break;
  case 'reclamar':
    reclamar(argumentos);
    break;
  case 'autorizar':
    autorizar(argumentos);
    break;
  case 'liberar':
    liberarYVolver(argumentos);
    break;
  case 'base':
    console.log(ramaBase(repoActual().raiz) || 'sin rama principal');
    break;
  default:
    falla('Comandos: importar-claims | estado | comparar | solapes | iniciar-rama | reclamar | autorizar | liberar | base. Ver la cabecera de paralelo.js.');
}
