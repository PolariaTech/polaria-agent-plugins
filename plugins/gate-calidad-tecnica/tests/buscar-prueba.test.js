// Pruebas del aviso de prueba faltante (criterio 6) del hook avisar-criterios-al-escribir.js: avisa cuando un
// archivo JS/TS no tiene su archivo de prueba, encuentra la prueba junto al archivo, en __tests__ y en tests/,
// y no avisa para archivos que no se prueban solos ni en proyectos sin script "test".
// Se corren con: node --test "plugins/gate-calidad-tecnica/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { avisoDePruebaFaltante, seProbaSolo } = require('../hooks/buscar-prueba');

const HOOK = path.join(__dirname, '..', 'hooks', 'avisar-criterios-al-escribir.js');

// Crea un proyecto en una carpeta temporal. "paquete" es el contenido de package.json (null = sin package.json).
function proyecto(archivos, paquete = { scripts: { test: 'node --test' } }) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-prueba-'));
  if (paquete) fs.writeFileSync(path.join(raiz, 'package.json'), JSON.stringify(paquete));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = path.join(raiz, ruta);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
  }
  return raiz;
}

const sinAviso = (raiz, ruta) => assert.strictEqual(avisoDePruebaFaltante(path.join(raiz, ruta)), null, ruta);

test('avisa con criterio 6 cuando src/precio.ts no tiene prueba', () => {
  const raiz = proyecto({ 'src/precio.ts': 'export const precio = 1;\n' });
  const aviso = avisoDePruebaFaltante(path.join(raiz, 'src/precio.ts'));
  assert.strictEqual(aviso.criterio, 6);
  assert.match(aviso.texto, /precio\.ts/);
});

test('encuentra la prueba junto al archivo (.test y .spec)', () => {
  const raiz = proyecto({
    'src/precio.ts': 'x', 'src/precio.test.ts': 'x', 'src/total.js': 'x', 'src/total.spec.js': 'x',
  });
  sinAviso(raiz, 'src/precio.ts');
  sinAviso(raiz, 'src/total.js');
});

test('encuentra la prueba en __tests__ junto al archivo, con o sin sufijo', () => {
  const raiz = proyecto({ 'src/a.ts': 'x', 'src/__tests__/a.ts': 'x', 'src/b.ts': 'x', 'src/__tests__/b.test.ts': 'x' });
  sinAviso(raiz, 'src/a.ts');
  sinAviso(raiz, 'src/b.ts');
});

test('encuentra la prueba en tests/ de la raíz, también en subcarpetas', () => {
  const raiz = proyecto({
    'src/servicios/cliente.ts': 'x', 'tests/servicios/cliente.test.ts': 'x',
    'src/pedido.ts': 'x', 'tests/pedido.ts': 'x',
  });
  sinAviso(raiz, 'src/servicios/cliente.ts');
  sinAviso(raiz, 'src/pedido.ts');
});

test('una prueba de otro archivo con nombre parecido no cuenta', () => {
  const raiz = proyecto({ 'src/precio.ts': 'x', 'src/precio-final.test.ts': 'x', 'src/otro-precio.test.ts': 'x' });
  assert.strictEqual(avisoDePruebaFaltante(path.join(raiz, 'src/precio.ts')).criterio, 6);
});

test('no avisa para archivos que no se prueban solos', () => {
  const raiz = proyecto({});
  for (const ruta of [
    'src/index.ts', 'src/types.ts', 'src/modelo.types.ts', 'src/tipos.d.ts', 'vite.config.ts', 'src/constants.js',
    'src/boton.stories.tsx', 'src/api.mock.ts', 'src/config/entorno.ts', 'db/migrations/001.ts', 'src/precio.test.ts',
    'tests/ayuda.ts', 'src/__mocks__/api.ts',
  ]) {
    assert.strictEqual(seProbaSolo(path.join(raiz, ruta)), false, ruta);
  }
  assert.strictEqual(seProbaSolo(path.join(raiz, 'src/precio.ts')), true);
});

test('no avisa fuera de JS/TS ni en documentación', () => {
  const raiz = proyecto({});
  sinAviso(raiz, 'app/modelo.py');
  sinAviso(raiz, 'docs/guia.md');
});

test('no avisa si el proyecto no tiene package.json o su script test no existe o es el de npm por defecto', () => {
  sinAviso(proyecto({ 'src/a.ts': 'x' }, null), 'src/a.ts');
  sinAviso(proyecto({ 'src/a.ts': 'x' }, { scripts: {} }), 'src/a.ts');
  sinAviso(proyecto({ 'src/a.ts': 'x' }, { scripts: { test: 'echo "Error: no test specified" && exit 1' } }), 'src/a.ts');
});

test('en un monorepo usa el package.json más cercano al archivo', () => {
  const raiz = proyecto({ 'api/src/a.ts': 'x', 'api/package.json': JSON.stringify({ scripts: { test: 'vitest' } }) }, { scripts: {} });
  assert.strictEqual(avisoDePruebaFaltante(path.join(raiz, 'api/src/a.ts')).criterio, 6);
});

test('el hook de Claude Code avisa del criterio 6 sin prueba y sale con 0 si el archivo ya tiene su prueba', () => {
  const raiz = proyecto({ 'src/precio.ts': 'export const precio = 1;\n', 'src/total.ts': 'export const total = 2;\n', 'src/total.test.ts': 'x' });
  const ejecutar = (ruta) =>
    spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { file_path: path.join(raiz, ruta) }, cwd: raiz }),
      encoding: 'utf8',
    });
  const sinPrueba = ejecutar('src/precio.ts');
  assert.strictEqual(sinPrueba.status, 2);
  assert.match(sinPrueba.stderr, /Criterio 6: no encontré una prueba de precio\.ts/);
  const conPrueba = ejecutar('src/total.ts');
  assert.strictEqual(conPrueba.status, 0);
  assert.strictEqual(conPrueba.stderr, '');
});
