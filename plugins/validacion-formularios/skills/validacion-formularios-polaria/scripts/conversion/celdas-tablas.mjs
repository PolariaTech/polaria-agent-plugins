// Conversión de celdas de las tablas 1 a 4: orden de Tab, foco, capas, mensajes, origen y pasos.
import { EM_DASH, STEP_SEP, WARN_SEP, cellOriginal, fold, hasWholeWord, isEmptyOrDash, trimCell } from './utilidades.mjs';
import { parseLocalizador } from './celdas-basicas.mjs';

export function parseOrdenTab(texto) {
  const textoOriginal = cellOriginal(texto);
  if (/^\d+$/.test(textoOriginal)) {
    return { tipo: 'posicion', posicion: Number(textoOriginal), texto_original: textoOriginal };
  }
  const plegado = fold(textoOriginal);
  if (plegado.includes('tabindex=-1') || plegado.includes('fuera de tab')) {
    return { tipo: 'fuera_de_tab', posicion: null, texto_original: textoOriginal };
  }
  if (isEmptyOrDash(textoOriginal) || textoOriginal.startsWith(EM_DASH)) {
    return { tipo: 'no_aplica', posicion: null, texto_original: textoOriginal };
  }
  return { tipo: 'relativo', posicion: null, texto_original: textoOriginal };
}

export function parseFoco(texto) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal) || /^no\b/i.test(textoOriginal)) {
    return { tiene: false, momento: null, texto_original: textoOriginal };
  }
  let momento = textoOriginal;
  if (/^s[ií],\s+/i.test(momento)) momento = momento.replace(/^s[ií],\s+/i, '');
  else if (/^s[ií]\s+/i.test(momento)) momento = momento.replace(/^s[ií]\s+/i, '');
  else if (/^s[ií]$/i.test(momento)) momento = '';
  return { tiene: true, momento: momento || null, texto_original: textoOriginal };
}

export function parseCapas(texto) {
  const textoOriginal = cellOriginal(texto);
  return {
    front: hasWholeWord(textoOriginal, 'Front'),
    back: hasWholeWord(textoOriginal, 'Back'),
    bd: hasWholeWord(textoOriginal, 'BD') || fold(textoOriginal).includes('base de datos'),
    texto_original: textoOriginal,
  };
}

export function parseDependeDe(texto) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal)) {
    return { campos: [], texto_original: textoOriginal };
  }
  const campos = textoOriginal
    .split(/[;,]/)
    .map((fragmento) => trimCell(fragmento))
    .filter(Boolean);
  return { campos, texto_original: textoOriginal };
}

export function parseMensajes(texto) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal)) {
    return { mensajes: [], texto_original: textoOriginal };
  }
  const mensajes = textoOriginal
    .split(' / ')
    .map((fragmento) => trimCell(fragmento))
    .filter(Boolean);
  return { mensajes, texto_original: textoOriginal };
}

export function parseOrigen(texto, advertencias, campo) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal)) {
    return { valor: null, texto_original: textoOriginal };
  }
  const plegado = fold(textoOriginal);
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
  return { valor, texto_original: textoOriginal };
}

export function parsePasosAbrir(texto, advertencias) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal)) return [];
  const parts = textoOriginal.split(STEP_SEP).map((fragmento) => trimCell(fragmento)).filter(Boolean);
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

export function parseArchivos(texto, advertencias) {
  const textoOriginal = cellOriginal(texto);
  if (isEmptyOrDash(textoOriginal)) {
    advertencias.push(
      `Tabla 4${WARN_SEP}—${WARN_SEP}Archivos del formulario: sin archivos no se puede revalidar el formulario por cambio`,
    );
    return [];
  }
  return textoOriginal
    .split('; ')
    .map((fragmento) => trimCell(fragmento))
    .filter(Boolean);
}

export function hasTemplateBrackets(texto) {
  return /\[[^\]]+\]/.test(String(texto ?? ''));
}
