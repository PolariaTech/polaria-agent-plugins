// Pruebas de POL-263: scripts/armar-codigo.mjs arma el código del runner de Nivel 2 sin filtrar credenciales.
// Se corren con: node --test "plugins/validacion-formularios/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = path.join(__dirname, '..', 'skills', 'validacion-formularios-polaria', 'scripts', 'armar-codigo.mjs');
const FIXTURE = path.join(__dirname, 'fixtures', 'modal-simple.json');
const SIN_TABLA_4 = path.join(__dirname, 'fixtures', 'sin-tabla-4.json');
const USUARIO = 'NIVEL2_USUARIO_ADMINISTRADOR_DE_CUENTA';
const CONTRASENA = 'NIVEL2_CONTRASENA_ADMINISTRADOR_DE_CUENTA';

function repoTemporal(env) {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'armar-codigo-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: carpeta });
  if (env !== undefined) fs.writeFileSync(path.join(carpeta, '.env'), env);
  return carpeta;
}

function correr(carpeta, argumentos, entorno = {}) {
  const limpio = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NIVEL2_')));
  return spawnSync(process.execPath, [SCRIPT, ...argumentos], { cwd: carpeta, encoding: 'utf8', env: { ...limpio, ...entorno } });
}

const BASE = ['--schema', FIXTURE, '--base-url', 'http://localhost:3001', '--production-url', 'https://wms.polaria.tech'];

test('con las credenciales en el .env: escribe el código dentro de .git/ y solo imprime la ruta', () => {
  const repo = repoTemporal(`${USUARIO}=ana@prueba.test\n${CONTRASENA}="Clave-123"\n`);
  const r = correr(repo, BASE);
  assert.strictEqual(r.status, 0, r.stderr);
  const ruta = r.stdout.trim();
  assert.match(ruta, /\.git[\\/]polaria-nivel2[\\/]codigo-sintetico_modal_simple\.js$/);
  assert.doesNotMatch(r.stdout + r.stderr, /Clave-123|ana@prueba\.test/, 'nunca imprime las credenciales');
  const codigo = fs.readFileSync(path.join(repo, ruta), 'utf8');
  assert.match(codigo, /^async \(page\) => \{/);
  assert.match(codigo, /Clave-123/, 'el archivo sí lleva las credenciales: por eso va dentro de .git/');
  assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--', '.git'], { cwd: repo, encoding: 'utf8' }).trim(), '');
  assert.doesNotThrow(() => vm.runInNewContext(`(${codigo})`, {}), 'el código compila');
});

test('el código lleva el origen del schema, la URL y el entorno local', () => {
  const repo = repoTemporal(`${USUARIO}=u\n${CONTRASENA}=p\n`);
  const ruta = correr(repo, [...BASE, '--schema-source', 'flujos']).stdout.trim();
  const codigo = fs.readFileSync(path.join(repo, ruta), 'utf8');
  assert.match(codigo, /"schema_source":"flujos"/);
  assert.match(codigo, /"environment":"local"/);
  assert.match(codigo, /"base_url":"http:\/\/localhost:3001"/);
  assert.match(codigo, /"production_url":"https:\/\/wms\.polaria\.tech"/);
});

test('sin credenciales: sale con 3 y lista los nombres de las variables, sin crear el archivo', () => {
  const repo = repoTemporal();
  const r = correr(repo, BASE);
  assert.strictEqual(r.status, 3);
  assert.ok(r.stderr.includes(USUARIO) && r.stderr.includes(CONTRASENA));
  assert.match(r.stderr, /\.env/);
  assert.strictEqual(fs.existsSync(path.join(repo, '.git', 'polaria-nivel2')), false);
});

test('las credenciales también se leen del entorno', () => {
  const repo = repoTemporal();
  const r = correr(repo, BASE, { [USUARIO]: 'u@prueba.test', [CONTRASENA]: 'p-123' });
  assert.strictEqual(r.status, 0, r.stderr);
});

test('falta solo una credencial: sale con 3 y nombra la que falta', () => {
  const repo = repoTemporal(`${USUARIO}=ana@prueba.test\n`);
  const r = correr(repo, BASE);
  assert.strictEqual(r.status, 3);
  assert.ok(r.stderr.includes(CONTRASENA));
  assert.ok(!r.stderr.includes(`${USUARIO},`));
});

test('un schema sin Tabla 4 se rechaza con un mensaje claro', () => {
  const repo = repoTemporal(`${USUARIO}=u\n${CONTRASENA}=p\n`);
  const r = correr(repo, ['--schema', SIN_TABLA_4, '--base-url', 'http://localhost:3001', '--production-url', 'https://wms.polaria.tech']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /no tiene prueba_nivel_2/);
});

test('faltan argumentos o el origen del schema es inválido: error de uso', () => {
  const repo = repoTemporal(`${USUARIO}=u\n${CONTRASENA}=p\n`);
  assert.strictEqual(correr(repo, ['--schema', FIXTURE]).status, 1);
  assert.strictEqual(correr(repo, [...BASE, '--schema-source', 'otro']).status, 1);
  assert.strictEqual(correr(repo, ['--schema', path.join(repo, 'no-existe.json'), '--base-url', 'x', '--production-url', 'y']).status, 1);
});

test('--borrar elimina el archivo con el código', () => {
  const repo = repoTemporal(`${USUARIO}=u\n${CONTRASENA}=p\n`);
  const ruta = correr(repo, BASE).stdout.trim();
  assert.strictEqual(fs.existsSync(path.join(repo, ruta)), true);
  assert.strictEqual(correr(repo, ['--borrar', path.join(repo, ruta)]).status, 0);
  assert.strictEqual(fs.existsSync(path.join(repo, ruta)), false);
});

test('el .env acepta comillas, comentarios y export, y el entorno manda sobre el archivo', () => {
  const repo = repoTemporal(`# credenciales\nexport ${USUARIO}='ana@prueba.test'\n${CONTRASENA}=del-archivo\n`);
  const ruta = correr(repo, BASE, { [CONTRASENA]: 'del-entorno' }).stdout.trim();
  const codigo = fs.readFileSync(path.join(repo, ruta), 'utf8');
  assert.match(codigo, /del-entorno/);
  assert.doesNotMatch(codigo, /del-archivo/);
  assert.match(codigo, /ana@prueba\.test/);
});

test('la copia del runner de la skill tiene la marca de versión y el contrato de armado', () => {
  const fuente = fs.readFileSync(path.join(path.dirname(SCRIPT), 'nivel2-runner.js'), 'utf8');
  assert.match(fuente, /const RUNNER_VERSION = '1\.0\.0';/);
  assert.match(fuente, /<<RUNNER_INICIO>>/);
  assert.match(fuente, /<<RUNNER_FIN>>/);
});
