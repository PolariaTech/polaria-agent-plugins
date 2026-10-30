#!/usr/bin/env node
// Arma el código del runner de Nivel 2 para `browser_run_code_unsafe` (Paso 5 de la skill, references/prueba-nivel-2.md).
//
// Uso:
//   node armar-codigo.mjs --schema <JSON del formulario> --base-url <URL de la app> --production-url <URL de producción>
//        [--schema-source working_copy|flujos] [--env-file <ruta del .env>] [--salida <archivo>]
//   node armar-codigo.mjs --borrar <archivo>
//
// Lee las credenciales del rol de la Tabla 4 en NIVEL2_USUARIO_<ROL> y NIVEL2_CONTRASENA_<ROL>, del archivo
// --env-file o del entorno. Escribe el código en un archivo (por defecto dentro de .git/, que git nunca sube) y
// solo imprime su ruta: el código lleva las credenciales, así que no se pega en el chat ni se commitea, y se borra
// con --borrar al terminar. Salidas: 0 listo, 1 error de uso o de lectura, 3 faltan credenciales (lista los nombres).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARPETA = dirname(fileURLToPath(import.meta.url));

function salir(codigo, mensaje) {
  process.stderr.write(`${mensaje}\n`);
  process.exit(codigo);
}

function leerArgumentos() {
  const argumentos = process.argv.slice(2);
  const opciones = {};
  for (let i = 0; i < argumentos.length; i += 2) {
    if (!argumentos[i].startsWith('--') || argumentos[i + 1] === undefined) salir(1, `Argumento inválido: ${argumentos[i]}`);
    opciones[argumentos[i].slice(2)] = argumentos[i + 1];
  }
  return opciones;
}

// Lee un .env simple: CLAVE=valor por línea, con o sin comillas. No evalúa nada.
function leerEnv(ruta) {
  const variables = {};
  let texto;
  try {
    texto = readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  } catch {
    return variables;
  }
  for (const linea of texto.split(/\r?\n/)) {
    const coincidencia = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!coincidencia) continue;
    const valor = coincidencia[2];
    variables[coincidencia[1]] = /^(['"]).*\1$/.test(valor) ? valor.slice(1, -1) : valor;
  }
  return variables;
}

function carpetaDeSalida() {
  try {
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return join(resolve(gitDir), 'polaria-nivel2');
  } catch {
    return resolve('.polaria-nivel2');
  }
}

// El runner es un módulo ESM con extensión .js: se importa por data URL para no depender de package.json.
async function cargarRunner() {
  const fuente = readFileSync(join(CARPETA, 'nivel2-runner.js'), 'utf8');
  const modulo = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);
  return { fuente, ...modulo };
}

async function main() {
  const opciones = leerArgumentos();
  if (opciones.borrar) {
    rmSync(opciones.borrar, { force: true });
    process.stdout.write(`Borrado: ${opciones.borrar}\n`);
    return;
  }
  for (const requerido of ['schema', 'base-url', 'production-url']) if (!opciones[requerido]) salir(1, `Falta --${requerido}.`);

  let schema;
  try {
    schema = JSON.parse(readFileSync(opciones.schema, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    salir(1, `No se pudo leer ${opciones.schema} como JSON: ${error.message}`);
  }
  if (!schema.prueba_nivel_2) salir(1, 'El schema no tiene prueba_nivel_2 (Tabla 4): no hay datos para ejecutar la prueba automatizada.');
  const origen = opciones['schema-source'] || 'working_copy';
  if (!['working_copy', 'flujos'].includes(origen)) salir(1, '--schema-source es working_copy o flujos.');

  const { fuente, armarCodigo, nombreSecretoRol } = await cargarRunner();
  const rol = schema.prueba_nivel_2.acceso.rol;
  const nombres = { usuario: nombreSecretoRol(rol, 'NIVEL2_USUARIO'), contrasena: nombreSecretoRol(rol, 'NIVEL2_CONTRASENA') };
  const variables = { ...leerEnv(opciones['env-file'] || '.env'), ...process.env };
  const faltan = Object.values(nombres).filter((nombre) => !variables[nombre]);
  if (faltan.length) salir(3, `Faltan las credenciales del rol "${rol}": ${faltan.join(', ')}. Pídeselas a quien ejecuta la verificación y recomiéndale guardarlas en su .env (git lo ignora).`);

  const codigo = armarCodigo(fuente, {
    schema,
    base_url: opciones['base-url'],
    production_url: opciones['production-url'],
    environment: 'local',
    schema_source: origen,
    commit_sha: null,
    credentials: { username: variables[nombres.usuario], password: variables[nombres.contrasena] },
    options: { step_timeout_ms: 10000, capture_failures: true },
  });
  const archivo = opciones.salida ? resolve(opciones.salida) : join(carpetaDeSalida(), `codigo-${schema.datos_formulario.id}.js`);
  mkdirSync(dirname(archivo), { recursive: true });
  writeFileSync(archivo, codigo);
  process.stdout.write(`${relative(process.cwd(), archivo) || archivo}\n`);
}

main().catch((error) => salir(1, `Error inesperado: ${error.message}`));
