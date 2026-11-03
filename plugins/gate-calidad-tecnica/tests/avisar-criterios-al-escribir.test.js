// Pruebas del hook avisar-criterios-al-escribir.js: avisa de los criterios 3 (secretos), 4 (código de debug) y 9
// (tamaño) mientras se escribe, no avisa en código limpio ni en documentación, nunca incluye el valor del secreto
// y responde en el formato de Claude Code (salida 2 + stderr) y de Cursor (additional_context, con BOM).
// El comportamiento en sesiones reales se prueba en el laboratorio de plugins.
// Se corren con: node --test "plugins/gate-calidad-tecnica/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { analizarArchivo } = require('../hooks/avisar-criterios-al-escribir');

const HOOK = path.join(__dirname, '..', 'hooks', 'avisar-criterios-al-escribir.js');

const criterios = (hallazgos) => hallazgos.map((h) => h.criterio);

function ejecutarHook(evento, entorno = {}) {
  return spawnSync(process.execPath, [HOOK], {
    input: evento,
    encoding: 'utf8',
    env: { ...process.env, ...entorno },
  });
}

function carpetaConArchivo(nombre, contenido) {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-escribir-'));
  const archivo = path.join(carpeta, nombre);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, contenido);
  return { carpeta, archivo };
}

test('código limpio no genera avisos', () => {
  const codigo = 'const total = precios.reduce((suma, precio) => suma + precio, 0);\nmodule.exports = { total };\n';
  assert.deepStrictEqual(analizarArchivo('src/total.js', codigo), []);
});

test('criterio 3: llave de AWS, token de GitHub y clave privada', () => {
  const llaveAws = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  const tokenGithub = 'ghp_' + 'a'.repeat(36);
  const claveAbre = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
  for (const linea of [`const k = "${llaveAws}";`, `const t = '${tokenGithub}';`, claveAbre]) {
    assert.deepStrictEqual(criterios(analizarArchivo('src/a.js', linea)), [3], linea);
  }
});

test('criterio 3: contraseña asignada como texto fijo, pero no una variable de entorno ni un valor de ejemplo', () => {
  assert.deepStrictEqual(criterios(analizarArchivo('src/a.ts', 'const password = "Sup3rClave2026";')), [3]);
  assert.deepStrictEqual(criterios(analizarArchivo('src/a.ts', 'const password = process.env.DB_PASSWORD;')), []);
  assert.deepStrictEqual(criterios(analizarArchivo('src/a.ts', 'const apiKey = "your-api-key";')), []);
});

test('criterio 4: console.log, debugger y TODO borrar; print solo en Python', () => {
  assert.deepStrictEqual(criterios(analizarArchivo('src/a.js', 'console.log(usuario);')), [4]);
  assert.deepStrictEqual(criterios(analizarArchivo('src/a.js', 'debugger;')), [4]);
  assert.deepStrictEqual(criterios(analizarArchivo('src/a.js', '// TODO borrar antes del push')), [4]);
  assert.deepStrictEqual(criterios(analizarArchivo('app/a.py', 'print(usuario)')), [4]);
  assert.deepStrictEqual(criterios(analizarArchivo('src/a.js', 'impresora.print(documento);')), []);
});

test('criterio 9: archivo de más de 300 líneas de código avisa; con 300 no', () => {
  const lineas = (n) => Array.from({ length: n }, (_, i) => `const valor${i} = ${i};`).join('\n') + '\n';
  assert.deepStrictEqual(criterios(analizarArchivo('src/grande.js', lineas(301))), [9]);
  assert.deepStrictEqual(analizarArchivo('src/justo.js', lineas(300)), []);
});

test('no avisa en documentación, en carpetas ajenas ni en archivos que no son código', () => {
  assert.deepStrictEqual(analizarArchivo('docs/guia.md', 'console.log(1); const password = "Sup3rClave2026";'), []);
  assert.deepStrictEqual(analizarArchivo('node_modules/lib/a.js', 'console.log(1);'), []);
  assert.deepStrictEqual(analizarArchivo('config.json', '{"password": "Sup3rClave2026"}'), []);
});

test('Claude Code: aviso por stderr con salida 2 y sin el valor del secreto', () => {
  const secreto = 'Sup3rClave2026';
  const { carpeta, archivo } = carpetaConArchivo('src/a.js', `const password = "${secreto}";\nconsole.log(password);\n`);
  const evento = JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { file_path: archivo }, cwd: carpeta });
  const resultado = ejecutarHook(evento);
  assert.strictEqual(resultado.status, 2);
  assert.match(resultado.stderr, /Criterio 3, línea 1/);
  assert.match(resultado.stderr, /Criterio 4, línea 2/);
  assert.ok(!resultado.stderr.includes(secreto), 'el aviso no debe repetir el secreto');
});

test('Claude Code: código limpio sale con 0 y sin salida', () => {
  const { carpeta, archivo } = carpetaConArchivo('src/a.js', 'const total = 1 + 1;\n');
  const resultado = ejecutarHook(JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { file_path: archivo }, cwd: carpeta }));
  assert.strictEqual(resultado.status, 0);
  assert.strictEqual(resultado.stderr, '');
});

test('Cursor: evento con BOM responde additional_context y sale con 0', () => {
  const { carpeta, archivo } = carpetaConArchivo('src/a.js', 'console.log(1);\n');
  const evento = '﻿' + JSON.stringify({ hook_event_name: 'postToolUse', tool_input: { file_path: archivo }, cwd: carpeta });
  const resultado = ejecutarHook(evento);
  assert.strictEqual(resultado.status, 0);
  assert.match(JSON.parse(resultado.stdout).additional_context, /Criterio 4/);
});

test('Cursor: cwd vacío usa workspace_roots y una ruta relativa', () => {
  const { carpeta } = carpetaConArchivo('src/a.js', 'console.log(1);\n');
  const evento = JSON.stringify({ hook_event_name: 'postToolUse', tool_input: { file_path: 'src/a.js' }, workspace_roots: [carpeta] });
  const resultado = ejecutarHook(evento);
  assert.match(JSON.parse(resultado.stdout).additional_context, /Criterio 4/);
});

test('evento ilegible o archivo inexistente: no dice nada y no falla', () => {
  assert.strictEqual(ejecutarHook('esto no es json').status, 0);
  const evento = JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { file_path: path.join(os.tmpdir(), 'no-existe-gate.js') } });
  assert.strictEqual(ejecutarHook(evento).status, 0);
});
