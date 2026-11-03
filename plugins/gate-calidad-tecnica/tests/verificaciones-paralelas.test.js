// Pruebas de correr-verificaciones.js: elección de comandos, ESLint del criterio 9 y ejecución en paralelo.
// El comportamiento del revisor que lee este bloque se prueba en el laboratorio de plugins.
// Se corren con: node --test "plugins/gate-calidad-tecnica/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  elegirComandoPruebas,
  elegirComandoBuild,
  hayReglasEslint,
  ultimasLineas,
  leerArgumentos,
} = require('../hooks/correr-verificaciones');

const SCRIPT = path.join(__dirname, '..', 'hooks', 'correr-verificaciones.js');

function carpetaTemporal(prefijo) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
}

function git(carpeta, ...argumentos) {
  return execFileSync('git', argumentos, { cwd: carpeta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Repo con main (commit base) y una rama "cambio" con un archivo .js nuevo. `scripts` va a package.json.
function crearRepo({ scripts, archivosExtra = {} }) {
  const carpeta = carpetaTemporal('gate-verificaciones-');
  git(carpeta, 'init', '-q', '-b', 'main');
  git(carpeta, 'config', 'user.email', 'prueba@polaria.tech');
  git(carpeta, 'config', 'user.name', 'Prueba');
  fs.writeFileSync(path.join(carpeta, '.gitignore'), 'salida/\n');
  if (scripts) fs.writeFileSync(path.join(carpeta, 'package.json'), JSON.stringify({ name: 'repo-prueba', scripts }));
  for (const [nombre, contenido] of Object.entries(archivosExtra)) fs.writeFileSync(path.join(carpeta, nombre), contenido);
  git(carpeta, 'add', '-A');
  git(carpeta, 'commit', '-q', '-m', 'base');
  git(carpeta, 'checkout', '-q', '-b', 'cambio');
  fs.writeFileSync(path.join(carpeta, 'nuevo.js'), 'module.exports = 1;\n');
  git(carpeta, 'add', '-A');
  git(carpeta, 'commit', '-q', '-m', 'cambio');
  return carpeta;
}

function correr(carpeta, ...argumentos) {
  const resultado = spawnSync(process.execPath, [SCRIPT, 'main', ...argumentos], { cwd: carpeta, encoding: 'utf8' });
  return { codigo: resultado.status, salida: resultado.stdout, error: resultado.stderr };
}

function esperar(segundos) {
  return `node -e "setTimeout(() => {}, ${segundos * 1000})"`;
}

test('elegirComandoPruebas: el pedido manda, luego el script test, y sin nada devuelve null', () => {
  const conTest = crearRepo({ scripts: { test: 'echo ok' } });
  const sinNada = carpetaTemporal('gate-sin-nada-');
  assert.strictEqual(elegirComandoPruebas(conTest, 'pytest -q'), 'pytest -q');
  assert.strictEqual(elegirComandoPruebas(conTest, null), 'npm test');
  assert.strictEqual(elegirComandoPruebas(sinNada, null), null);
});

test('elegirComandoBuild respeta el orden del criterio 8: pedido, vercel.json, vercel-build, build, nada', () => {
  const todo = crearRepo({
    scripts: { 'vercel-build': 'x', build: 'y' },
    archivosExtra: { 'vercel.json': JSON.stringify({ buildCommand: 'npm run compilar' }) },
  });
  const soloVercelBuild = crearRepo({ scripts: { 'vercel-build': 'x', build: 'y' } });
  const soloBuild = crearRepo({ scripts: { build: 'y' } });
  const nada = crearRepo({ scripts: { lint: 'z' } });
  assert.strictEqual(elegirComandoBuild(todo, 'npm run del-mcp'), 'npm run del-mcp');
  assert.strictEqual(elegirComandoBuild(todo, null), 'npm run compilar');
  assert.strictEqual(elegirComandoBuild(soloVercelBuild, null), 'npm run vercel-build');
  assert.strictEqual(elegirComandoBuild(soloBuild, null), 'npm run build');
  assert.strictEqual(elegirComandoBuild(nada, null), null);
});

test('hayReglasEslint exige las dos reglas del criterio 9, aunque estén en otro archivo eslint.config*', () => {
  const ambas = carpetaTemporal('gate-eslint-ambas-');
  fs.writeFileSync(path.join(ambas, 'eslint.config.mjs'), 'export default [];\n');
  fs.writeFileSync(
    path.join(ambas, 'eslint.config.limites.mjs'),
    "export default [{ rules: { 'max-lines-per-function': 'error', 'sonarjs/cognitive-complexity': 'error' } }];\n",
  );
  const unaSola = carpetaTemporal('gate-eslint-una-');
  fs.writeFileSync(path.join(unaSola, 'eslint.config.mjs'), "export default [{ rules: { 'max-lines-per-function': 'error' } }];\n");
  const ninguna = carpetaTemporal('gate-eslint-ninguna-');
  assert.strictEqual(hayReglasEslint(ambas), true);
  assert.strictEqual(hayReglasEslint(unaSola), false);
  assert.strictEqual(hayReglasEslint(ninguna), false);
});

test('ultimasLineas conserva solo el final de una salida larga', () => {
  const larga = Array.from({ length: 200 }, (_, indice) => `línea ${indice + 1}`).join('\n');
  const recorte = ultimasLineas(larga);
  assert.ok(recorte.includes('línea 200'));
  assert.ok(!recorte.includes('línea 1\n'));
  assert.ok(recorte.split('\n').length <= 60);
});

test('leerArgumentos separa la rama principal de las opciones', () => {
  const opciones = leerArgumentos(['origin/main', '--build', 'npm run x', '--pruebas', 'pytest', '--minutos-maximo', '5']);
  assert.deepStrictEqual(opciones, { principal: 'origin/main', pruebas: 'pytest', build: 'npm run x', sinBuild: false, minutosMaximo: 5 });
  assert.strictEqual(leerArgumentos(['main', '--sin-build']).sinBuild, true);
});

test('--sin-build deja el build como NO_APLICA aunque el repo tenga script build', () => {
  const carpeta = crearRepo({ scripts: { test: 'echo ok', build: 'echo no-deberia-correr' } });
  const { codigo, salida } = correr(carpeta, '--sin-build');
  assert.strictEqual(codigo, 0);
  assert.match(salida, /--- BUILD: NO_APLICA/);
  assert.ok(!salida.includes('no-deberia-correr'));
});

test('sin rama principal termina con código 1 y el uso', () => {
  const resultado = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.strictEqual(resultado.status, 1);
  assert.match(resultado.stderr, /Uso: correr-verificaciones\.js/);
});

test('pruebas y build corren a la vez: el total es menor que la suma de las dos', () => {
  const carpeta = crearRepo({ scripts: { test: esperar(2), build: esperar(2) } });
  const { codigo, salida } = correr(carpeta);
  assert.strictEqual(codigo, 0);
  assert.match(salida, /--- PRUEBAS: OK \| comando: npm test/);
  assert.match(salida, /--- BUILD: OK \| comando: npm run build/);
  assert.match(salida, /--- ESLINT: NO_APLICA/);
  const [, total, suma] = /: ([\d.]+) s en total \(la suma de las tres, en secuencia, serían ([\d.]+) s\)/.exec(salida);
  assert.ok(Number(suma) >= 4, `la suma debería ser al menos 4 s y fue ${suma}`);
  assert.ok(Number(total) < Number(suma) * 0.8, `en paralelo el total (${total} s) debería ser menor que la suma (${suma} s)`);
  assert.match(salida, /ARBOL: sin cambios/);
});

test('una verificación que falla se reporta como FAIL con su código y su salida, y el script sigue en 0', () => {
  const carpeta = crearRepo({ scripts: { test: 'node -e "console.error(\'boom\'); process.exit(3)"', build: 'echo compilado' } });
  const { codigo, salida } = correr(carpeta);
  assert.strictEqual(codigo, 0);
  assert.match(salida, /--- PRUEBAS: FAIL \| comando: npm test \| código: \d+/);
  assert.match(salida, /boom/);
  assert.match(salida, /--- BUILD: OK/);
});

test('una verificación que pasa el tiempo máximo se corta y queda como TIMEOUT', () => {
  const carpeta = crearRepo({ scripts: { test: esperar(30), build: 'echo compilado' } });
  const inicio = Date.now();
  const { salida } = correr(carpeta, '--minutos-maximo', '0.05');
  assert.match(salida, /--- PRUEBAS: TIMEOUT/);
  assert.match(salida, /--- BUILD: OK/);
  assert.ok(Date.now() - inicio < 20000, 'el corte por tiempo máximo debe ocurrir mucho antes de los 30 s del comando');
});

test('sin comandos declarados se reportan como NO_DETERMINADO para que el revisor decida', () => {
  const carpeta = crearRepo({ scripts: null });
  const { codigo, salida } = correr(carpeta);
  assert.strictEqual(codigo, 0);
  assert.match(salida, /--- PRUEBAS: NO_DETERMINADO/);
  assert.match(salida, /--- BUILD: NO_DETERMINADO/);
});

test('un build que reescribe un archivo versionado se marca en ARBOL (criterio 8c)', () => {
  const carpeta = crearRepo({
    scripts: { test: 'echo ok', build: 'node -e "require(\'fs\').appendFileSync(\'nuevo.js\', \'// tocado\\n\')"' },
  });
  const { salida } = correr(carpeta);
  assert.match(salida, /ARBOL: CAMBIÓ/);
  assert.match(salida, /nuevo\.js/);
});
