// Conversión de los datos del formulario y de las tablas 1, 2 y 3 del schema.
import { EM_DASH, WARN_SEP, cellOriginal, fold, isEmptyOrDash } from './utilidades.mjs';
import { colIndex, kvGet, kvMap, makeCampoId, parsePipeTable } from './markdown.mjs';
import {
  categoriaTipoDato,
  parseFecha,
  parseRangoLimite,
  valorSiNo,
} from './celdas-basicas.mjs';
import {
  hasTemplateBrackets,
  parseCapas,
  parseDependeDe,
  parseFoco,
  parseMensajes,
  parseOrdenTab,
  parseOrigen,
} from './celdas-tablas.mjs';

const siNoVacio = () => ({ valor: null, detalle: null, texto_original: null });

// Devuelve el campo_id de la Tabla 1 cuyo nombre coincide con el de la fila (sin acentos ni mayúsculas).
function idEnTabla1PorNombre(idsTabla1, campo) {
  const coincidencia = [...idsTabla1.entries()].find(([, nombre]) => fold(nombre) === fold(campo));
  return coincidencia ? coincidencia[0] : undefined;
}

function avisarFilaIrregular(fila, encabezados, seccion, columnaCampo, advertencias) {
  if (fila.length === encabezados.length) return;
  advertencias.push(`${seccion}${WARN_SEP}${fila[columnaCampo] ?? '—'}${WARN_SEP}—: número de celdas distinto al encabezado`);
}

function avisarIdDuplicado(seccion, campo, id, advertencias) {
  advertencias.push(`${seccion}${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id duplicado; se usó ${id}`);
}

// Avisa de cada campo de la Tabla 1 que no tiene fila en la tabla `seccion`.
export function avisarCamposSinFila(filasTabla1, idsPresentes, seccion, detalle, advertencias) {
  for (const fila of filasTabla1) {
    if (!idsPresentes.has(fila.campo_id)) advertencias.push(`${seccion}${WARN_SEP}${fila.campo}${WARN_SEP}${detalle}`);
  }
}

export function convertirDatosFormulario(seccion, archivoOrigen, advertencias) {
  const datos = kvMap(parsePipeTable(seccion.body));
  const idDelArchivo = archivoOrigen.replace(/^schema_/, '').replace(/\.md$/i, '');
  const siNo = (texto, columna) => valorSiNo(texto ?? EM_DASH, advertencias, 'Datos del formulario', '—', columna);
  const camposNuevos = kvGet(datos, 'Campos nuevos o modificados');
  return {
    id: idDelArchivo,
    formulario: kvGet(datos, 'Formulario') ?? null,
    proyecto_repo: kvGet(datos, 'Proyecto / repo') ?? null,
    protocolo_referencia: kvGet(datos, 'Protocolo de referencia') ?? null,
    campos_nuevos_o_modificados: camposNuevos === undefined || isEmptyOrDash(camposNuevos) ? null : camposNuevos,
    vive_en_modal: siNo(kvGet(datos, '¿Vive en un modal?', 'Vive en un modal'), '¿Vive en un modal?'),
    tiene_prellenado: siNo(
      kvGet(datos, '¿Algún campo se pre-llena automáticamente', 'Algún campo se pre-llena'),
      '¿Algún campo se pre-llena automáticamente?',
    ),
    responsable: kvGet(datos, 'Responsable (Desarrollador)', 'Responsable') ?? null,
    fecha_creacion: parseFecha(kvGet(datos, 'Fecha de creación') ?? EM_DASH),
  };
}

// --- Tabla 1 ---------------------------------------------------------------------------------

function columnasTabla1(encabezados, advertencias) {
  const columnas = {
    campo: colIndex(encabezados, 'Campo'),
    tipo: colIndex(encabezados, 'Tipo de dato'),
    obligatorio: colIndex(encabezados, 'Obligatorio'),
    rango: colIndex(encabezados, 'Rango/Límite', 'Rango/Limite'),
    defecto: colIndex(encabezados, 'Valor por defecto'),
    unico: colIndex(encabezados, 'Único', 'Unico'),
    depende: colIndex(encabezados, 'Depende de'),
    regla: colIndex(encabezados, 'Regla de dependencia'),
    mensaje: colIndex(encabezados, 'Mensaje de error'),
    capas: colIndex(encabezados, 'Capas aplicables'),
  };
  const nombres = {
    campo: 'Campo',
    tipo: 'Tipo de dato',
    obligatorio: 'Obligatorio',
    rango: 'Rango/Límite',
    defecto: 'Valor por defecto',
    unico: 'Único',
    depende: 'Depende de',
    regla: 'Regla de dependencia',
    mensaje: 'Mensaje de error',
    capas: 'Capas aplicables (Front/Back/BD)',
  };
  for (const [clave, indice] of Object.entries(columnas)) {
    if (indice < 0) advertencias.push(`Tabla 1${WARN_SEP}—${WARN_SEP}${nombres[clave]}: columna ausente en el .md`);
  }
  return columnas;
}

function filaTabla1(fila, columnas, campoId, campo, advertencias) {
  const celda = (indice) => (indice >= 0 ? cellOriginal(fila[indice]) : EM_DASH);
  const siNo = (indice, columna) => (indice >= 0 ? valorSiNo(fila[indice], advertencias, 'Tabla 1', campo, columna) : siNoVacio());
  const textoTipo = celda(columnas.tipo);
  const textoDefecto = celda(columnas.defecto);
  const textoRegla = celda(columnas.regla);
  // Se calculan en este orden para que las advertencias salgan en el mismo orden de siempre.
  const tipoDato = {
    categoria: columnas.tipo >= 0 ? categoriaTipoDato(textoTipo, advertencias, campo) : 'otro',
    solo_lectura: fold(textoTipo).includes('solo lectura') || fold(textoTipo).includes('readonly'),
    texto_original: textoTipo,
  };
  const rangoLimite = columnas.rango >= 0
    ? parseRangoLimite(fila[columnas.rango], advertencias, campo)
    : { minimo: null, maximo: null, longitud_maxima: null, texto_original: null };
  return {
    campo,
    campo_id: campoId,
    tipo_dato: tipoDato,
    obligatorio: siNo(columnas.obligatorio, 'Obligatorio'),
    rango_limite: rangoLimite,
    valor_por_defecto: isEmptyOrDash(textoDefecto) ? null : textoDefecto,
    unico: siNo(columnas.unico, 'Único'),
    depende_de: columnas.depende >= 0 ? parseDependeDe(fila[columnas.depende]) : { campos: [], texto_original: null },
    regla_dependencia: isEmptyOrDash(textoRegla) ? null : textoRegla,
    mensajes_error: columnas.mensaje >= 0 ? parseMensajes(fila[columnas.mensaje]) : { mensajes: [], texto_original: null },
    capas: columnas.capas >= 0
      ? parseCapas(fila[columnas.capas])
      : { front: false, back: false, bd: false, texto_original: null },
  };
}

// Devuelve las filas de la Tabla 1 y el mapa campo_id → nombre que usan las demás tablas.
export function convertirTabla1(tabla, advertencias) {
  const columnas = columnasTabla1(tabla.headers, advertencias);
  const usados = new Map();
  const idsTabla1 = new Map();
  const filas = tabla.rows.map((fila) => {
    avisarFilaIrregular(fila, tabla.headers, 'Tabla 1', columnas.campo, advertencias);
    const campo = columnas.campo >= 0 ? cellOriginal(fila[columnas.campo]) : EM_DASH;
    const { id, duplicate } = makeCampoId(campo, usados);
    if (duplicate) avisarIdDuplicado('Tabla 1', campo, id, advertencias);
    idsTabla1.set(id, campo);
    if (fila.some((celda) => hasTemplateBrackets(celda))) {
      advertencias.push(`Tabla 1${WARN_SEP}${campo}${WARN_SEP}—: queda texto de plantilla entre corchetes`);
    }
    return filaTabla1(fila, columnas, id, campo, advertencias);
  });
  return { filas, idsTabla1 };
}

// --- Tabla 2 ---------------------------------------------------------------------------------

function filaTabla2(fila, columnas, idsTabla1, usados, advertencias) {
  avisarFilaIrregular(fila, columnas.encabezados, 'Tabla 2', columnas.campo, advertencias);
  const campo = columnas.campo >= 0 ? cellOriginal(fila[columnas.campo]) : EM_DASH;
  const { id, duplicate } = makeCampoId(campo, usados);
  if (duplicate) avisarIdDuplicado('Tabla 2', campo, id, advertencias);
  const idPorNombre = idEnTabla1PorNombre(idsTabla1, campo);
  if (!idsTabla1.has(id) && idPorNombre === undefined) {
    advertencias.push(`Tabla 2${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id no existe en la Tabla 1`);
  }
  return {
    campo,
    campo_id: idPorNombre ?? id,
    orden_tabulacion: columnas.orden >= 0
      ? parseOrdenTab(fila[columnas.orden])
      : { tipo: 'no_aplica', posicion: null, texto_original: null },
    deshabilitado: columnas.deshabilitado >= 0
      ? valorSiNo(fila[columnas.deshabilitado], advertencias, 'Tabla 2', campo, 'Deshabilitado')
      : siNoVacio(),
    foco_automatico: columnas.foco >= 0
      ? parseFoco(fila[columnas.foco])
      : { tiene: false, momento: null, texto_original: null },
  };
}

export function convertirTabla2(tabla, idsTabla1, advertencias) {
  if (!tabla) return [];
  const columnas = {
    encabezados: tabla.headers,
    campo: colIndex(tabla.headers, 'Campo'),
    orden: colIndex(tabla.headers, 'Orden de tabulación', 'Orden de tabulacion'),
    deshabilitado: colIndex(tabla.headers, 'Deshabilitado'),
    foco: colIndex(tabla.headers, 'Foco automático', 'Foco automatico'),
  };
  const usados = new Map();
  return tabla.rows.map((fila) => filaTabla2(fila, columnas, idsTabla1, usados, advertencias));
}

// --- Tabla 3 ---------------------------------------------------------------------------------

function filaTabla3(fila, columnas, idsTabla1, usados, advertencias) {
  const campo = columnas.campo >= 0 ? cellOriginal(fila[columnas.campo]) : EM_DASH;
  const { id, duplicate } = makeCampoId(campo, usados);
  if (duplicate) avisarIdDuplicado('Tabla 3', campo, id, advertencias);
  const idPorNombre = idEnTabla1PorNombre(idsTabla1, campo);
  if (idPorNombre === undefined) advertencias.push(`Tabla 3${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id no existe en la Tabla 1`);
  const siNo = (indice, columna) => (indice >= 0 ? valorSiNo(fila[indice], advertencias, 'Tabla 3', campo, columna) : siNoVacio());
  return {
    campo,
    campo_id: idPorNombre ?? id,
    tiene_prellenado: siNo(columnas.tiene, '¿Tiene pre-llenado?'),
    origen: columnas.origen >= 0
      ? parseOrigen(fila[columnas.origen], advertencias, campo)
      : { valor: null, texto_original: null },
    editable: siNo(columnas.editable, 'Editable manualmente'),
  };
}

// Sin la sección devuelve null; con la sección pero sin tabla parseable, una lista vacía.
export function convertirTabla3(seccion, idsTabla1, advertencias) {
  if (!seccion) return null;
  const tabla = parsePipeTable(seccion.body);
  if (!tabla) return [];
  const columnas = {
    campo: colIndex(tabla.headers, 'Campo'),
    tiene: colIndex(tabla.headers, '¿Tiene pre-llenado?', 'Tiene pre-llenado'),
    origen: colIndex(tabla.headers, 'Origen del pre-llenado'),
    editable: colIndex(tabla.headers, 'Editable manualmente'),
  };
  const usados = new Map();
  return tabla.rows.map((fila) => filaTabla3(fila, columnas, idsTabla1, usados, advertencias));
}
