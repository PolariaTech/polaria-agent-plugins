// Librería compartida del plugin trabajo-en-paralelo: git, caché de reclamos, lectura del CLAIM.md y cruce de zonas.
// La usan scripts/paralelo.js (CLI de la skill), los hooks y el pre-commit.
//
// La única fuente de verdad de los reclamos es el CLAIM.md que cada dev publica en su rama. Los hooks no pueden hacer
// git fetch en cada edición, así que la skill (paralelo.js importar-claims) copia los CLAIM.md de las ramas remotas a
// <git-common-dir>/polaria-paralelo/reclamos.json (fuera del árbol de trabajo, compartido por todas las ramas del repo) y
// los hooks leen de ahí.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MARCADOR = '<!-- polaria-reclamo v1 -->';
const REGEX_ISSUE = /([a-z][a-z0-9]*-\d+)/i;
const EDAD_MAXIMA_CACHE_HORAS = 4;
const ARCHIVO_RECLAMO = 'CLAIM.md';
// Un reclamo cuya rama lleva más de estos días sin commits está inactivo y deja de contar.
const DIAS_INACTIVIDAD = 5;
// Una autorización (hash del CLAIM.md que escribió el CLI) sirve para un commit en este lapso.
const MINUTOS_VIGENCIA_AUTORIZACION = 10;
const HASH_ELIMINADO = 'ELIMINADO';

function git(directorio, argumentos, opciones = {}) {
  return execFileSync('git', argumentos, {
    cwd: directorio,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: opciones.timeoutMs || 15000,
  }).trim();
}

// Devuelve null si el directorio no está dentro de un repo git.
function infoDelRepo(directorio) {
  try {
    const raiz = git(directorio, ['rev-parse', '--show-toplevel']);
    const comun = path.resolve(directorio, git(directorio, ['rev-parse', '--git-common-dir']));
    let rama = '';
    try {
      rama = git(directorio, ['symbolic-ref', '--short', '-q', 'HEAD']);
    } catch {
      rama = ''; // HEAD suelto.
    }
    return { raiz, directorioComun: comun, directorioCache: path.join(comun, 'polaria-paralelo'), rama };
  } catch {
    return null;
  }
}

// Linear genera ramas como "usuario/pol-123-titulo": el issue sale de la primera coincidencia.
function issueDeRama(rama) {
  const coincidencia = REGEX_ISSUE.exec(rama || '');
  return coincidencia ? coincidencia[1].toUpperCase() : null;
}

function normalizarRuta(ruta) {
  return String(ruta).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

// Forma real de una ruta aunque el archivo aún no exista: resuelve el ancestro que sí existe (nombres cortos 8.3 de
// Windows como RUNNER~1, enlaces simbólicos, junctions) y le vuelve a pegar el resto. Sin esto, git entrega la raíz
// del repo con el nombre largo y el editor el archivo con el corto, y el archivo parece estar fuera del repo.
function rutaReal(ruta) {
  let actual = path.resolve(ruta);
  const resto = [];
  while (!fs.existsSync(actual)) {
    const padre = path.dirname(actual);
    if (padre === actual) return path.resolve(ruta);
    resto.unshift(path.basename(actual));
    actual = padre;
  }
  try {
    return path.join(fs.realpathSync.native(actual), ...resto);
  } catch {
    return path.resolve(ruta);
  }
}

function rutaRelativaAlRepo(raiz, rutaAbsolutaORelativa) {
  const normalizada = String(rutaAbsolutaORelativa).replace(/^\/([a-zA-Z]:)/, '$1');
  const absoluta = path.isAbsolute(normalizada) ? normalizada : path.join(raiz, normalizada);
  return normalizarRuta(path.relative(raiz, absoluta));
}

// ---------- Reclamo ----------

function seccion(cuerpo, titulo) {
  const lineas = cuerpo.split(/\r?\n/);
  const inicio = lineas.findIndex((linea) => new RegExp(`^#{2,4}\\s*${titulo}`, 'i').test(linea.trim()));
  if (inicio === -1) return [];
  const resultado = [];
  for (const linea of lineas.slice(inicio + 1)) {
    if (/^#{1,4}\s/.test(linea.trim())) break;
    resultado.push(linea);
  }
  return resultado;
}

// "- `src/auth/` — carpeta" -> { ruta: 'src/auth/', tipo: 'carpeta' }; "src/a.ts#fn" -> tipo función.
function parsearZonas(lineas) {
  const zonas = [];
  for (const linea of lineas) {
    const coincidencia = /^\s*[-*]\s*`([^`]+)`/.exec(linea);
    if (!coincidencia) continue;
    const bruta = normalizarRuta(coincidencia[1].trim());
    const [archivo, funcion] = bruta.split('#');
    const esCarpeta = /\/(\*{1,2})?$/.test(archivo);
    zonas.push({
      ruta: archivo,
      tipo: funcion ? 'funcion' : esCarpeta ? 'carpeta' : 'archivo',
      funcion: funcion || null,
    });
  }
  return zonas;
}

// Devuelve null si el comentario no es un reclamo.
function parsearReclamo(cuerpo) {
  if (!cuerpo || !cuerpo.includes(MARCADOR)) return null;
  const campo = (nombre) => {
    const coincidencia = new RegExp(`\\*\\*${nombre}:\\*\\*\\s*(.+)`, 'i').exec(cuerpo);
    return coincidencia ? coincidencia[1].trim().replace(/^`|`$/g, '') : '';
  };
  const confianza = /(\d{1,3})\s*%/.exec(campo('Confianza'));
  const issue = REGEX_ISSUE.exec(campo('Issue'));
  return {
    issue: issue ? issue[1].toUpperCase() : '',
    estado: /liberado/i.test(campo('Estado')) ? 'LIBERADO' : 'ACTIVO',
    rama: campo('Rama'),
    responsable: campo('Responsable'),
    confianza: confianza ? Number(confianza[1]) : null,
    zonas: parsearZonas(seccion(cuerpo, 'Zonas que voy a tocar')),
    compartidos: parsearZonas(seccion(cuerpo, 'Compartidos')),
  };
}

// ---------- Cruce de zonas ----------

function prefijoDeCarpeta(ruta) {
  return ruta.replace(/\/?\*{0,2}$/, '').replace(/\/$/, '');
}

function zonaCubre(zona, archivo) {
  const destino = normalizarRuta(archivo);
  if (zona.tipo === 'carpeta') {
    const prefijo = prefijoDeCarpeta(zona.ruta);
    return prefijo === '' || destino === prefijo || destino.startsWith(`${prefijo}/`);
  }
  return destino === zona.ruta; // archivo o función: se compara el archivo.
}

function zonasSeSolapan(a, b) {
  if (a.tipo === 'carpeta' && b.tipo === 'carpeta') {
    const pa = prefijoDeCarpeta(a.ruta);
    const pb = prefijoDeCarpeta(b.ruta);
    return pa === '' || pb === '' || pa === pb || pa.startsWith(`${pb}/`) || pb.startsWith(`${pa}/`);
  }
  if (a.tipo === 'carpeta') return zonaCubre(a, b.ruta);
  if (b.tipo === 'carpeta') return zonaCubre(b, a.ruta);
  return a.ruta === b.ruta;
}

// ---------- Caché ----------

function rutaCache(repo) {
  return path.join(repo.directorioCache, 'reclamos.json');
}

function leerCache(repo) {
  try {
    return JSON.parse(fs.readFileSync(rutaCache(repo), 'utf8'));
  } catch {
    return null;
  }
}

function escribirCache(repo, contenido) {
  fs.mkdirSync(repo.directorioCache, { recursive: true });
  fs.writeFileSync(rutaCache(repo), JSON.stringify(contenido, null, 2));
}

function edadDeCacheEnHoras(cache) {
  if (!cache || !cache.sincronizado) return Infinity;
  return (Date.now() - new Date(cache.sincronizado).getTime()) / 3600000;
}

function cacheVencida(cache) {
  return edadDeCacheEnHoras(cache) > EDAD_MAXIMA_CACHE_HORAS;
}

function estaInactivo(reclamo, ahora = Date.now()) {
  if (!reclamo || !reclamo.ultimoCommit) return false;
  const dias = (ahora - new Date(reclamo.ultimoCommit).getTime()) / 86400000;
  return Number.isFinite(dias) && dias > DIAS_INACTIVIDAD;
}

// Un reclamo cuenta mientras esté ACTIVO y su rama haya recibido un commit en los últimos DIAS_INACTIVIDAD días.
function estaVigente(reclamo, ahora) {
  return reclamo.estado === 'ACTIVO' && !estaInactivo(reclamo, ahora);
}

function reclamosAjenos(cache, issuePropio) {
  if (!cache || !Array.isArray(cache.reclamos)) return [];
  return cache.reclamos.filter((r) => estaVigente(r) && r.issue !== issuePropio);
}

// Reclamos de otros que no cuentan por inactividad: se mencionan para que el dev sepa que se ignoraron.
function reclamosInactivos(cache, issuePropio) {
  if (!cache || !Array.isArray(cache.reclamos)) return [];
  return cache.reclamos.filter((r) => r.estado === 'ACTIVO' && estaInactivo(r) && r.issue !== issuePropio);
}

function reclamoPropio(cache, issuePropio) {
  if (!cache || !Array.isArray(cache.reclamos) || !issuePropio) return null;
  return cache.reclamos.find((r) => r.estado === 'ACTIVO' && r.issue === issuePropio) || null;
}

// ---------- CLAIM.md propio y autorizaciones ----------

function rutaDelClaim(raiz) {
  return path.join(raiz, ARCHIVO_RECLAMO);
}

// El CLAIM.md del árbol de trabajo de esta rama, ya interpretado; null si no existe o no tiene formato de reclamo.
function leerClaimPropio(raiz) {
  try {
    const cuerpo = fs.readFileSync(rutaDelClaim(raiz), 'utf8').replace(/^﻿/, '');
    const reclamo = parsearReclamo(cuerpo);
    return reclamo ? { ...reclamo, cuerpo } : null;
  } catch {
    return null;
  }
}

function claimCubreArchivo(claim, archivo) {
  return [...claim.zonas, ...(claim.compartidos || [])].some((zona) => zonaCubre(zona, archivo));
}

function hashDeClaim(texto) {
  return crypto.createHash('sha256').update(String(texto).replace(/\r\n/g, '\n')).digest('hex');
}

function rutaAutorizados(repo) {
  return path.join(repo.directorioCache, 'autorizados.json');
}

function leerAutorizados(repo) {
  try {
    const ahora = Date.now();
    const lista = JSON.parse(fs.readFileSync(rutaAutorizados(repo), 'utf8')).autorizados;
    return Array.isArray(lista) ? lista.filter((a) => a && ahora - a.ts < MINUTOS_VIGENCIA_AUTORIZACION * 60000) : [];
  } catch {
    return [];
  }
}

// El CLI (reclamar, autorizar, liberar) registra aquí el hash del CLAIM.md que va a commitear; el pre-commit solo
// acepta un cambio del CLAIM.md si su hash está registrado y vigente. Así un CLAIM.md escrito a mano no pasa.
function registrarAutorizado(repo, hash) {
  const lista = leerAutorizados(repo).concat([{ hash, ts: Date.now() }]);
  fs.mkdirSync(repo.directorioCache, { recursive: true });
  fs.writeFileSync(rutaAutorizados(repo), JSON.stringify({ autorizados: lista }));
}

function estaAutorizado(repo, hash) {
  return leerAutorizados(repo).some((a) => a.hash === hash);
}

// ---------- Entrada y salida de los hooks ----------

function modoBloquear() {
  return /^bloquear$/i.test(process.env.POLARIA_PARALELO_MODO || '');
}

function esCursor() {
  return Boolean(process.env.CURSOR_VERSION);
}

// Lee el evento JSON de stdin. Si no llega JSON válido, entrega {}: un hook de aviso nunca debe romper la sesión.
function leerEvento(alTerminar) {
  let entrada = '';
  let listo = false;
  const terminar = (evento) => {
    if (listo) return;
    listo = true;
    alTerminar(evento);
  };
  process.stdin.on('data', (fragmento) => {
    entrada += fragmento;
    try {
      terminar(JSON.parse(entrada.replace(/^\uFEFF/, '')));
    } catch {
      // Falta parte del JSON; se espera más entrada.
    }
  });
  process.stdin.on('end', () => {
    try {
      terminar(JSON.parse(entrada.replace(/^\uFEFF/, '')));
    } catch {
      terminar({});
    }
  });
}

// Cursor entrega workspace_roots como ruta de URI ("/d:/WORK/repo"), que Node no acepta en Windows.
function directorioDelEvento(evento) {
  const raiz = evento.workspace_roots && evento.workspace_roots[0] && evento.workspace_roots[0].replace(/^\/([a-zA-Z]:)/, '$1');
  return evento.cwd || process.env.CURSOR_PROJECT_DIR || raiz || process.cwd();
}

function directorioExistente(ruta) {
  let actual = path.dirname(ruta);
  while (actual && !fs.existsSync(actual)) {
    const padre = path.dirname(actual);
    if (padre === actual) return null;
    actual = padre;
  }
  return actual;
}

// Archivo que el evento de edición va a tocar, ya resuelto contra el repo al que pertenece (no al de la sesión: el
// asistente puede editar en un worktree distinto de su cwd). Devuelve null si el evento no trae archivo;
// { real, repo: null, relativa: null } si cae fuera de un repo; relativa es null también dentro de .git.
function resolverArchivoDeEdicion(evento) {
  const entrada = evento.tool_input || {};
  const archivo = entrada.file_path || entrada.path || entrada.target_file || entrada.notebook_path || evento.file_path;
  if (!archivo) return null;
  const limpia = String(archivo).replace(/^\/([a-zA-Z]:)/, '$1');
  const absoluta = path.isAbsolute(limpia) ? limpia : path.join(directorioDelEvento(evento), archivo);
  const real = rutaReal(absoluta);
  const directorio = directorioExistente(real);
  const repo = directorio && infoDelRepo(directorio);
  if (!repo) return { real, repo: null, relativa: null };
  const relativa = rutaRelativaAlRepo(rutaReal(repo.raiz), real);
  return { real, repo, relativa: relativa.startsWith('..') || relativa.startsWith('.git/') ? null : relativa };
}

function salir(codigo, salida) {
  if (salida === undefined) process.exit(codigo);
  process.exitCode = codigo;
  process.stdout.write(JSON.stringify(salida), () => process.exit(codigo));
}

module.exports = {
  MARCADOR,
  REGEX_ISSUE,
  git,
  infoDelRepo,
  issueDeRama,
  normalizarRuta,
  rutaReal,
  rutaRelativaAlRepo,
  parsearReclamo,
  zonaCubre,
  zonasSeSolapan,
  rutaCache,
  leerCache,
  escribirCache,
  edadDeCacheEnHoras,
  cacheVencida,
  reclamosAjenos,
  reclamosInactivos,
  reclamoPropio,
  estaInactivo,
  estaVigente,
  ARCHIVO_RECLAMO,
  DIAS_INACTIVIDAD,
  HASH_ELIMINADO,
  rutaDelClaim,
  leerClaimPropio,
  claimCubreArchivo,
  hashDeClaim,
  registrarAutorizado,
  estaAutorizado,
  modoBloquear,
  esCursor,
  leerEvento,
  directorioDelEvento,
  resolverArchivoDeEdicion,
  salir,
};
