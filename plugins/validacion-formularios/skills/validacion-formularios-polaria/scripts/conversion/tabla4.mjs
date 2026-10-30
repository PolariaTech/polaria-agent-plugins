// Conversión de la Tabla 4 (prueba del Nivel 2), las notas y la versión del schema.
import { EM_DASH, WARN_SEP, cellOriginal, fold, isEmptyOrDash } from './utilidades.mjs';
import { colIndex, findNestedTable, kvGet, kvMap, makeCampoId, parsePipeTable } from './markdown.mjs';
import { parseFecha, parseLocalizador } from './celdas-basicas.mjs';
import { parseArchivos, parsePasosAbrir } from './celdas-tablas.mjs';
import { avisarCamposSinFila } from './tablas.mjs';

const CAMPOS_TABLA_4 = 'Tabla 4.2';

function rolYRuta(mapa, advertencias) {
  const rol = kvGet(mapa, 'Rol con que se inicia sesión', 'Rol') ?? EM_DASH;
  const ruta = kvGet(mapa, 'Ruta / URL', 'Ruta') ?? EM_DASH;
  if (isEmptyOrDash(rol) || isEmptyOrDash(ruta)) {
    advertencias.push(`Tabla 4${WARN_SEP}—${WARN_SEP}Rol/Ruta: sin rol y ruta no se puede abrir el formulario`);
  }
  return { rol, ruta };
}

function acceso(mapa, { rol, ruta }, advertencias) {
  const pasos = kvGet(mapa, 'Pasos para abrir el formulario') ?? EM_DASH;
  const registro = kvGet(mapa, 'Registro que debe existir') ?? EM_DASH;
  const archivos = kvGet(mapa, 'Archivos del formulario') ?? EM_DASH;
  return {
    rol,
    ruta,
    pasos_abrir: parsePasosAbrir(pasos, advertencias),
    registro_requerido: isEmptyOrDash(registro) ? null : registro,
    archivos_formulario: parseArchivos(archivos, advertencias),
  };
}

function botones(mapa, advertencias) {
  const localizador = (texto, etiqueta) => parseLocalizador(texto, advertencias, 'Tabla 4.1', '—', etiqueta);
  const opcional = (texto, etiqueta) => (isEmptyOrDash(texto) ? null : localizador(texto, etiqueta));
  const guardar = kvGet(mapa, 'Botón Guardar', 'Boton Guardar') ?? EM_DASH;
  const cancelar = kvGet(mapa, 'Botón Cancelar / Cerrar', 'Botón Cancelar') ?? EM_DASH;
  const descarteConfirma = kvGet(mapa, 'Diálogo de descarte: botón que confirma', 'Dialogo de descarte: botón que confirma') ?? EM_DASH;
  const descarteSigue = kvGet(mapa, 'Diálogo de descarte: botón para seguir editando') ?? EM_DASH;
  const advertencia = kvGet(mapa, 'Botón de la advertencia no-saltable') ?? EM_DASH;
  return {
    guardar: localizador(guardar, 'Botón Guardar'),
    cancelar: opcional(cancelar, 'Botón Cancelar / Cerrar'),
    descarte_confirmar: opcional(descarteConfirma, 'Diálogo de descarte: botón que confirma'),
    descarte_seguir_editando: opcional(descarteSigue, 'Diálogo de descarte: botón para seguir editando'),
    advertencia_confirmar: opcional(advertencia, 'Botón de la advertencia no-saltable'),
  };
}

function campoTabla4(fila, columnas, idsTabla1, usados, advertencias) {
  const campo = columnas.campo >= 0 ? cellOriginal(fila[columnas.campo]) : EM_DASH;
  const { id, duplicate } = makeCampoId(campo, usados);
  if (duplicate) advertencias.push(`${CAMPOS_TABLA_4}${WARN_SEP}${campo}${WARN_SEP}Campo: campo_id duplicado; se usó ${id}`);
  const coincidencia = [...idsTabla1.entries()].find(([, nombre]) => fold(nombre) === fold(campo));
  if (!coincidencia) advertencias.push(`${CAMPOS_TABLA_4}${WARN_SEP}${campo}${WARN_SEP}Campo: fila no existe en la Tabla 1`);
  const valor = columnas.valor >= 0 ? cellOriginal(fila[columnas.valor]) : EM_DASH;
  return {
    campo,
    campo_id: coincidencia ? coincidencia[0] : id,
    localizador: columnas.localizador >= 0
      ? parseLocalizador(fila[columnas.localizador], advertencias, CAMPOS_TABLA_4, campo, 'Localizador')
      : null,
    valor_de_prueba: isEmptyOrDash(valor) ? null : valor,
  };
}

function camposTabla4(tabla, idsTabla1, advertencias) {
  if (!tabla) return [];
  const columnas = {
    campo: colIndex(tabla.headers, 'Campo'),
    localizador: colIndex(tabla.headers, 'Localizador'),
    valor: colIndex(tabla.headers, 'Valor de prueba'),
  };
  const usados = new Map();
  return tabla.rows.map((fila) => campoTabla4(fila, columnas, idsTabla1, usados, advertencias));
}

export function convertirTabla4(seccion, filasTabla1, idsTabla1, advertencias) {
  if (!seccion) {
    advertencias.push(`Tabla 4${WARN_SEP}—${WARN_SEP}—: el schema no tiene Tabla 4; la prueba automatizada del Nivel 2 no se puede ejecutar`);
    return null;
  }
  const tablaAcceso = findNestedTable(seccion.body, 'Acceso y botones') || findNestedTable(seccion.body, '4.1') || null;
  const tablaCampos = findNestedTable(seccion.body, '4.2') || findNestedTable(seccion.body, 'Campos') || null;
  const mapa = kvMap(tablaAcceso);
  const datosRolYRuta = rolYRuta(mapa, advertencias);
  const campos = camposTabla4(tablaCampos, idsTabla1, advertencias);
  avisarCamposSinFila(
    filasTabla1,
    new Set(campos.map((campo) => campo.campo_id)),
    CAMPOS_TABLA_4,
    'Campo: campo de la Tabla 1 sin fila en la Tabla 4.2',
    advertencias,
  );
  // Acceso y botones se convierten al final para que sus advertencias salgan después de las de los campos.
  return { acceso: acceso(mapa, datosRolYRuta, advertencias), botones: botones(mapa, advertencias), campos };
}

export function convertirNotas(seccion) {
  if (!seccion) return null;
  const cuerpo = seccion.body.replace(/^\s+|\s+$/g, '');
  const plano = cuerpo.replace(/\s+/g, ' ').trim();
  if (/^sin notas\.?$/i.test(plano)) return null;
  return cuerpo || null;
}

export function convertirVersion(seccion) {
  const mapa = kvMap(seccion ? parsePipeTable(seccion.body) : null);
  return {
    version_schema: kvGet(mapa, 'Versión del schema') ?? null,
    fecha_aprobacion: parseFecha(kvGet(mapa, 'Fecha de aprobación') ?? EM_DASH),
    aprobado_por: kvGet(mapa, 'Aprobado por') ?? null,
    proxima_revision: kvGet(mapa, 'Próxima revisión') ?? null,
  };
}
