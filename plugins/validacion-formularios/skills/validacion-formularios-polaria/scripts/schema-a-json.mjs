#!/usr/bin/env node
/**
 * Conversor portable schema_*.md → JSON (Formato 1.0).
 * Uso (desde la raíz del repo del dev):
 *   node schema-a-json.mjs <ruta-del-schema.md> <ruta-del-json-de-salida>
 *
 * Copia adaptada para el plugin validacion-formularios: respecto del conversor del repo flujos
 * no trae --all, --mvp ni --self-check (dependían de rutas fijas de ese repo) y la ruta de salida
 * es obligatoria, para que nunca escriba dentro de la carpeta del plugin. Además se partió en los
 * módulos de ./conversion/ (todos con extensión .mjs): al copiar el conversor a otro lado, se copia
 * la carpeta completa junto con este archivo.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, isoNow, readPortalVersion, sha256Hex } from './conversion/utilidades.mjs';
import { findSections, parsePipeTable } from './conversion/markdown.mjs';
import {
  avisarCamposSinFila,
  convertirDatosFormulario,
  convertirTabla1,
  convertirTabla2,
  convertirTabla3,
} from './conversion/tablas.mjs';
import { convertirNotas, convertirTabla4, convertirVersion } from './conversion/tabla4.mjs';

const __filename = fileURLToPath(import.meta.url);

const SECCIONES_OBLIGATORIAS = [
  ['datos', 'Datos del formulario'],
  ['tabla1', 'Tabla 1'],
  ['tabla2', 'Tabla 2'],
];

function errorDeSeccion(mensaje) {
  const error = new Error(mensaje);
  error.code = 'MISSING_SECTION';
  return error;
}

export function convertSchemaMarkdown(md, options = {}) {
  const advertencias = [];
  const archivoOrigen = options.archivo_origen ?? 'schema_unknown.md';
  const secciones = findSections(md);
  for (const [clave, nombre] of SECCIONES_OBLIGATORIAS) {
    if (!secciones[clave]) throw errorDeSeccion(`Falta la sección: ${nombre}`);
  }

  const datosFormulario = convertirDatosFormulario(secciones.datos, basename(archivoOrigen), advertencias);
  const tabla1 = parsePipeTable(secciones.tabla1.body);
  if (!tabla1) throw errorDeSeccion('Tabla 1 sin tabla parseable');
  const { filas: tabla1Validacion, idsTabla1 } = convertirTabla1(tabla1, advertencias);
  const tabla2Interaccion = convertirTabla2(parsePipeTable(secciones.tabla2.body), idsTabla1, advertencias);
  avisarCamposSinFila(
    tabla1Validacion,
    new Set(tabla2Interaccion.map((fila) => fila.campo_id)),
    'Tabla 1',
    'Campo: no tiene fila en la Tabla 2',
    advertencias,
  );
  const tabla3Prellenado = convertirTabla3(secciones.tabla3, idsTabla1, advertencias);
  const pruebaNivel2 = convertirTabla4(secciones.tabla4, tabla1Validacion, idsTabla1, advertencias);

  return {
    formato: 'polaria.schema-formulario',
    version_formato: '1.0',
    exportacion: {
      fecha: options.fecha ?? isoNow(),
      archivo_origen: archivoOrigen,
      ruta_origen: options.ruta_origen ?? archivoOrigen,
      version_portal: options.version_portal ?? readPortalVersion(),
      hash_origen: sha256Hex(md),
    },
    datos_formulario: datosFormulario,
    tabla_1_validacion: tabla1Validacion,
    tabla_2_interaccion: tabla2Interaccion,
    tabla_3_prellenado: tabla3Prellenado,
    prueba_nivel_2: pruebaNivel2,
    notas_justificaciones: convertirNotas(secciones.notas),
    version_revision: convertirVersion(secciones.version),
    advertencias,
  };
}

export function convertFile(mdPath, outPath) {
  if (!outPath) throw new Error('Falta la ruta del JSON de salida');
  const abs = resolve(mdPath);
  const md = readFileSync(abs, 'utf8');
  const archivoOrigen = basename(abs);
  const rutaOrigen = relative(REPO_ROOT, abs).replace(/\\/g, '/');
  const json = convertSchemaMarkdown(md, { archivo_origen: archivoOrigen, ruta_origen: rutaOrigen });
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
