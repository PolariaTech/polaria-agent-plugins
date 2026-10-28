// Reclamos en CLAIM.md: la única fuente de verdad del plugin trabajo-en-paralelo.
// Cada dev publica en la raíz de su rama un CLAIM.md con las zonas que va a tocar; los demás lo leen de las ramas
// remotas. Este módulo hace tres cosas:
//   1. importarClaims: copia los CLAIM.md de las ramas remotas (y el propio) a la caché local que leen los hooks.
//   2. buscarChoques: cruza zonas contra los reclamos ajenos vigentes.
//   3. reclamar / ampliar / liberar: las únicas formas de crear, ampliar y borrar el CLAIM.md. Cada una registra el
//      hash del archivo que va a commitear (lib.registrarAutorizado) y el pre-commit solo acepta cambios del CLAIM.md
//      cuyo hash esté registrado.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const lib = require('./lib');
const { ramaBase, analizar } = require('./solapes');
const { instalarPreCommit } = require('./instalar-pre-commit');

const MAXIMO_DE_RAMAS = 100;

function lineas(texto) {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

// git que devuelve el error en vez de lanzarlo y conserva stderr (lib.git lo descarta).
function correrGit(raiz, argumentos, timeoutMs = 30000) {
  const r = spawnSync('git', argumentos, { cwd: raiz, encoding: 'utf8', timeout: timeoutMs });
  return { ok: r.status === 0, salida: (r.stdout || '').trim(), error: (r.stderr || '').trim() || (r.error ? r.error.message : '') };
}

// ---------- Lectura de los CLAIM.md ----------

function entradaDeClaim(reclamo, rama, ultimoCommit) {
  return {
    issue: reclamo.issue || lib.issueDeRama(rama) || rama,
    rama: reclamo.rama || rama,
    responsable: reclamo.responsable || '',
    estado: reclamo.estado,
    confianza: reclamo.confianza,
    zonas: reclamo.zonas,
    compartidos: reclamo.compartidos,
    ultimoCommit,
  };
}

// Lee el CLAIM.md de cada rama remota que aún no se mergeó a la principal, más el del árbol de trabajo actual, y
// reescribe la caché. Devuelve { reclamos, avisos }.
function importarClaims(repo, { fetch = true } = {}) {
  const avisos = [];
  if (fetch) {
    const r = correrGit(repo.raiz, ['fetch', '--prune', '--quiet', 'origin'], 30000);
    if (!r.ok) avisos.push('No pude hacer git fetch: los reclamos de las ramas de los demás pueden estar desactualizados.');
  }
  const reclamos = [];
  const base = ramaBase(repo.raiz);
  if (!base) {
    avisos.push('No encontré la rama principal (origin/HEAD, origin/main ni origin/master): no se leyeron las ramas de los demás.');
  } else {
    const ramas = correrGit(repo.raiz, ['branch', '-r', '--no-merged', base, '--format=%(refname:short)']);
    for (const remota of lineas(ramas.salida).slice(0, MAXIMO_DE_RAMAS)) {
      if (remota === base || remota === 'origin' || /\/HEAD$/.test(remota) || remota === `origin/${repo.rama}`) continue;
      const archivo = correrGit(repo.raiz, ['show', `${remota}:${lib.ARCHIVO_RECLAMO}`]);
      if (!archivo.ok) continue; // Rama sin CLAIM.md: no reclama nada.
      const reclamo = lib.parsearReclamo(archivo.salida.replace(/^﻿/, ''));
      if (!reclamo) continue;
      const fecha = correrGit(repo.raiz, ['log', '-1', '--format=%cI', remota]).salida || null;
      reclamos.push(entradaDeClaim(reclamo, remota.replace(/^origin\//, ''), fecha));
    }
  }
  const propio = lib.leerClaimPropio(repo.raiz);
  if (propio) reclamos.push(entradaDeClaim(propio, repo.rama, new Date().toISOString()));
  lib.escribirCache(repo, { sincronizado: new Date().toISOString(), fuente: 'git', reclamos });
  return { reclamos, avisos };
}

function describirZonas(zonas) {
  return zonas.map((z) => z.ruta + (z.funcion ? `#${z.funcion}` : '')).join(', ');
}

function resumenDeImportacion({ reclamos, avisos }, issuePropio) {
  const cache = { reclamos };
  const vigentes = lib.reclamosAjenos(cache, issuePropio);
  const inactivos = lib.reclamosInactivos(cache, issuePropio);
  const salida = [`Caché actualizada: ${vigentes.length} reclamo(s) ajeno(s) vigente(s), ${inactivos.length} inactivo(s) ignorado(s).`];
  vigentes.forEach((r) => salida.push(`  - ${r.issue} (${r.responsable || 'sin responsable'}, ${r.confianza ?? '?'}%): ${describirZonas(r.zonas)}`));
  inactivos.forEach((r) => salida.push(`  - ${r.issue} INACTIVO (más de ${lib.DIAS_INACTIVIDAD} días sin commits en su rama): ${describirZonas(r.zonas)}`));
  avisos.forEach((a) => salida.push(`AVISO: ${a}`));
  return salida.join('\n');
}

// ---------- Cruce de zonas ----------

function zonaDeTexto(texto) {
  const [archivo, funcion] = lib.normalizarRuta(texto.trim()).split('#');
  const esCarpeta = /\/(\*{1,2})?$/.test(archivo);
  return { ruta: archivo, tipo: funcion ? 'funcion' : esCarpeta ? 'carpeta' : 'archivo', funcion: funcion || null };
}

// Cada hallazgo: { reclamo, mia, ajena, nivel }. nivel ZONA frena; COMPARTIDO solo se anota.
function buscarChoques(cache, issuePropio, mias) {
  const hallazgos = [];
  for (const reclamo of lib.reclamosAjenos(cache, issuePropio)) {
    for (const mia of mias) {
      for (const ajena of reclamo.zonas) if (lib.zonasSeSolapan(mia, ajena)) hallazgos.push({ reclamo, mia, ajena, nivel: 'ZONA' });
      for (const ajena of reclamo.compartidos || []) if (lib.zonasSeSolapan(mia, ajena)) hallazgos.push({ reclamo, mia, ajena, nivel: 'COMPARTIDO' });
    }
  }
  return hallazgos;
}

function formatearChoque(h) {
  const funciones = h.mia.funcion && h.ajena.funcion ? (h.mia.funcion === h.ajena.funcion ? ' MISMA FUNCIÓN' : ' (funciones distintas del mismo archivo)') : '';
  const dueno = h.reclamo.responsable ? ` (${h.reclamo.responsable})` : '';
  return `${h.nivel === 'ZONA' ? 'SOLAPE' : 'SOLAPE EN COMPARTIDO'}: tu \`${h.mia.ruta}\` ↔ \`${h.ajena.ruta}\` de ${h.reclamo.issue}${dueno}${funciones}`;
}

// ---------- CLAIM.md: texto ----------

function rutaValida(ruta) {
  return Boolean(ruta) && ruta !== '/' && !/(^|\/)\.\.(\/|$)/.test(ruta) && !/[`\n\r]/.test(ruta) && !/^[a-zA-Z]:/.test(ruta);
}

function construirClaim({ issue, rama, responsable, confianza, zonas, compartidos = [], porque = '', nuevos = [], carpetasPermitidas = [] }) {
  const nota = (r) => (nuevos.includes(r) ? ' — archivo nuevo' : carpetasPermitidas.includes(r) ? ' — carpeta (excepción)' : '');
  const lista = (rutas) => (rutas.length ? rutas.map((r) => `- \`${r}\`${nota(r)}`).join('\n') : 'Ninguno.');
  return [
    '<!-- polaria-reclamo v1 -->',
    '## 🔒 Reclamo de trabajo en paralelo',
    '',
    '**Estado:** ACTIVO',
    `**Issue:** ${issue}`,
    `**Rama:** ${rama}`,
    `**Responsable:** ${responsable || 'sin responsable'}`,
    `**Confianza:** ${confianza}%`,
    '',
    '### Zonas que voy a tocar',
    lista(zonas),
    '',
    '### Compartidos (cambio mínimo y aviso)',
    lista(compartidos),
    '',
    '### Por qué',
    porque || 'Sin detalle.',
    '',
  ].join('\n');
}

// Inserta las rutas al final de la sección "Zonas que voy a tocar", sin tocar el resto del archivo.
function agregarZonas(cuerpo, rutas, fecha) {
  const filas = cuerpo.split(/\r?\n/);
  const inicio = filas.findIndex((l) => /^#{2,4}\s*Zonas que voy a tocar/i.test(l.trim()));
  if (inicio === -1) throw new Error('El CLAIM.md no tiene la sección "Zonas que voy a tocar".');
  let fin = filas.length;
  for (let i = inicio + 1; i < filas.length; i += 1) {
    if (/^#{1,4}\s/.test(filas[i].trim())) {
      fin = i;
      break;
    }
  }
  while (fin > inicio + 1 && filas[fin - 1].trim() === '') fin -= 1;
  filas.splice(fin, 0, ...rutas.map((r) => `- \`${r}\` — autorizada por el usuario el ${fecha}`));
  return filas.join('\n');
}

// ---------- Operaciones ----------

function publicar(repo, mensaje, { subir = true } = {}) {
  const commit = correrGit(repo.raiz, ['commit', '-q', '-m', mensaje, '--', lib.ARCHIVO_RECLAMO], 60000);
  if (!commit.ok) return { ok: false, paso: 'commit', error: commit.error || 'git commit falló' };
  if (!subir) return { ok: true, subido: false };
  const push = correrGit(repo.raiz, ['push', '-u', 'origin', repo.rama], 90000);
  if (!push.ok) return { ok: true, subido: false, errorPush: push.error || 'git push falló' };
  return { ok: true, subido: true };
}

// Crea el CLAIM.md de la rama: el primer commit de la rama y su primer push. Se detiene sin escribir nada si alguna
// zona choca con el reclamo vigente de otra rama.
function reclamar(repo, { issue, responsable, confianza, zonas, compartidos = [], porque = '', nuevos = [], permitirCarpetas = false }) {
  const issueFinal = (issue || lib.issueDeRama(repo.rama) || '').toUpperCase();
  if (!issueFinal) return { codigo: 2, mensaje: 'La rama no trae un ID de ticket (por ejemplo usuario/pol-123-titulo o usuario/req-012-titulo) y no pasaste --issue.' };
  if (!repo.rama) return { codigo: 2, mensaje: 'Estás en HEAD suelto: cambia a la rama del ticket antes de reclamar.' };
  if (fs.existsSync(lib.rutaDelClaim(repo.raiz))) return { codigo: 2, mensaje: 'Esta rama ya tiene un CLAIM.md. Para ampliarlo, el usuario debe correr "paralelo.js autorizar <ruta>" en su terminal.' };
  const listaZonas = (zonas || []).map((z) => lib.normalizarRuta(z.trim())).filter(Boolean);
  const listaCompartidos = (compartidos || []).map((z) => lib.normalizarRuta(z.trim())).filter(Boolean);
  if (!listaZonas.length) return { codigo: 2, mensaje: 'Falta --zonas: lista al menos una zona.' };
  const invalida = [...listaZonas, ...listaCompartidos].find((z) => !rutaValida(z.split('#')[0]));
  if (invalida) return { codigo: 2, mensaje: `Ruta no válida: "${invalida}". Usa rutas relativas a la raíz del repo, sin "..", sin "/" a secas y sin comillas invertidas.` };
  const listaNuevos = (nuevos || []).map((z) => lib.normalizarRuta(z.trim())).filter(Boolean);
  const carpetas = listaZonas.filter((z) => zonaDeTexto(z).tipo === 'carpeta');
  if (carpetas.length && !permitirCarpetas) {
    return { codigo: 2, mensaje: `El reclamo debe listar archivos exactos, no carpetas: ${carpetas.join(', ')}. Lista cada archivo con Glob (código, pruebas, tipos, fixtures, documentación). Si de verdad no se puede saber (por ejemplo, archivos generados), repite con --permitir-carpetas y explica el motivo en --porque.` };
  }
  if (carpetas.length && !porque.trim()) return { codigo: 2, mensaje: 'Con --permitir-carpetas, --porque debe explicar por qué no se pueden listar los archivos.' };
  const rutasDeArchivo = listaZonas.filter((z) => zonaDeTexto(z).tipo !== 'carpeta').map((z) => z.split('#')[0]);
  const yaExisten = listaNuevos.filter((r) => fs.existsSync(path.join(repo.raiz, r)));
  if (yaExisten.length) return { codigo: 2, mensaje: `Estos archivos ya existen y no pueden ir en --nuevos: ${yaExisten.join(', ')}.` };
  const sinExistir = [...new Set(rutasDeArchivo)].filter((r) => !fs.existsSync(path.join(repo.raiz, r)) && !listaNuevos.includes(r));
  if (sinExistir.length) {
    return { codigo: 2, mensaje: `Estas rutas no existen en el repo: ${sinExistir.join(', ')}. Si el ticket pide crearlas, pásalas también en --nuevos "ruta1,ruta2"; si no, corrige la ruta.` };
  }
  const sobrantes = listaNuevos.filter((r) => !rutasDeArchivo.includes(r));
  if (sobrantes.length) return { codigo: 2, mensaje: `--nuevos trae rutas que no están en --zonas: ${sobrantes.join(', ')}.` };
  if (!Number.isInteger(confianza) || confianza < 1 || confianza > 100) return { codigo: 2, mensaje: 'Falta --confianza: un número entero entre 1 y 100.' };

  const importacion = importarClaims(repo, { fetch: true });
  const choques = buscarChoques({ reclamos: importacion.reclamos }, issueFinal, listaZonas.map(zonaDeTexto));
  const frenos = choques.filter((c) => c.nivel === 'ZONA');
  if (frenos.length) {
    return {
      codigo: 3,
      mensaje: [...choques.map(formatearChoque), 'No reclamé nada: una zona choca con el reclamo vigente de otra rama. Coordina con esa persona o toma otro ticket.'].join('\n'),
    };
  }

  const preCommit = instalarPreCommit(repo.raiz);
  const texto = construirClaim({ issue: issueFinal, rama: repo.rama, responsable, confianza, zonas: listaZonas, compartidos: listaCompartidos, porque, nuevos: listaNuevos, carpetasPermitidas: carpetas });
  fs.writeFileSync(lib.rutaDelClaim(repo.raiz), texto);
  lib.registrarAutorizado(repo, lib.hashDeClaim(texto));
  const agregado = correrGit(repo.raiz, ['add', '--', lib.ARCHIVO_RECLAMO]);
  if (!agregado.ok) {
    fs.rmSync(lib.rutaDelClaim(repo.raiz), { force: true });
    return { codigo: 2, mensaje: `git add falló: ${agregado.error}` };
  }
  const resultado = publicar(repo, `claim(${issueFinal}): reclama las zonas del ticket`);
  if (!resultado.ok) {
    correrGit(repo.raiz, ['reset', '-q', '--', lib.ARCHIVO_RECLAMO]);
    fs.rmSync(lib.rutaDelClaim(repo.raiz), { force: true });
    return { codigo: 2, mensaje: `No pude crear el commit del reclamo (${resultado.paso}): ${resultado.error}` };
  }
  const salida = [`CLAIM.md creado y commiteado en ${repo.rama}: ${listaZonas.length} zona(s), ${listaCompartidos.length} compartido(s), confianza ${confianza}%.`];
  choques.forEach((c) => salida.push(`${formatearChoque(c)} (solo se anota)`));
  if (preCommit.aviso) salida.push(`AVISO: ${preCommit.aviso}`);
  importarClaims(repo, { fetch: false });
  if (resultado.subido) return { codigo: 0, mensaje: [...salida, `Rama publicada: origin/${repo.rama}. Desde ahora los demás ven este reclamo.`].join('\n') };
  return {
    codigo: 5,
    mensaje: [...salida, `El commit quedó local pero el push falló: ${resultado.errorPush}`, 'Hasta que la rama se publique, los demás NO ven este reclamo. Corrige el error y haz git push -u origin ' + repo.rama + '.'].join('\n'),
  };
}

// Amplía el CLAIM.md con rutas nuevas. `confirmar(texto)` devuelve (una promesa de) true solo si una persona lo
// autoriza; el CLI lo conecta a una terminal interactiva. Se detiene antes de pedir confirmación si hay un choque.
async function ampliar(repo, rutas, { confirmar }) {
  const claim = lib.leerClaimPropio(repo.raiz);
  if (!claim) return { codigo: 2, mensaje: 'Esta rama no tiene un CLAIM.md: primero hay que reclamar con "paralelo.js reclamar".' };
  const issue = claim.issue || lib.issueDeRama(repo.rama) || repo.rama;
  const nuevas = (rutas || []).map((r) => lib.normalizarRuta(String(r).trim())).filter(Boolean);
  if (!nuevas.length) return { codigo: 2, mensaje: 'Uso: paralelo.js autorizar <ruta> [<ruta>...] (carpetas terminadas en /).' };
  const invalida = nuevas.find((r) => !rutaValida(r.split('#')[0]));
  if (invalida) return { codigo: 2, mensaje: `Ruta no válida: "${invalida}".` };
  const faltantes = nuevas.filter((r) => !lib.claimCubreArchivo(claim, r.split('#')[0]));
  if (!faltantes.length) return { codigo: 0, mensaje: 'Todas esas rutas ya están dentro de lo que reclamaste: no hay nada que ampliar.' };

  const importacion = importarClaims(repo, { fetch: true });
  const choques = buscarChoques({ reclamos: importacion.reclamos }, issue, faltantes.map(zonaDeTexto));
  if (choques.some((c) => c.nivel === 'ZONA')) {
    return { codigo: 3, mensaje: [...choques.map(formatearChoque), 'No amplié nada: choca con el reclamo vigente de otra rama. Coordina con esa persona o toma otro ticket.'].join('\n') };
  }

  const texto = `Vas a ampliar el reclamo de ${issue} con: ${faltantes.join(', ')}. Se publicará el nuevo alcance en origin/${repo.rama}.`;
  if (!(await confirmar(texto))) return { codigo: 1, mensaje: 'Cancelado: no se cambió nada.' };

  let nuevoCuerpo;
  try {
    nuevoCuerpo = agregarZonas(claim.cuerpo, faltantes, new Date().toISOString().slice(0, 10));
  } catch (error) {
    return { codigo: 2, mensaje: error.message };
  }
  const anterior = claim.cuerpo;
  fs.writeFileSync(lib.rutaDelClaim(repo.raiz), nuevoCuerpo);
  lib.registrarAutorizado(repo, lib.hashDeClaim(nuevoCuerpo));
  const agregado = correrGit(repo.raiz, ['add', '--', lib.ARCHIVO_RECLAMO]);
  const resultado = agregado.ok ? publicar(repo, `claim(${issue}): amplía el alcance con ${faltantes.join(', ')}`) : { ok: false, paso: 'add', error: agregado.error };
  if (!resultado.ok) {
    correrGit(repo.raiz, ['reset', '-q', '--', lib.ARCHIVO_RECLAMO]);
    fs.writeFileSync(lib.rutaDelClaim(repo.raiz), anterior);
    return { codigo: 2, mensaje: `No pude crear el commit de la ampliación (${resultado.paso}): ${resultado.error}` };
  }
  const salida = [`CLAIM.md ampliado con ${faltantes.join(', ')} (commit local hecho).`];
  const nueva = importarClaims(repo, { fetch: resultado.subido });
  const despues = buscarChoques({ reclamos: nueva.reclamos }, issue, faltantes.map(zonaDeTexto)).filter((c) => c.nivel === 'ZONA');
  despues.forEach((c) => salida.push(`AVISO: después de publicar apareció un solape: ${formatearChoque(c)}. Coordina con esa persona.`));
  if (!resultado.subido) {
    salida.push(`El push falló: ${resultado.errorPush}. Hasta que se publique, los demás NO ven la ampliación.`);
    return { codigo: 5, mensaje: salida.join('\n') };
  }
  salida.push(`Nuevo alcance publicado en origin/${repo.rama}.`);
  return { codigo: 0, mensaje: salida.join('\n') };
}

// Borra el CLAIM.md con un commit y un push. El resultado (archivos dentro de lo reclamado) queda en el mensaje.
function liberar(repo) {
  const claim = lib.leerClaimPropio(repo.raiz);
  if (!claim) return { codigo: 2, mensaje: 'Esta rama no tiene un CLAIM.md: no hay nada que liberar.' };
  const issue = claim.issue || lib.issueDeRama(repo.rama) || repo.rama;
  const analisis = analizar(repo.raiz, { fetch: false });
  const total = analisis ? analisis.archivosPropios.length : 0;
  const dentro = total - (analisis ? analisis.fueraDelReclamo.length : 0);
  const confianza = claim.confianza === null ? '?' : claim.confianza;
  const mensaje = `claim(${issue}): libera el reclamo (${dentro} de ${total} archivos dentro de lo reclamado; confianza declarada ${confianza}%)`;

  lib.registrarAutorizado(repo, lib.HASH_ELIMINADO);
  const quitado = correrGit(repo.raiz, ['rm', '-q', '--', lib.ARCHIVO_RECLAMO]);
  if (!quitado.ok) return { codigo: 2, mensaje: `git rm falló: ${quitado.error}` };
  const resultado = publicar(repo, mensaje);
  if (!resultado.ok) {
    correrGit(repo.raiz, ['reset', '-q', 'HEAD', '--', lib.ARCHIVO_RECLAMO]);
    correrGit(repo.raiz, ['checkout', '--', lib.ARCHIVO_RECLAMO]);
    return { codigo: 2, mensaje: `No pude crear el commit de la liberación (${resultado.paso}): ${resultado.error}` };
  }
  importarClaims(repo, { fetch: false });
  const salida = [`Reclamo de ${issue} liberado: ${dentro} de ${total} archivos dentro de lo reclamado (confianza declarada ${confianza}%).`];
  if (!resultado.subido) {
    salida.push(`El commit quedó local pero el push falló: ${resultado.errorPush}. Hasta publicarlo, los demás siguen viendo el reclamo.`);
    return { codigo: 5, mensaje: salida.join('\n') };
  }
  salida.push(`Publicado en origin/${repo.rama}: el CLAIM.md ya no está en la rama.`);
  return { codigo: 0, mensaje: salida.join('\n') };
}

module.exports = {
  importarClaims,
  resumenDeImportacion,
  zonaDeTexto,
  buscarChoques,
  formatearChoque,
  construirClaim,
  agregarZonas,
  rutaValida,
  reclamar,
  ampliar,
  liberar,
};
