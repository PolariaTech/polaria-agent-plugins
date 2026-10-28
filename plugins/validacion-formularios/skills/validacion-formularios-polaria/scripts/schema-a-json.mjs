#!/usr/bin/env node
/**
 * Conversor portable schema_*.md → JSON (Formato 1.0).
 * Uso (desde la raíz del repo del dev):
 *   node schema-a-json.mjs <ruta-del-schema.md> <ruta-del-json-de-salida>
 *
 * Archivo independiente (sin imports locales) para poder copiarse a un plugin.
 * Copia adaptada para el plugin validacion-formularios: respecto del conversor del repo flujos
 * no trae --all, --mvp ni --self-check (dependían de rutas fijas de ese repo) y la ruta de salida
 * es obligatoria, para que nunca escriba dentro de la carpeta del plugin.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
// Raíz del repo del dev: el conversor se corre desde ahí.
const REPO_ROOT = process.cwd();
const VERSION_FILE = join(REPO_ROOT, 'VERSION');

const EM_DASH = '—';
const WARN_SEP = ' · ';
const STEP_SEP = ' → ';

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

function stripDiacritics(texto) {
  return texto.normalize('NFKD').replace(/\p{M}/gu, '');
}

function fold(texto) {
  return stripDiacritics(String(texto ?? '')).toLowerCase();
}

function trimCell(raw) {
  if (raw == null) return '';
  return String(raw)
    .replace(/\\\|/g, '|')
    .replace(/^\s+|\s+$/g, '');
}

function isEmptyOrDash(texto) {
  const limpio = trimCell(texto);
  return limpio === '' || limpio === EM_DASH || limpio === '-';
}

function cellOriginal(texto) {
  const limpio = trimCell(texto);
  if (limpio === '' || limpio === '-') return EM_DASH;
  return limpio;
}

function hasWholeWord(haystack, needle) {
  const pajarPlegado = fold(haystack);
  const agujaPlegada = fold(needle);
  const patron = new RegExp(`(?:^|[^a-z0-9_])${agujaPlegada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9_])`);
  return patron.test(pajarPlegado);
}

function readPortalVersion() {
  try {
    return trimCell(readFileSync(VERSION_FILE, 'utf8')) || null;
  } catch {
    return null;
  }
}

function sha256Hex(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function isoNow() {
  const ahora = new Date();
  const pad = (numero) => String(numero).padStart(2, '0');
  const offset = -ahora.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const desfaseHoras = pad(Math.floor(abs / 60));
  const desfaseMinutos = pad(abs % 60);
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}T${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}${sign}${desfaseHoras}:${desfaseMinutos}`;
}

// ---------------------------------------------------------------------------
// Parsing Markdown
// ---------------------------------------------------------------------------

function findSections(md) {
  const lines = md.split(/\r?\n/);
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const coincidencia = lines[i].match(/^(#{2,3})\s+(.+?)\s*$/);
    if (coincidencia) headings.push({ level: coincidencia[1].length, title: coincidencia[2], line: i });
  }

  function sectionByPrefix(prefix) {
    const prefijoPlegado = fold(prefix);
    const hit = headings.find((encabezado) => fold(encabezado.title).startsWith(prefijoPlegado));
    if (!hit) return null;
    const idx = headings.indexOf(hit);
    const end = idx + 1 < headings.length ? headings[idx + 1].line : lines.length;
    return {
      title: hit.title,
      start: hit.line,
      end,
      body: lines.slice(hit.line + 1, end).join('\n'),
    };
  }

  return {
    datos: sectionByPrefix('Datos del formulario'),
    tabla1: sectionByPrefix('Tabla 1'),
    tabla2: sectionByPrefix('Tabla 2'),
    tabla3: sectionByPrefix('Tabla 3'),
    tabla4: sectionByPrefix('Tabla 4'),
    notas: sectionByPrefix('Notas y justificaciones'),
    version: sectionByPrefix('Versión y revisión'),
  };
}

function parsePipeTable(block) {
  const lines = String(block ?? '')
    .split(/\r?\n/)
    .filter((linea) => linea.trim().startsWith('|'));
  if (lines.length < 2) return null;

  const parseRow = (line) => {
    let contenido = line.trim();
    if (contenido.startsWith('|')) contenido = contenido.slice(1);
    if (contenido.endsWith('|')) contenido = contenido.slice(0, -1);
    const cells = [];
    let cur = '';
    let escaped = false;
    for (let i = 0; i < contenido.length; i++) {
      const caracter = contenido[i];
      if (escaped) {
        cur += caracter;
        escaped = false;
        continue;
      }
      if (caracter === '\\') {
        escaped = true;
        continue;
      }
      if (caracter === '|') {
        cells.push(trimCell(cur));
        cur = '';
        continue;
      }
      cur += caracter;
    }
    cells.push(trimCell(cur));
    return cells;
  };

  const headers = parseRow(lines[0]);
  let start = 1;
  if (lines[1] && headers.every((_encabezado, i) => /^:?-+:?$/.test((parseRow(lines[1])[i] ?? '').replace(/\s/g, '') || '-'))) {
    start = 2;
  }
  const rows = lines.slice(start).map(parseRow);
  return { headers, rows };
}

function findNestedTable(parentBody, prefix) {
  const lines = String(parentBody ?? '').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const coincidencia = lines[i].match(/^#{2,4}\s+(.+?)\s*$/);
    if (coincidencia && fold(coincidencia[1]).includes(fold(prefix))) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{2,4}\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return parsePipeTable(lines.slice(start + 1, end).join('\n'));
}

function colIndex(headers, ...names) {
  for (const name of names) {
    const i = headers.findIndex((encabezado) => fold(encabezado) === fold(name) || fold(encabezado).startsWith(fold(name)));
    if (i >= 0) return i;
  }
  return -1;
}

function kvMap(table) {
  const map = new Map();
  if (!table) return map;
  const cCampo = colIndex(table.headers, 'Campo');
  const cValor = colIndex(table.headers, 'Valor');
  if (cCampo < 0 || cValor < 0) return map;
  for (const row of table.rows) {
    map.set(trimCell(row[cCampo]), cellOriginal(row[cValor]));
  }
  return map;
}

function kvGet(map, ...prefixes) {
  for (const [clave, valor] of map.entries()) {
    for (const prefijo of prefixes) {
      if (fold(clave) === fold(prefijo) || fold(clave).startsWith(fold(prefijo))) return valor;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// campo_id
// ---------------------------------------------------------------------------

function makeCampoId(campo, usedCounts) {
  let id = fold(campo);
  id = id.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) id = 'campo';
  const contador = (usedCounts.get(id) ?? 0) + 1;
  usedCounts.set(id, contador);
  if (contador === 1) return { id, duplicate: false };
  return { id: `${id}_${contador}`, duplicate: true, base: id };
}

// ---------------------------------------------------------------------------
// Objetos reutilizables
// ---------------------------------------------------------------------------

function valorSiNo(texto, advertencias, seccion, campo, columna) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original)) {
    return { valor: 'no_aplica', detalle: null, texto_original };
  }
  const entrada = texto_original;
  const plegado = fold(entrada);

  // 2) Condicional…
  if (plegado.startsWith('condicional')) {
    let detalle = entrada.replace(/^Condicional/i, '');
    detalle = detalle.replace(/^\s*[,(]\s*/, '').replace(/[)\s]*$/, '');
    detalle = trimCell(detalle);
    return { valor: 'condicional', detalle: detalle || null, texto_original };
  }

  // 3) Exactamente Sí / Si
  if (plegado === 'si') {
    return { valor: 'si', detalle: null, texto_original };
  }

  // 4) Sí (
  if (/^s[ií]\s*\(/i.test(entrada)) {
    const coincidencia = entrada.match(/^s[ií]\s*\((.*)\)\s*$/is);
    const detalle = coincidencia ? trimCell(coincidencia[1]) : null;
    return { valor: 'si', detalle: detalle || null, texto_original };
  }

  // 5) Sí seguido de otra cosa
  if (/^s[ií][\s,]/i.test(entrada)) {
    let detalle = entrada.replace(/^s[ií]/i, '');
    detalle = detalle.replace(/^[\s,]+/, '');
    return { valor: 'condicional', detalle: detalle || null, texto_original };
  }

  // 6) No…
  if (/^no\b/i.test(entrada)) {
    let detalle = entrada.replace(/^No\b/i, '');
    detalle = trimCell(detalle);
    if (detalle.startsWith('(') && detalle.endsWith(')')) {
      detalle = trimCell(detalle.slice(1, -1));
    }
    return { valor: 'no', detalle: detalle || null, texto_original };
  }

  advertencias.push(`${seccion}${WARN_SEP}${campo}${WARN_SEP}${columna}: no encaja en reglas Sí/No`);
  return { valor: null, detalle: null, texto_original };
}

function parseFecha(texto) {
  const texto_original = cellOriginal(texto);
  const coincidencia = texto_original.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!coincidencia) return { valor: null, texto_original };
  return { valor: `${coincidencia[3]}-${coincidencia[2]}-${coincidencia[1]}`, texto_original };
}

function parseLocalizador(texto, advertencias, seccion, campo, columna) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original)) return null;

  if (/^testid=/i.test(texto_original)) {
    return {
      testid: texto_original.replace(/^testid=/i, ''),
      rol: null,
      nombre: null,
      texto_original,
    };
  }

  // role=button name="X" (variante documentada en plantillas)
  const roleName = texto_original.match(/^role\s*=\s*([a-z0-9_-]+)\s+name\s*=\s*"([^"]*)"\s*$/i);
  if (roleName) {
    return {
      testid: null,
      rol: roleName[1].toLowerCase(),
      nombre: roleName[2],
      texto_original,
    };
  }

  // label="X"
  const labelM = texto_original.match(/^label\s*=\s*"([^"]*)"\s*$/i);
  if (labelM) {
    return {
      testid: null,
      rol: 'label',
      nombre: labelM[1],
      texto_original,
    };
  }

  // <rol> "<nombre>"
  const coincidencia = texto_original.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+"([^"]*)"\s*$/);
  if (coincidencia) {
    return {
      testid: null,
      rol: coincidencia[1].toLowerCase(),
      nombre: coincidencia[2],
      texto_original,
    };
  }

  advertencias.push(
    `${seccion}${WARN_SEP}${campo}${WARN_SEP}${columna}: localizador no cumple la notación`,
  );
  return {
    testid: null,
    rol: null,
    nombre: null,
    texto_original,
  };
}

// ---------------------------------------------------------------------------
// Normalizaciones por columna
// ---------------------------------------------------------------------------

function categoriaTipoDato(texto_original, advertencias, campo) {
  const plegado = fold(texto_original);
  if (plegado.includes('texto largo')) return 'texto_largo';
  if (plegado.includes('telefono')) return 'telefono';
  if (
    plegado.includes('seleccion') ||
    plegado.includes('picker') ||
    plegado.includes('catalogo') ||
    plegado.includes('lista') ||
    hasWholeWord(texto_original, 'select')
  ) {
    return 'seleccion';
  }
  if (plegado.includes('booleano') || plegado.includes('checkbox') || plegado.includes('switch')) return 'booleano';
  if (plegado.includes('fecha y hora') || plegado.includes('datetime')) return 'fecha_hora';
  if (hasWholeWord(texto_original, 'fecha')) return 'fecha';
  if (hasWholeWord(texto_original, 'hora')) return 'hora';
  if (hasWholeWord(texto_original, 'uuid')) return 'uuid';
  if (plegado.includes('entero')) return 'numero_entero';
  if (plegado.includes('decimal')) return 'numero_decimal';
  if (plegado.includes('numero') || plegado.includes('numerico')) return 'numero';
  if (plegado.includes('texto') || plegado.includes('alfanumerico') || plegado.includes('email') || plegado.includes('correo')) {
    return 'texto';
  }
  advertencias.push(`Tabla 1${WARN_SEP}${campo}${WARN_SEP}Tipo de dato: categoría no reconocida`);
  return 'otro';
}

function parseNumberToken(tok) {
  if (tok == null) return null;
  const textoNumero = String(tok).trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(textoNumero)) return null;
  const numero = Number(textoNumero);
  return Number.isFinite(numero) ? numero : null;
}

function parseRangoLimite(texto, advertencias, campo) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original)) {
    return { minimo: null, maximo: null, longitud_maxima: null, texto_original };
  }

  const entrada = texto_original;
  let minimo = null;
  let maximo = null;
  let longitud_maxima = null;
  const conflicts = { minimo: [], maximo: [], longitud_maxima: [] };

  function setProp(prop, value) {
    if (value == null) return;
    conflicts[prop].push(value);
  }

  // longitud: varchar(N), longitud N, longitud máxima N, máx N caracteres
  for (const coincidencia of entrada.matchAll(/varchar\s*\(\s*(\d+)\s*\)/gi)) {
    setProp('longitud_maxima', Number(coincidencia[1]));
  }
  for (const coincidencia of entrada.matchAll(/longitud(?:\s+m[aá]xima)?\s+(\d+)/gi)) {
    setProp('longitud_maxima', Number(coincidencia[1]));
  }
  for (const coincidencia of entrada.matchAll(/m[aá]x\.?\s*(-?\d+(?:[.,]\d+)?)\s*caracteres/gi)) {
    setProp('longitud_maxima', Math.trunc(parseNumberToken(coincidencia[1])));
  }

  // rangos N … M / N ... M (no exclusivos)
  for (const coincidencia of entrada.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(?:…|\.\.\.)\s*(-?\d+(?:[.,]\d+)?)/g)) {
    setProp('minimo', parseNumberToken(coincidencia[1]));
    setProp('maximo', parseNumberToken(coincidencia[2]));
  }

  // Mín / Mínimo / ≥ / >=
  for (const coincidencia of entrada.matchAll(/(?:m[ií]n(?:imo)?|≥|>=)\s*(-?\d+(?:[.,]\d+)?)/gi)) {
    setProp('minimo', parseNumberToken(coincidencia[1]));
  }
  // Máx / Máximo / ≤ / <=  — excluir "máx N caracteres"
  for (const coincidencia of entrada.matchAll(/(?:m[aá]x(?:imo)?|≤|<=)\s*(-?\d+(?:[.,]\d+)?)(?!\s*caracteres)/gi)) {
    setProp('maximo', parseNumberToken(coincidencia[1]));
  }

  // exclusive > N / < N do NOT fill minimo/maximo

  function finalize(prop) {
    const vals = conflicts[prop].filter((valor) => valor != null);
    if (vals.length === 0) return null;
    const uniq = [...new Set(vals.map(String))];
    if (uniq.length > 1) {
      advertencias.push(
        `Tabla 1${WARN_SEP}${campo}${WARN_SEP}Rango/Límite: valores distintos para ${prop}`,
      );
      return null;
    }
    return vals[0];
  }

  minimo = finalize('minimo');
  maximo = finalize('maximo');
  longitud_maxima = finalize('longitud_maxima');

  return { minimo, maximo, longitud_maxima, texto_original };
}

function parseOrdenTab(texto) {
  const texto_original = cellOriginal(texto);
  if (/^\d+$/.test(texto_original)) {
    return { tipo: 'posicion', posicion: Number(texto_original), texto_original };
  }
  const plegado = fold(texto_original);
  if (plegado.includes('tabindex=-1') || plegado.includes('fuera de tab')) {
    return { tipo: 'fuera_de_tab', posicion: null, texto_original };
  }
  if (isEmptyOrDash(texto_original) || texto_original.startsWith(EM_DASH)) {
    return { tipo: 'no_aplica', posicion: null, texto_original };
  }
  return { tipo: 'relativo', posicion: null, texto_original };
}

function parseFoco(texto) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original) || /^no\b/i.test(texto_original)) {
    return { tiene: false, momento: null, texto_original };
  }
  let momento = texto_original;
  if (/^s[ií],\s+/i.test(momento)) momento = momento.replace(/^s[ií],\s+/i, '');
  else if (/^s[ií]\s+/i.test(momento)) momento = momento.replace(/^s[ií]\s+/i, '');
  else if (/^s[ií]$/i.test(momento)) momento = '';
  return { tiene: true, momento: momento || null, texto_original };
}

function parseCapas(texto) {
  const texto_original = cellOriginal(texto);
  return {
    front: hasWholeWord(texto_original, 'Front'),
    back: hasWholeWord(texto_original, 'Back'),
    bd: hasWholeWord(texto_original, 'BD') || fold(texto_original).includes('base de datos'),
    texto_original,
  };
}

function parseDependeDe(texto) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original)) {
    return { campos: [], texto_original };
  }
  const campos = texto_original
    .split(/[;,]/)
    .map((fragmento) => trimCell(fragmento))
    .filter(Boolean);
  return { campos, texto_original };
}

function parseMensajes(texto) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original)) {
    return { mensajes: [], texto_original };
  }
  const mensajes = texto_original
    .split(' / ')
    .map((fragmento) => trimCell(fragmento))
    .filter(Boolean);
  return { mensajes, texto_original };
}

function parseOrigen(texto, advertencias, campo) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original)) {
    return { valor: null, texto_original };
  }
  const plegado = fold(texto_original);
  let valor = null;
  if (plegado === 'ambas' || plegado.includes('ambas')) valor = 'ambas';
  else if (plegado.includes('extraccion ia') || plegado.includes('extracción ia') || plegado === 'extraccion ia') {
    valor = 'extraccion_ia';
  } else if (plegado.includes('informacion de bd') || plegado.includes('información de bd') || plegado.includes('informacion bd')) {
    valor = 'informacion_bd';
  } else {
    // try exact folds
    if (plegado === 'extraccion ia') valor = 'extraccion_ia';
    else if (plegado === 'informacion de bd') valor = 'informacion_bd';
    else {
      advertencias.push(
        `Tabla 3${WARN_SEP}${campo}${WARN_SEP}Origen del pre-llenado: no encaja en reglas de normalización`,
      );
    }
  }
  // Prefer exact comparisons without diacritics
  if (plegado === 'extraccion ia') valor = 'extraccion_ia';
  if (plegado === 'informacion de bd') valor = 'informacion_bd';
  if (plegado === 'ambas') valor = 'ambas';
  return { valor, texto_original };
}

function parsePasosAbrir(texto, advertencias) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original)) return [];
  const parts = texto_original.split(STEP_SEP).map((fragmento) => trimCell(fragmento)).filter(Boolean);
  const pasos = [];
  for (const part of parts) {
    const firstSpace = part.indexOf(' ');
    const accionRaw = firstSpace < 0 ? part : part.slice(0, firstSpace);
    const rest = firstSpace < 0 ? '' : part.slice(firstSpace + 1);
    const accionFold = fold(accionRaw);
    let accion = accionRaw;
    if (!['clic', 'escribir', 'esperar'].includes(accionFold)) {
      advertencias.push(
        `Tabla 4${WARN_SEP}—${WARN_SEP}Pasos para abrir el formulario: acción no reconocida en "${part}"`,
      );
    } else {
      accion = accionFold;
    }

    let localizadorTexto = rest;
    let valor = null;
    if (accionFold === 'escribir') {
      const posicionIgual = rest.indexOf(' = ');
      if (posicionIgual >= 0) {
        localizadorTexto = rest.slice(0, posicionIgual);
        const after = rest.slice(posicionIgual + 3);
        const coincidenciaComillas = after.match(/^"([^"]*)"/);
        valor = coincidenciaComillas ? coincidenciaComillas[1] : trimCell(after);
      }
    }

    const localizador = parseLocalizador(
      localizadorTexto,
      advertencias,
      'Tabla 4',
      '—',
      'Pasos para abrir el formulario',
    );
    pasos.push({
      accion,
      localizador,
      valor,
      texto_original: part,
    });
  }
  return pasos;
}

function parseArchivos(texto, advertencias) {
  const texto_original = cellOriginal(texto);
  if (isEmptyOrDash(texto_original)) {
    advertencias.push(
      `Tabla 4${WARN_SEP}—${WARN_SEP}Archivos del formulario: sin archivos no se puede revalidar el formulario por cambio`,
    );
    return [];
  }
  return texto_original
    .split('; ')
    .map((fragmento) => trimCell(fragmento))
    .filter(Boolean);
}

function hasTemplateBrackets(texto) {
  return /\[[^\]]+\]/.test(String(texto ?? ''));
}

// ---------------------------------------------------------------------------
// Conversión principal
// ---------------------------------------------------------------------------

export function convertSchemaMarkdown(md, options = {}) {
  const advertencias = [];
  const archivo_origen = options.archivo_origen ?? 'schema_unknown.md';
  const ruta_origen = options.ruta_origen ?? archivo_origen;
  const version_portal = options.version_portal ?? readPortalVersion();
  const fecha = options.fecha ?? isoNow();
  const hash_origen = sha256Hex(md);

  const sections = findSections(md);

  if (!sections.datos) {
    const err = new Error('Falta la sección: Datos del formulario');
    err.code = 'MISSING_SECTION';
    throw err;
  }
  if (!sections.tabla1) {
    const err = new Error('Falta la sección: Tabla 1');
    err.code = 'MISSING_SECTION';
    throw err;
  }
  if (!sections.tabla2) {
    const err = new Error('Falta la sección: Tabla 2');
    err.code = 'MISSING_SECTION';
    throw err;
  }

  // Datos del formulario
  const datosTable = parsePipeTable(sections.datos.body);
  const datosKv = kvMap(datosTable);
  const idFromFile = basename(archivo_origen)
    .replace(/^schema_/, '')
    .replace(/\.md$/i, '');

  const vive = valorSiNo(
    kvGet(datosKv, '¿Vive en un modal?', 'Vive en un modal') ?? EM_DASH,
    advertencias,
    'Datos del formulario',
    '—',
    '¿Vive en un modal?',
  );
  const prellenado = valorSiNo(
    kvGet(
      datosKv,
      '¿Algún campo se pre-llena automáticamente',
      'Algún campo se pre-llena',
    ) ?? EM_DASH,
    advertencias,
    'Datos del formulario',
    '—',
    '¿Algún campo se pre-llena automáticamente?',
  );

  const camposNuevosRaw = kvGet(datosKv, 'Campos nuevos o modificados');
  const campos_nuevos_o_modificados =
    camposNuevosRaw === undefined ? null : isEmptyOrDash(camposNuevosRaw) ? null : camposNuevosRaw;

  const datos_formulario = {
    id: idFromFile,
    formulario: kvGet(datosKv, 'Formulario') ?? null,
    proyecto_repo: kvGet(datosKv, 'Proyecto / repo') ?? null,
    protocolo_referencia: kvGet(datosKv, 'Protocolo de referencia') ?? null,
    campos_nuevos_o_modificados,
    vive_en_modal: vive,
    tiene_prellenado: prellenado,
    responsable: kvGet(datosKv, 'Responsable (Desarrollador)', 'Responsable') ?? null,
    fecha_creacion: parseFecha(kvGet(datosKv, 'Fecha de creación') ?? EM_DASH),
  };

  // Tabla 1
  const tabla1 = parsePipeTable(sections.tabla1.body);
  if (!tabla1) {
    const err = new Error('Tabla 1 sin tabla parseable');
    err.code = 'MISSING_SECTION';
    throw err;
  }
  const t1Ids = new Map();
  const used1 = new Map();
  const iCampo = colIndex(tabla1.headers, 'Campo');
  const iTipo = colIndex(tabla1.headers, 'Tipo de dato');
  const iObl = colIndex(tabla1.headers, 'Obligatorio');
  const iRango = colIndex(tabla1.headers, 'Rango/Límite', 'Rango/Limite');
  const iDef = colIndex(tabla1.headers, 'Valor por defecto');
  const iUnico = colIndex(tabla1.headers, 'Único', 'Unico');
  const iDep = colIndex(tabla1.headers, 'Depende de');
  const iRegla = colIndex(tabla1.headers, 'Regla de dependencia');
  const iMsg = colIndex(tabla1.headers, 'Mensaje de error');
  const iCapas = colIndex(tabla1.headers, 'Capas aplicables');

  const missingCols1 = [];
  for (const [name, idx] of [
    ['Campo', iCampo],
    ['Tipo de dato', iTipo],
    ['Obligatorio', iObl],
    ['Rango/Límite', iRango],
    ['Valor por defecto', iDef],
    ['Único', iUnico],
    ['Depende de', iDep],
    ['Regla de dependencia', iRegla],
    ['Mensaje de error', iMsg],
    ['Capas aplicables (Front/Back/BD)', iCapas],
  ]) {
    if (idx < 0) {
      missingCols1.push(name);
      advertencias.push(`Tabla 1${WARN_SEP}—${WARN_SEP}${name}: columna ausente en el .md`);
    }
  }

  const tabla_1_validacion = tabla1.rows.map((row) => {
    if (row.length !== tabla1.headers.length) {
      advertencias.push(
        `Tabla 1${WARN_SEP}${row[iCampo] ?? '—'}${WARN_SEP}—: número de celdas distinto al encabezado`,
      );
    }
    const campo = iCampo >= 0 ? cellOriginal(row[iCampo]) : EM_DASH;
    const { id: campo_id, duplicate } = makeCampoId(campo, used1);
    if (duplicate) {
      advertencias.push(
        `Tabla 1${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id duplicado; se usó ${campo_id}`,
      );
    }
    t1Ids.set(campo_id, campo);

    for (const cell of row) {
      if (hasTemplateBrackets(cell)) {
        advertencias.push(
          `Tabla 1${WARN_SEP}${campo}${WARN_SEP}—: queda texto de plantilla entre corchetes`,
        );
        break;
      }
    }

    const tipoTexto = iTipo >= 0 ? cellOriginal(row[iTipo]) : EM_DASH;
    const tipo_dato = {
      categoria: iTipo >= 0 ? categoriaTipoDato(tipoTexto, advertencias, campo) : 'otro',
      solo_lectura:
        fold(tipoTexto).includes('solo lectura') || fold(tipoTexto).includes('readonly'),
      texto_original: tipoTexto,
    };

    const rango = iRango >= 0
      ? parseRangoLimite(row[iRango], advertencias, campo)
      : { minimo: null, maximo: null, longitud_maxima: null, texto_original: null };

    const defTexto = iDef >= 0 ? cellOriginal(row[iDef]) : EM_DASH;
    const valor_por_defecto = isEmptyOrDash(defTexto) ? null : defTexto;

    const reglaTexto = iRegla >= 0 ? cellOriginal(row[iRegla]) : EM_DASH;
    const regla_dependencia = isEmptyOrDash(reglaTexto) ? null : reglaTexto;

    return {
      campo,
      campo_id,
      tipo_dato,
      obligatorio:
        iObl >= 0
          ? valorSiNo(row[iObl], advertencias, 'Tabla 1', campo, 'Obligatorio')
          : { valor: null, detalle: null, texto_original: null },
      rango_limite: rango,
      valor_por_defecto,
      unico:
        iUnico >= 0
          ? valorSiNo(row[iUnico], advertencias, 'Tabla 1', campo, 'Único')
          : { valor: null, detalle: null, texto_original: null },
      depende_de: iDep >= 0 ? parseDependeDe(row[iDep]) : { campos: [], texto_original: null },
      regla_dependencia,
      mensajes_error: iMsg >= 0 ? parseMensajes(row[iMsg]) : { mensajes: [], texto_original: null },
      capas:
        iCapas >= 0
          ? parseCapas(row[iCapas])
          : { front: false, back: false, bd: false, texto_original: null },
    };
  });

  // Tabla 2
  const tabla2 = parsePipeTable(sections.tabla2.body);
  const used2 = new Map();
  const tabla_2_interaccion = [];
  if (tabla2) {
    const colCampo = colIndex(tabla2.headers, 'Campo');
    const cOrd = colIndex(tabla2.headers, 'Orden de tabulación', 'Orden de tabulacion');
    const cDes = colIndex(tabla2.headers, 'Deshabilitado');
    const cFoco = colIndex(tabla2.headers, 'Foco automático', 'Foco automatico');
    for (const row of tabla2.rows) {
      if (row.length !== tabla2.headers.length) {
        advertencias.push(
          `Tabla 2${WARN_SEP}${row[colCampo] ?? '—'}${WARN_SEP}—: número de celdas distinto al encabezado`,
        );
      }
      const campo = colCampo >= 0 ? cellOriginal(row[colCampo]) : EM_DASH;
      const { id: campo_id, duplicate } = makeCampoId(campo, used2);
      if (duplicate) {
        advertencias.push(
          `Tabla 2${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id duplicado; se usó ${campo_id}`,
        );
      }
      if (![...t1Ids.keys()].includes(campo_id) && !t1Ids.has(campo_id)) {
        // check base match: campo_id might need to match tabla1's id for same label
        const baseMatch = [...t1Ids.entries()].find(([, name]) => fold(name) === fold(campo));
        if (!baseMatch) {
          advertencias.push(
            `Tabla 2${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id no existe en la Tabla 1`,
          );
        }
      }
      tabla_2_interaccion.push({
        campo,
        campo_id: (() => {
          const match = [...t1Ids.entries()].find(([, name]) => fold(name) === fold(campo));
          return match ? match[0] : campo_id;
        })(),
        orden_tabulacion: cOrd >= 0 ? parseOrdenTab(row[cOrd]) : {
          tipo: 'no_aplica',
          posicion: null,
          texto_original: null,
        },
        deshabilitado:
          cDes >= 0
            ? valorSiNo(row[cDes], advertencias, 'Tabla 2', campo, 'Deshabilitado')
            : { valor: null, detalle: null, texto_original: null },
        foco_automatico: cFoco >= 0 ? parseFoco(row[cFoco]) : {
          tiene: false,
          momento: null,
          texto_original: null,
        },
      });
    }
  }

  // Cross: Tabla 1 sin fila en Tabla 2
  const idsTabla2 = new Set(tabla_2_interaccion.map((fila) => fila.campo_id));
  for (const row of tabla_1_validacion) {
    if (!idsTabla2.has(row.campo_id)) {
      advertencias.push(
        `Tabla 1${WARN_SEP}${row.campo}${WARN_SEP}Campo: no tiene fila en la Tabla 2`,
      );
    }
  }

  // Tabla 3
  let tabla_3_prellenado = null;
  if (sections.tabla3) {
    const tabla3 = parsePipeTable(sections.tabla3.body);
    const used3 = new Map();
    tabla_3_prellenado = [];
    if (tabla3) {
      const colCampo = colIndex(tabla3.headers, 'Campo');
      const cTiene = colIndex(tabla3.headers, '¿Tiene pre-llenado?', 'Tiene pre-llenado');
      const cOrig = colIndex(tabla3.headers, 'Origen del pre-llenado');
      const cEdit = colIndex(tabla3.headers, 'Editable manualmente');
      for (const row of tabla3.rows) {
        const campo = colCampo >= 0 ? cellOriginal(row[colCampo]) : EM_DASH;
        const { id: genId, duplicate } = makeCampoId(campo, used3);
        if (duplicate) {
          advertencias.push(
            `Tabla 3${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id duplicado; se usó ${genId}`,
          );
        }
        const match = [...t1Ids.entries()].find(([, name]) => fold(name) === fold(campo));
        const campo_id = match ? match[0] : genId;
        if (!match) {
          advertencias.push(
            `Tabla 3${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id no existe en la Tabla 1`,
          );
        }
        tabla_3_prellenado.push({
          campo,
          campo_id,
          tiene_prellenado:
            cTiene >= 0
              ? valorSiNo(row[cTiene], advertencias, 'Tabla 3', campo, '¿Tiene pre-llenado?')
              : { valor: null, detalle: null, texto_original: null },
          origen: cOrig >= 0 ? parseOrigen(row[cOrig], advertencias, campo) : {
            valor: null,
            texto_original: null,
          },
          editable:
            cEdit >= 0
              ? valorSiNo(row[cEdit], advertencias, 'Tabla 3', campo, 'Editable manualmente')
              : { valor: null, detalle: null, texto_original: null },
        });
      }
    }
  }

  // Tabla 4
  let prueba_nivel_2 = null;
  if (!sections.tabla4) {
    advertencias.push(
      `Tabla 4${WARN_SEP}—${WARN_SEP}—: el schema no tiene Tabla 4; la prueba automatizada del Nivel 2 no se puede ejecutar`,
    );
  } else {
    // Prefer explicit 4.1 subsection
    const accesoTable =
      findNestedTable(sections.tabla4.body, 'Acceso y botones') ||
      findNestedTable(sections.tabla4.body, '4.1') ||
      null;
    const camposTable =
      findNestedTable(sections.tabla4.body, '4.2') ||
      findNestedTable(sections.tabla4.body, 'Campos') ||
      null;

    const mapaClaveValor = kvMap(accesoTable);
    const rol = kvGet(mapaClaveValor, 'Rol con que se inicia sesión', 'Rol') ?? EM_DASH;
    const ruta = kvGet(mapaClaveValor, 'Ruta / URL', 'Ruta') ?? EM_DASH;
    if (isEmptyOrDash(rol) || isEmptyOrDash(ruta)) {
      advertencias.push(
        `Tabla 4${WARN_SEP}—${WARN_SEP}Rol/Ruta: sin rol y ruta no se puede abrir el formulario`,
      );
    }

    const pasosTexto = kvGet(mapaClaveValor, 'Pasos para abrir el formulario') ?? EM_DASH;
    const registro = kvGet(mapaClaveValor, 'Registro que debe existir') ?? EM_DASH;
    const archivosTexto = kvGet(mapaClaveValor, 'Archivos del formulario') ?? EM_DASH;

    const botonGuardar = kvGet(mapaClaveValor, 'Botón Guardar', 'Boton Guardar') ?? EM_DASH;
    const botonCancelar = kvGet(mapaClaveValor, 'Botón Cancelar / Cerrar', 'Botón Cancelar') ?? EM_DASH;
    const descarteConf =
      kvGet(mapaClaveValor, 'Diálogo de descarte: botón que confirma', 'Dialogo de descarte: botón que confirma') ??
      EM_DASH;
    const descarteSeguir =
      kvGet(mapaClaveValor, 'Diálogo de descarte: botón para seguir editando') ?? EM_DASH;
    const advNoSaltable = kvGet(mapaClaveValor, 'Botón de la advertencia no-saltable') ?? EM_DASH;

    const used4 = new Map();
    const campos = [];
    if (camposTable) {
      const colCampo = colIndex(camposTable.headers, 'Campo');
      const cLoc = colIndex(camposTable.headers, 'Localizador');
      const cVal = colIndex(camposTable.headers, 'Valor de prueba');
      for (const row of camposTable.rows) {
        const campo = colCampo >= 0 ? cellOriginal(row[colCampo]) : EM_DASH;
        const { id: genId, duplicate } = makeCampoId(campo, used4);
        if (duplicate) {
          advertencias.push(
            `Tabla 4.2${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id duplicado; se usó ${genId}`,
          );
        }
        const match = [...t1Ids.entries()].find(([, name]) => fold(name) === fold(campo));
        const campo_id = match ? match[0] : genId;
        if (!match) {
          advertencias.push(
            `Tabla 4.2${WARN_SEP}${campo}${WARN_SEP}Campo: fila no existe en la Tabla 1`,
          );
        }
        const valTexto = cVal >= 0 ? cellOriginal(row[cVal]) : EM_DASH;
        campos.push({
          campo,
          campo_id,
          localizador:
            cLoc >= 0
              ? parseLocalizador(row[cLoc], advertencias, 'Tabla 4.2', campo, 'Localizador')
              : null,
          valor_de_prueba: isEmptyOrDash(valTexto) ? null : valTexto,
        });
      }
    }

    const idsTabla42 = new Set(campos.map((campoActual) => campoActual.campo_id));
    for (const row of tabla_1_validacion) {
      if (!idsTabla42.has(row.campo_id)) {
        advertencias.push(
          `Tabla 4.2${WARN_SEP}${row.campo}${WARN_SEP}Campo: campo de la Tabla 1 sin fila en la Tabla 4.2`,
        );
      }
    }

    prueba_nivel_2 = {
      acceso: {
        rol,
        ruta,
        pasos_abrir: parsePasosAbrir(pasosTexto, advertencias),
        registro_requerido: isEmptyOrDash(registro) ? null : registro,
        archivos_formulario: parseArchivos(archivosTexto, advertencias),
      },
      botones: {
        guardar: parseLocalizador(botonGuardar, advertencias, 'Tabla 4.1', '—', 'Botón Guardar'),
        cancelar: isEmptyOrDash(botonCancelar)
          ? null
          : parseLocalizador(botonCancelar, advertencias, 'Tabla 4.1', '—', 'Botón Cancelar / Cerrar'),
        descarte_confirmar: isEmptyOrDash(descarteConf)
          ? null
          : parseLocalizador(
              descarteConf,
              advertencias,
              'Tabla 4.1',
              '—',
              'Diálogo de descarte: botón que confirma',
            ),
        descarte_seguir_editando: isEmptyOrDash(descarteSeguir)
          ? null
          : parseLocalizador(
              descarteSeguir,
              advertencias,
              'Tabla 4.1',
              '—',
              'Diálogo de descarte: botón para seguir editando',
            ),
        advertencia_confirmar: isEmptyOrDash(advNoSaltable)
          ? null
          : parseLocalizador(
              advNoSaltable,
              advertencias,
              'Tabla 4.1',
              '—',
              'Botón de la advertencia no-saltable',
            ),
      },
      campos,
    };
  }

  // Notas
  let notas_justificaciones = null;
  if (sections.notas) {
    let body = sections.notas.body.replace(/^\s+|\s+$/g, '');
    const plain = body.replace(/\s+/g, ' ').trim();
    if (/^sin notas\.?$/i.test(plain)) notas_justificaciones = null;
    else notas_justificaciones = body || null;
  }

  // Versión
  const verTable = sections.version ? parsePipeTable(sections.version.body) : null;
  const verKv = kvMap(verTable);
  const version_revision = {
    version_schema: kvGet(verKv, 'Versión del schema') ?? null,
    fecha_aprobacion: parseFecha(kvGet(verKv, 'Fecha de aprobación') ?? EM_DASH),
    aprobado_por: kvGet(verKv, 'Aprobado por') ?? null,
    proxima_revision: kvGet(verKv, 'Próxima revisión') ?? null,
  };

  return {
    formato: 'polaria.schema-formulario',
    version_formato: '1.0',
    exportacion: {
      fecha,
      archivo_origen,
      ruta_origen,
      version_portal,
      hash_origen,
    },
    datos_formulario,
    tabla_1_validacion,
    tabla_2_interaccion,
    tabla_3_prellenado,
    prueba_nivel_2,
    notas_justificaciones,
    version_revision,
    advertencias,
  };
}

export function convertFile(mdPath, outPath) {
  if (!outPath) throw new Error('Falta la ruta del JSON de salida');
  const abs = resolve(mdPath);
  const md = readFileSync(abs, 'utf8');
  const archivo_origen = basename(abs);
  const ruta_origen = relative(REPO_ROOT, abs).replace(/\\/g, '/');
  const json = convertSchemaMarkdown(md, { archivo_origen, ruta_origen });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  return { out: outPath, json };
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Uso:
  node schema-a-json.mjs <ruta-del-schema.md> <ruta-del-json-de-salida>`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const [rutaSchema, rutaSalida] = args;
  if (!rutaSalida) {
    console.error('ERROR: falta la ruta del JSON de salida. Uso: node schema-a-json.mjs <ruta-del-schema.md> <ruta-del-json-de-salida>');
    process.exit(1);
  }
  const { out, json } = convertFile(rutaSchema, rutaSalida);
  console.log(`Escrito ${out}`);
  console.log(`advertencias: ${json.advertencias.length}`);
  for (const advertencia of json.advertencias) console.log(`  - ${advertencia}`);
}

const isDirect =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (isDirect) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}
