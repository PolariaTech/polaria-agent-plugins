// Pruebas de POL-267: un cambio sin código propio (solo documentación o código de terceros) recibe
// clasificación SIN_CODIGO_PROPIO y puede obtener marca; sin marca el hook sigue bloqueando el push.
// Se corren con: node --test "plugins/gate-calidad-tecnica/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { clasificar } = require('../hooks/clasificar-diff');

const HOOKS = path.join(__dirname, '..', 'hooks');
const SHA_VACIO = '0'.repeat(40);

function git(carpeta, ...argumentos) {
  return execFileSync('git', argumentos, { cwd: carpeta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Repo de software (tiene package.json) con un commit base en main.
function crearRepo() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-tecnico-'));
  git(carpeta, 'init', '-q', '-b', 'main');
  git(carpeta, 'config', 'user.email', 'prueba@polaria.tech');
  git(carpeta, 'config', 'user.name', 'Prueba');
  git(carpeta, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(carpeta, 'package.json'), '{}\n');
  git(carpeta, 'add', '.');
  git(carpeta, 'commit', '-q', '-m', 'base');
  git(carpeta, 'checkout', '-q', '-b', 'cambio');
  return carpeta;
}

function commitear(carpeta, archivos) {
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = path.join(carpeta, ruta);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
  }
  git(carpeta, 'add', '.');
  git(carpeta, 'commit', '-q', '-m', 'cambio');
  return git(carpeta, 'rev-parse', 'HEAD');
}

function clasificarEnRepo(carpeta) {
  return spawnSync('node', [path.join(HOOKS, 'clasificar-diff.js'), 'main'], { cwd: carpeta, encoding: 'utf8' });
}

function pushDeGit(carpeta, sha) {
  return spawnSync('node', [path.join(HOOKS, 'verificar-gate.js'), '--git-pre-push'], {
    cwd: carpeta,
    encoding: 'utf8',
    input: `refs/heads/cambio ${sha} refs/heads/cambio ${SHA_VACIO}\n`,
  });
}

function registrar(carpeta, veredicto) {
  return spawnSync('node', [path.join(HOOKS, 'registrar-veredicto.js'), veredicto], { cwd: carpeta, encoding: 'utf8' });
}

test('clasificar: solo documentación o código de terceros es SIN_CODIGO_PROPIO', () => {
  assert.strictEqual(clasificar(['README.md', 'docs/guia.md']).clasificacion, 'SIN_CODIGO_PROPIO');
  assert.strictEqual(clasificar(['.specify/scripts/bash/setup-plan.sh', '.specify/memory/constitution.md']).clasificacion, 'SIN_CODIGO_PROPIO');
  assert.strictEqual(clasificar(['specs/001-algo/plan.md']).clasificacion, 'SIN_CODIGO_PROPIO');
});

test('clasificar: cualquier otro archivo es CON_CODIGO_PROPIO y se lista', () => {
  const mezcla = clasificar(['README.md', 'src/servicio.ts', 'package.json']);
  assert.strictEqual(mezcla.clasificacion, 'CON_CODIGO_PROPIO');
  assert.deepStrictEqual(mezcla.archivos, ['src/servicio.ts', 'package.json']);
  assert.strictEqual(clasificar(['specs/001-algo/contrato.json']).clasificacion, 'CON_CODIGO_PROPIO');
  assert.strictEqual(clasificar(['.claude/settings.json']).clasificacion, 'CON_CODIGO_PROPIO');
  assert.strictEqual(clasificar(['notas.md.js']).clasificacion, 'CON_CODIGO_PROPIO');
});

test('clasificar: un diff vacío no es SIN_CODIGO_PROPIO', () => {
  assert.strictEqual(clasificar([]).clasificacion, 'CON_CODIGO_PROPIO');
});

test('clasificar-diff.js: commit de solo documentación y spec-kit', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'README.md': '# hola\n', '.specify/memory/constitution.md': 'x\n', 'specs/001/spec.md': 'y\n' });
  const resultado = clasificarEnRepo(carpeta);
  assert.strictEqual(resultado.status, 0);
  assert.strictEqual(resultado.stdout.trim(), 'SIN_CODIGO_PROPIO');
});

test('clasificar-diff.js: commit que mezcla documentación y código propio', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'README.md': '# hola\n', 'src/app.js': 'module.exports = 1;\n' });
  const resultado = clasificarEnRepo(carpeta);
  assert.strictEqual(resultado.status, 0);
  assert.deepStrictEqual(resultado.stdout.trim().split('\n'), ['CON_CODIGO_PROPIO', 'src/app.js']);
});

test('clasificar-diff.js: un archivo de código borrado cuenta como código propio', () => {
  const carpeta = crearRepo();
  fs.mkdirSync(path.join(carpeta, 'src'));
  fs.writeFileSync(path.join(carpeta, 'src', 'viejo.js'), 'x\n');
  git(carpeta, 'add', '.');
  git(carpeta, 'commit', '-q', '-m', 'agrega viejo');
  git(carpeta, 'checkout', '-q', '-b', 'borra', 'HEAD');
  git(carpeta, 'branch', '-f', 'main', 'HEAD');
  fs.rmSync(path.join(carpeta, 'src', 'viejo.js'));
  git(carpeta, 'add', '-A');
  git(carpeta, 'commit', '-q', '-m', 'borra viejo');
  assert.deepStrictEqual(clasificarEnRepo(carpeta).stdout.trim().split('\n'), ['CON_CODIGO_PROPIO', 'src/viejo.js']);
});

test('hook pre-push: el commit de solo documentación sin marca sigue bloqueado', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'README.md': '# hola\n' });
  const resultado = pushDeGit(carpeta, sha);
  assert.strictEqual(resultado.status, 1);
  assert.match(resultado.stderr, /no tiene veredicto/);
});

test('hook pre-push: el commit de solo documentación con la marca APROBADO que registra la skill pasa', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'README.md': '# hola\n' });
  assert.strictEqual(registrar(carpeta, 'APROBADO').status, 0);
  assert.strictEqual(pushDeGit(carpeta, sha).status, 0);
});

test('hook pre-push: RECHAZADO nunca deja pasar, tampoco en solo documentación', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'README.md': '# hola\n' });
  assert.strictEqual(registrar(carpeta, 'RECHAZADO').status, 0);
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
});

test('hook pre-push: la marca de un commit no sirve para el commit siguiente', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'README.md': '# hola\n' });
  registrar(carpeta, 'APROBADO');
  const siguiente = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(pushDeGit(carpeta, siguiente).status, 1);
});
