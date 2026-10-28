// Pruebas de POL-263: scripts/schema-a-json.mjs convierte un schema .md al JSON formato 1.0 y falla con un mensaje claro.
// Se corren con: node --test "plugins/validacion-formularios/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = path.join(__dirname, '..', 'skills', 'validacion-formularios-polaria', 'scripts', 'schema-a-json.mjs');
const PLANTILLA = path.join(__dirname, '..', 'skills', 'validacion-formularios-polaria', 'references', 'PLANTILLA_SCHEMA_DE_CAMPOS_v1.1.md');

// Carpeta temporal que hace de repo del dev, con la plantilla copiada como schemas/schema_prueba.md.
function repoConSchema({ version } = {}) {
  const carpeta = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'schema-a-json-')));
  fs.mkdirSync(path.join(carpeta, 'schemas'));
  fs.copyFileSync(PLANTILLA, path.join(carpeta, 'schemas', 'schema_prueba.md'));
  if (version !== undefined) fs.writeFileSync(path.join(carpeta, 'VERSION'), version);
  return carpeta;
}

function convertir(carpeta, argumentos) {
  return spawnSync(process.execPath, [SCRIPT, ...argumentos], { cwd: carpeta, encoding: 'utf8' });
}

test('convierte el schema y escribe el JSON formato 1.0 con la ruta de origen relativa al repo del dev', () => {
  const repo = repoConSchema();
  const resultado = convertir(repo, [path.join('schemas', 'schema_prueba.md'), path.join('salida', 'schema_prueba.json')]);
  assert.strictEqual(resultado.status, 0, resultado.stderr);
  assert.match(resultado.stdout, /^Escrito .*schema_prueba\.json/m);
  assert.match(resultado.stdout, /^advertencias: \d+/m);
  const json = JSON.parse(fs.readFileSync(path.join(repo, 'salida', 'schema_prueba.json'), 'utf8'));
  assert.strictEqual(json.formato, 'polaria.schema-formulario');
  assert.strictEqual(json.version_formato, '1.0');
  assert.strictEqual(json.exportacion.archivo_origen, 'schema_prueba.md');
  assert.strictEqual(json.exportacion.ruta_origen, 'schemas/schema_prueba.md');
  assert.strictEqual(json.exportacion.version_portal, null);
  assert.strictEqual(json.exportacion.hash_origen, crypto.createHash('sha256').update(fs.readFileSync(PLANTILLA, 'utf8')).digest('hex'));
});

test('lee la versión del archivo VERSION del repo del dev, no de la carpeta del plugin', () => {
  const repo = repoConSchema({ version: '1.2.3\n' });
  const resultado = convertir(repo, [path.join('schemas', 'schema_prueba.md'), 'salida.json']);
  assert.strictEqual(resultado.status, 0, resultado.stderr);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(repo, 'salida.json'), 'utf8')).exportacion.version_portal, '1.2.3');
});

test('sin ruta de salida falla con un mensaje y no escribe nada en el repo ni en el plugin', () => {
  const repo = repoConSchema();
  const resultado = convertir(repo, [path.join('schemas', 'schema_prueba.md')]);
  assert.strictEqual(resultado.status, 1);
  assert.match(resultado.stderr, /^ERROR: falta la ruta del JSON de salida/);
  assert.deepStrictEqual(fs.readdirSync(repo).sort(), ['schemas']);
  assert.ok(!fs.existsSync(path.join(path.dirname(SCRIPT), '..', 'public')), 'no debe crear public/ dentro del plugin');
});

test('convertFile sin ruta de salida lanza el error y no escribe nada', async () => {
  const { convertFile } = await import(pathToFileURL(SCRIPT).href);
  const repo = repoConSchema();
  assert.throws(() => convertFile(path.join(repo, 'schemas', 'schema_prueba.md')), /Falta la ruta del JSON de salida/);
  assert.deepStrictEqual(fs.readdirSync(repo).sort(), ['schemas']);
});

test('un schema inexistente falla con "ERROR:" y sin volcado de pila', () => {
  const repo = repoConSchema();
  const resultado = convertir(repo, [path.join('schemas', 'no-existe.md'), 'salida.json']);
  assert.strictEqual(resultado.status, 1);
  assert.match(resultado.stderr, /^ERROR: ENOENT/);
  assert.ok(!/\n\s+at /.test(resultado.stderr), resultado.stderr);
  assert.ok(!fs.existsSync(path.join(repo, 'salida.json')));
});

test('un Markdown que no es un schema falla con el nombre de la sección que falta', () => {
  const repo = repoConSchema();
  fs.writeFileSync(path.join(repo, 'schemas', 'no_es_schema.md'), 'no es un schema\n');
  const resultado = convertir(repo, [path.join('schemas', 'no_es_schema.md'), 'salida.json']);
  assert.strictEqual(resultado.status, 1);
  assert.match(resultado.stderr, /^ERROR: Falta la sección: Datos del formulario/);
  assert.ok(!/\n\s+at /.test(resultado.stderr), resultado.stderr);
  assert.ok(!fs.existsSync(path.join(repo, 'salida.json')));
});

test('--help imprime el uso con código 0 y sin argumentos sale con código 1', () => {
  const repo = repoConSchema();
  const ayuda = convertir(repo, ['--help']);
  assert.strictEqual(ayuda.status, 0);
  assert.match(ayuda.stdout, /Uso:\s+node schema-a-json\.mjs <ruta-del-schema\.md> <ruta-del-json-de-salida>/);
  assert.strictEqual(convertir(repo, []).status, 1);
});
