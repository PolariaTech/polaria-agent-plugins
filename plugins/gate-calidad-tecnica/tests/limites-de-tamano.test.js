// Pruebas de POL-399, criterio 9: un archivo nuevo de más de 300 líneas de código es FAIL (CA1) y un archivo
// heredado ya excedido que crece también lo es (CA2). Se prueban sobre repos git reales en carpetas temporales.
// Se corren con: node --test "plugins/gate-calidad-tecnica/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { contarLineasDeCodigo, compararSuppressions } = require('../hooks/medir-tamano');
const { criteriosConFail } = require('../hooks/registrar-veredicto');

const HOOKS = path.join(__dirname, '..', 'hooks');

function git(carpeta, ...argumentos) {
  return execFileSync('git', argumentos, { cwd: carpeta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function lineasDeCodigo(cantidad) {
  return Array.from({ length: cantidad }, (_, i) => `const valor${i} = ${i};`).join('\n') + '\n';
}

function escribir(carpeta, archivos) {
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = path.join(carpeta, ruta);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
  }
  git(carpeta, 'add', '.');
}

// Repo con main (commit base con los archivos dados) y la rama "cambio" lista para commitear encima.
function crearRepo(archivosBase) {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-tamano-'));
  git(carpeta, 'init', '-q', '-b', 'main');
  git(carpeta, 'config', 'user.email', 'prueba@polaria.tech');
  git(carpeta, 'config', 'user.name', 'Prueba');
  git(carpeta, 'config', 'commit.gpgsign', 'false');
  escribir(carpeta, { 'package.json': '{}\n', ...archivosBase });
  git(carpeta, 'commit', '-q', '-m', 'base');
  git(carpeta, 'checkout', '-q', '-b', 'cambio');
  return carpeta;
}

function commitear(carpeta, archivos) {
  escribir(carpeta, archivos);
  git(carpeta, 'commit', '-q', '-m', 'cambio');
}

function medir(carpeta) {
  return spawnSync('node', [path.join(HOOKS, 'medir-tamano.js'), 'main'], { cwd: carpeta, encoding: 'utf8' });
}

test('CA1: un archivo nuevo de 301 líneas de código es FAIL y nombra archivo y «301 > 300»', () => {
  const carpeta = crearRepo({});
  commitear(carpeta, { 'src/nuevo.ts': lineasDeCodigo(301) });
  const { stdout, status } = medir(carpeta);
  assert.strictEqual(status, 0);
  assert.match(stdout, /^TAMANO: CON_FAIL$/m);
  assert.match(stdout, /^FAIL max-lines src\/nuevo\.ts 301 > 300 \(archivo nuevo\)$/m);
});

test('CA1: un archivo nuevo de 300 líneas cumple', () => {
  const carpeta = crearRepo({});
  commitear(carpeta, { 'src/justo.ts': lineasDeCodigo(300) });
  assert.strictEqual(medir(carpeta).stdout, 'TAMANO: SIN_FAIL\n');
});

test('CA1: las líneas en blanco y los comentarios no cuentan para el límite', () => {
  const carpeta = crearRepo({});
  const relleno = '// comentario\n\n/* bloque\n   de varias líneas */\n'.repeat(100);
  commitear(carpeta, { 'src/comentado.ts': lineasDeCodigo(300) + relleno });
  assert.strictEqual(medir(carpeta).stdout, 'TAMANO: SIN_FAIL\n');
});

test('CA2: una línea más en un archivo heredado de 6.426 líneas es FAIL por crecimiento y por superar 1.000', () => {
  const carpeta = crearRepo({ 'src/OrdenVentaCreateModal.tsx': lineasDeCodigo(6426) });
  commitear(carpeta, { 'src/OrdenVentaCreateModal.tsx': lineasDeCodigo(6427) });
  const { stdout, status } = medir(carpeta);
  assert.strictEqual(status, 0);
  assert.match(stdout, /^TAMANO: CON_FAIL$/m);
  assert.match(
    stdout,
    /^FAIL max-lines src\/OrdenVentaCreateModal\.tsx 6427 > 300 \(archivo heredado que crece: 6426 → 6427; supera 1000, sin excepción \(S104\)\)$/m,
  );
});

test('CA2: un archivo heredado de 400 líneas que crece a 401 también es FAIL, sin el aviso de 1.000', () => {
  const carpeta = crearRepo({ 'src/viejo.ts': lineasDeCodigo(400) });
  commitear(carpeta, { 'src/viejo.ts': lineasDeCodigo(401) });
  const { stdout } = medir(carpeta);
  assert.match(stdout, /^FAIL max-lines src\/viejo\.ts 401 > 300 \(archivo heredado que crece: 400 → 401\)$/m);
});

test('un archivo que pasa de 299 a 301 líneas cruza el límite y es FAIL', () => {
  const carpeta = crearRepo({ 'src/casi.ts': lineasDeCodigo(299) });
  commitear(carpeta, { 'src/casi.ts': lineasDeCodigo(301) });
  assert.match(medir(carpeta).stdout, /^FAIL max-lines src\/casi\.ts 301 > 300 \(pasó de 299 a 301 y cruza el límite\)$/m);
});

test('los archivos que no son código JS/TS no se miden', () => {
  const carpeta = crearRepo({});
  commitear(carpeta, { 'datos.json': lineasDeCodigo(500), 'docs/guia.md': lineasDeCodigo(500) });
  assert.strictEqual(medir(carpeta).stdout, 'TAMANO: SIN_FAIL\n');
});

test('contarLineasDeCodigo: ignora blancos y comentarios, cuenta la línea con código y comentario al final', () => {
  const texto = ['', '// solo comentario', 'const a = 1; // con comentario', '/* a', 'b */', 'const url = "http://x"; /* y */', ''].join('\n');
  assert.strictEqual(contarLineasDeCodigo(texto), 2);
  assert.strictEqual(contarLineasDeCodigo('const t = `una\n// esto es texto\nplantilla`;\n'), 3);
  assert.strictEqual(contarLineasDeCodigo('a\r\n\r\nb\r\n'), 2);
});

test('compararSuppressions: sumar incumplimientos es FAIL; quitarlos no', () => {
  const antes = { 'src/a.ts': { 'max-lines': { count: 1 } } };
  const mas = { 'src/a.ts': { 'max-lines': { count: 1 } }, 'src/b.ts': { 'max-lines': { count: 1 } } };
  const menos = {};
  const hallazgos = compararSuppressions('eslint-suppressions.json', antes, mas);
  assert.strictEqual(hallazgos.length, 1);
  assert.strictEqual(hallazgos[0].ruta, 'src/b.ts');
  assert.strictEqual(hallazgos[0].tipo, 'FAIL');
  assert.deepStrictEqual(compararSuppressions('eslint-suppressions.json', antes, menos), []);
});

test('un eslint-suppressions.json que suma un incumplimiento nuevo es FAIL', () => {
  const carpeta = crearRepo({ 'eslint-suppressions.json': '{}\n' });
  commitear(carpeta, {
    'eslint-suppressions.json': JSON.stringify({ 'src/nuevo.ts': { 'max-lines': { count: 1 } } }),
  });
  const { stdout } = medir(carpeta);
  assert.match(stdout, /^TAMANO: CON_FAIL$/m);
  assert.match(stdout, /^FAIL max-lines src\/nuevo\.ts 1 > 0 /m);
});

test('registrar-veredicto: el criterio 9 en FAIL queda en CRITERIOS_FAIL', () => {
  const reporte = '| **9. Tamaño y complejidad** | `[FAIL]` | src/nuevo.ts 301 > 300 |\n| **8. Build de Despliegue** | `[PASS]` | ok |';
  assert.deepStrictEqual(criteriosConFail(reporte), [9]);
});

test('un eslint-suppressions.json que no es JSON válido es FAIL y no se deja pasar en silencio', () => {
  const carpeta = crearRepo({ 'eslint-suppressions.json': '{}\n' });
  commitear(carpeta, { 'eslint-suppressions.json': '{ esto no es json' });
  const { stdout } = medir(carpeta);
  assert.match(stdout, /^TAMANO: CON_FAIL$/m);
  assert.match(stdout, /^FAIL eslint-suppressions eslint-suppressions\.json \(JSON inválido en HEAD/m);
});

test('el baseline inicial (eslint-suppressions.json que no existía en main) es advertencia, no FAIL', () => {
  const carpeta = crearRepo({});
  commitear(carpeta, {
    'eslint-suppressions.json': JSON.stringify({ 'src/viejo.ts': { 'max-lines': { count: 1 } }, 'src/otro.ts': { 'max-lines': { count: 2 } } }),
  });
  const { stdout } = medir(carpeta);
  assert.match(stdout, /^TAMANO: SIN_FAIL$/m);
  assert.match(stdout, /^ADVERTENCIA eslint-suppressions eslint-suppressions\.json \(baseline inicial: 3 incumplimientos congelados/m);
});

// Los números esperados son los que ESLint 9.24.0 (max-lines con skipBlankLines y skipComments) dio sobre estas
// mismas muestras. En una comparación con los 48 archivos .js de este repo, el conteo del script y el de ESLint
// coincidieron en todos.
test('contarLineasDeCodigo coincide con max-lines de ESLint: comentarios, plantillas multilínea, comillas y regex', () => {
  const muestra = "// comentario\nconst a = 1; // al final\n/* bloque\n   varias líneas */\nconst b = `plantilla\n// no es comentario\ny sigue`;\n\nconst c = \"http://x.com/*no*/\";\nconst re = /\\/\\*/;\n/** doc */ const d = 2;\nconst e = 'it\\'s'; /* x */ const f = 3;\n";
  assert.strictEqual(contarLineasDeCodigo(muestra), 8);
});

test('contarLineasDeCodigo coincide con max-lines de ESLint: shebang, regex con comillas invertidas y plantillas anidadas', () => {
  const muestra = "#!/usr/bin/env node\n// regex con comillas invertidas y plantilla anidada\nconst re = /^\\s*[-*]\\s*`([^`]+)`/;\nconst dividir = (a, b) => a / b; // una división, no una regex\nconst lista = [1, 2].map((n) => `<${[n].map((m) => `(${m})`).join(',')}>`);\nconst t = `una ${lista.length > 0 ? `con ${lista[0]}` : 'vacía'}\n// esto es texto de la plantilla\ny cierra`;\n// comentario final\n";
  assert.strictEqual(contarLineasDeCodigo(muestra), 6);
});
