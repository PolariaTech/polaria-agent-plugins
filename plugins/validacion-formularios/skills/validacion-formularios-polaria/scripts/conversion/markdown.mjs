// Lectura del Markdown del schema: secciones, tablas y claves/valores.
import { cellOriginal, fold, trimCell } from './utilidades.mjs';

// ---------------------------------------------------------------------------
// Parsing Markdown
// ---------------------------------------------------------------------------

export function findSections(md) {
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

export function parsePipeTable(block) {
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

export function findNestedTable(parentBody, prefix) {
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

export function colIndex(headers, ...names) {
  for (const name of names) {
    const i = headers.findIndex((encabezado) => fold(encabezado) === fold(name) || fold(encabezado).startsWith(fold(name)));
    if (i >= 0) return i;
  }
  return -1;
}

export function kvMap(table) {
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

export function kvGet(map, ...prefixes) {
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

export function makeCampoId(campo, usedCounts) {
  let id = fold(campo);
  id = id.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) id = 'campo';
  const contador = (usedCounts.get(id) ?? 0) + 1;
  usedCounts.set(id, contador);
  if (contador === 1) return { id, duplicate: false };
  return { id: `${id}_${contador}`, duplicate: true, base: id };
}
