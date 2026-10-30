// Conversión de celdas simples: sí/no, fecha, localizador, tipo de dato y rango.
import { WARN_SEP, cellOriginal, fold, hasWholeWord, isEmptyOrDash, trimCell } from './utilidades.mjs';

// ---------------------------------------------------------------------------
// Objetos reutilizables
// ---------------------------------------------------------------------------

export function valorSiNo(texto, advertencias, seccion, campo, columna) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal)) {
    return { valor: 'no_aplica', detalle: null, texto_original: textoOriginal };
  }
  const entrada = textoOriginal;
  const plegado = fold(entrada);

  // 2) Condicional…
  if (plegado.startsWith('condicional')) {
    let detalle = entrada.replace(/^Condicional/i, '');
    detalle = detalle.replace(/^\s*[,(]\s*/, '').replace(/[)\s]*$/, '');
    detalle = trimCell(detalle);
    return { valor: 'condicional', detalle: detalle || null, texto_original: textoOriginal };
  }

  // 3) Exactamente Sí / Si
  if (plegado === 'si') {
    return { valor: 'si', detalle: null, texto_original: textoOriginal };
  }

  // 4) Sí (
  if (/^s[ií]\s*\(/i.test(entrada)) {
    const coincidencia = entrada.match(/^s[ií]\s*\((.*)\)\s*$/is);
    const detalle = coincidencia ? trimCell(coincidencia[1]) : null;
    return { valor: 'si', detalle: detalle || null, texto_original: textoOriginal };
  }

  // 5) Sí seguido de otra cosa
  if (/^s[ií][\s,]/i.test(entrada)) {
    let detalle = entrada.replace(/^s[ií]/i, '');
    detalle = detalle.replace(/^[\s,]+/, '');
    return { valor: 'condicional', detalle: detalle || null, texto_original: textoOriginal };
  }

  // 6) No…
  if (/^no\b/i.test(entrada)) {
    let detalle = entrada.replace(/^No\b/i, '');
    detalle = trimCell(detalle);
    if (detalle.startsWith('(') && detalle.endsWith(')')) {
      detalle = trimCell(detalle.slice(1, -1));
    }
    return { valor: 'no', detalle: detalle || null, texto_original: textoOriginal };
  }

  advertencias.push(`${seccion}${WARN_SEP}${campo}${WARN_SEP}${columna}: no encaja en reglas Sí/No`);
  return { valor: null, detalle: null, texto_original: textoOriginal };
}

export function parseFecha(texto) {
  const textoOriginal = cellOriginal(texto);
  const coincidencia = textoOriginal.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!coincidencia) return { valor: null, texto_original: textoOriginal };
  return { valor: `${coincidencia[3]}-${coincidencia[2]}-${coincidencia[1]}`, texto_original: textoOriginal };
}

export function parseLocalizador(texto, advertencias, seccion, campo, columna) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal)) return null;

  if (/^testid=/i.test(textoOriginal)) {
    return {
      testid: textoOriginal.replace(/^testid=/i, ''),
      rol: null,
      nombre: null,
      texto_original: textoOriginal,
    };
  }

  // role=button name="X" (variante documentada en plantillas)
  const roleName = textoOriginal.match(/^role\s*=\s*([a-z0-9_-]+)\s+name\s*=\s*"([^"]*)"\s*$/i);
  if (roleName) {
    return {
      testid: null,
      rol: roleName[1].toLowerCase(),
      nombre: roleName[2],
      texto_original: textoOriginal,
    };
  }

  // label="X"
  const labelM = textoOriginal.match(/^label\s*=\s*"([^"]*)"\s*$/i);
  if (labelM) {
    return {
      testid: null,
      rol: 'label',
      nombre: labelM[1],
      texto_original: textoOriginal,
    };
  }

  // <rol> "<nombre>"
  const coincidencia = textoOriginal.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+"([^"]*)"\s*$/);
  if (coincidencia) {
    return {
      testid: null,
      rol: coincidencia[1].toLowerCase(),
      nombre: coincidencia[2],
      texto_original: textoOriginal,
    };
  }

  advertencias.push(
    `${seccion}${WARN_SEP}${campo}${WARN_SEP}${columna}: localizador no cumple la notación`,
  );
  return {
    testid: null,
    rol: null,
    nombre: null,
    texto_original: textoOriginal,
  };
}

// ---------------------------------------------------------------------------
// Normalizaciones por columna
// ---------------------------------------------------------------------------

export function categoriaTipoDato(textoOriginal, advertencias, campo) {
  const plegado = fold(textoOriginal);
  if (plegado.includes('texto largo')) return 'texto_largo';
  if (plegado.includes('telefono')) return 'telefono';
  if (
    plegado.includes('seleccion') ||
    plegado.includes('picker') ||
    plegado.includes('catalogo') ||
    plegado.includes('lista') ||
    hasWholeWord(textoOriginal, 'select')
  ) {
    return 'seleccion';
  }
  if (plegado.includes('booleano') || plegado.includes('checkbox') || plegado.includes('switch')) return 'booleano';
  if (plegado.includes('fecha y hora') || plegado.includes('datetime')) return 'fecha_hora';
  if (hasWholeWord(textoOriginal, 'fecha')) return 'fecha';
  if (hasWholeWord(textoOriginal, 'hora')) return 'hora';
  if (hasWholeWord(textoOriginal, 'uuid')) return 'uuid';
  if (plegado.includes('entero')) return 'numero_entero';
  if (plegado.includes('decimal')) return 'numero_decimal';
  if (plegado.includes('numero') || plegado.includes('numerico')) return 'numero';
  if (plegado.includes('texto') || plegado.includes('alfanumerico') || plegado.includes('email') || plegado.includes('correo')) {
    return 'texto';
  }
  advertencias.push(`Tabla 1${WARN_SEP}${campo}${WARN_SEP}Tipo de dato: categoría no reconocida`);
  return 'otro';
}

export function parseNumberToken(tok) {
  if (tok == null) return null;
  const textoNumero = String(tok).trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(textoNumero)) return null;
  const numero = Number(textoNumero);
  return Number.isFinite(numero) ? numero : null;
}

export function parseRangoLimite(texto, advertencias, campo) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal)) {
    return { minimo: null, maximo: null, longitud_maxima: null, texto_original: textoOriginal };
  }

  const entrada = textoOriginal;
  let minimo = null;
  let maximo = null;
  let longitudMaxima = null;
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
  longitudMaxima = finalize('longitud_maxima');

  return { minimo, maximo, longitud_maxima: longitudMaxima, texto_original: textoOriginal };
}
