// Pruebas de los criterios 10 (lint y dependencias) y 11 (un solo frente): conteo de tickets, comparación de npm audit
// contra la rama principal (sin red: el audit se inyecta), el bloque LINT de correr-verificaciones.js y el aviso al editar.
// Se corren con: node --test "plugins/gate-calidad-tecnica/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  MAX_TICKETS_POR_PR,
  contarTickets,
  resultadoDeTickets,
  vulnerabilidadesAltas,
  paquetesDelDiff,
  compararAudit,
  resultadoDeAudit,
} = require('../hooks/lint-audit-tickets');
const { resultadoDeLint } = require('../hooks/correr-verificaciones');

const SCRIPT = path.join(__dirname, '..', 'hooks', 'correr-verificaciones.js');

function carpetaTemporal(prefijo) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
}

function git(carpeta, ...argumentos) {
  return execFileSync('git', ['-c', 'core.autocrlf=false', ...argumentos], { cwd: carpeta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Repo con main y una rama `rama` con un commit por cada mensaje. `archivosBase` van a main.
function crearRepo({ rama, mensajes, archivosBase = {} }) {
  const carpeta = carpetaTemporal('gate-lint-audit-');
  git(carpeta, 'init', '-q', '-b', 'main');
  git(carpeta, 'config', 'user.email', 'prueba@polaria.tech');
  git(carpeta, 'config', 'user.name', 'Prueba');
  fs.writeFileSync(path.join(carpeta, 'base.txt'), 'base\n');
  for (const [nombre, contenido] of Object.entries(archivosBase)) fs.writeFileSync(path.join(carpeta, nombre), contenido);
  git(carpeta, 'add', '-A');
  git(carpeta, 'commit', '-q', '-m', 'base');
  git(carpeta, 'checkout', '-q', '-b', rama);
  mensajes.forEach((mensaje, indice) => {
    fs.writeFileSync(path.join(carpeta, `cambio${indice}.js`), `module.exports = ${indice};\n`);
    git(carpeta, 'add', '-A');
    git(carpeta, 'commit', '-q', '-m', mensaje);
  });
  return carpeta;
}

const auditoria = (vulnerabilidades) => ({ vulnerabilities: Object.fromEntries(Object.entries(vulnerabilidades).map(([n, severity]) => [n, { name: n, severity }])) });

// ---------- Criterio 11 ----------

test('contarTickets: junta los POL y REQ distintos de la rama y los commits, sin duplicar y sin confundir otros guiones', () => {
  const tickets = contarTickets(['dani/pol-12-recepcion', 'POL-12 corrige UTF-8 y SHA-256\n\nRefs REQ-7', 'claim(REQ-7+REQ-9): reclama']);
  assert.deepStrictEqual(tickets, ['POL-12', 'REQ-7', 'REQ-9']);
});

test('resultadoDeTickets: 3 tickets pasan, 4 fallan con la lista y la sugerencia amable, 0 es NO_APLICA', () => {
  assert.strictEqual(MAX_TICKETS_POR_PR, 3);
  assert.strictEqual(resultadoDeTickets(['POL-1', 'POL-2', 'POL-3']).estado, 'OK');
  const cuatro = resultadoDeTickets(['POL-1', 'POL-2', 'POL-3', 'POL-4']);
  assert.strictEqual(cuatro.estado, 'FAIL');
  assert.match(cuatro.salida, /4 tickets en esta rama: POL-1, POL-2, POL-3, POL-4/);
  assert.match(cuatro.salida, /Te sugiero dejar en este PR POL-1, POL-2, POL-3/);
  assert.match(cuatro.salida, /tú decides cuáles, pero no pueden ser más de 3/);
  assert.strictEqual(resultadoDeTickets([]).estado, 'NO_APLICA');
});

test('correr-verificaciones: una rama con 4 tickets en sus commits sale con el bloque TICKETS en FAIL', () => {
  const carpeta = crearRepo({ rama: 'dani/pol-1-x', mensajes: ['POL-1 uno', 'POL-2 dos', 'REQ-3 tres', 'REQ-4 cuatro'] });
  const r = spawnSync(process.execPath, [SCRIPT, 'main', '--sin-build'], { cwd: carpeta, encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /--- TICKETS: FAIL/);
  assert.match(r.stdout, /4 tickets en esta rama: POL-1, POL-2, REQ-3, REQ-4/);
  assert.match(r.stdout, /--- AUDIT: NO_APLICA/);
  assert.match(r.stdout, /--- LINT: NO_APLICA/);
});

// ---------- Criterio 10b: audit ----------

test('vulnerabilidadesAltas: solo altas y críticas', () => {
  const mapa = vulnerabilidadesAltas(auditoria({ a: 'high', b: 'moderate', c: 'critical', d: 'low' }));
  assert.deepStrictEqual([...mapa], [['a', 'high'], ['c', 'critical']]);
  assert.strictEqual(vulnerabilidadesAltas(null).size, 0);
});

test('compararAudit: una alta nueva es FAIL; las que ya estaban en main solo advierten; una que sube de severidad cuenta como nueva', () => {
  const principal = new Map([['xlsx', 'high'], ['qs', 'high']]);
  const igual = compararAudit(new Map([['xlsx', 'high'], ['qs', 'high']]), principal);
  assert.strictEqual(igual.estado, 'OK');
  assert.strictEqual(igual.existentes.length, 2);
  const nueva = compararAudit(new Map([['xlsx', 'high'], ['multer', 'high']]), principal);
  assert.strictEqual(nueva.estado, 'FAIL');
  assert.deepStrictEqual(nueva.nuevas.map((v) => v.nombre), ['multer']);
  const sube = compararAudit(new Map([['qs', 'critical']]), principal);
  assert.strictEqual(sube.estado, 'FAIL');
});

test('compararAudit: sugiere actualizar las existentes que el diff ya toca; modo cero las vuelve a todas FAIL', () => {
  const principal = new Map([['body-parser', 'high'], ['xlsx', 'high']]);
  const rama = new Map(principal);
  const comparacion = compararAudit(rama, principal, { paquetesTocados: new Set(['body-parser']) });
  assert.deepStrictEqual(comparacion.sugerencias.map((v) => v.nombre), ['body-parser']);
  assert.strictEqual(comparacion.estado, 'OK');
  assert.strictEqual(compararAudit(rama, principal, { modo: 'cero' }).estado, 'FAIL');
});

test('paquetesDelDiff: saca los nombres de paquete de las líneas + y - de package.json y del lock', () => {
  const diff = ['-    "body-parser": "^2.0.0",', '+    "body-parser": "^2.4.0",', '+    "node_modules/@nestjs/core": {', ' sin cambio "otro": "1"'].join('\n');
  assert.deepStrictEqual([...paquetesDelDiff(diff)].sort(), ['@nestjs/core', 'body-parser']);
});

test('resultadoDeAudit: sin package-lock.json es NO_APLICA; sin respuesta de npm es NO_DETERMINADO y no FAIL', () => {
  const sinLock = crearRepo({ rama: 'dani/pol-1-x', mensajes: ['POL-1 uno'] });
  assert.strictEqual(resultadoDeAudit(sinLock, 'main', { ejecutarAudit: () => null }).estado, 'NO_APLICA');
  const conLock = crearRepo({ rama: 'dani/pol-1-x', mensajes: ['POL-1 uno'], archivosBase: { 'package.json': '{"name":"x"}', 'package-lock.json': '{}' } });
  const sinRed = resultadoDeAudit(conLock, 'main', { ejecutarAudit: () => null });
  assert.strictEqual(sinRed.estado, 'NO_DETERMINADO');
  assert.match(sinRed.salida, /no es FAIL por sí solo/);
});

test('resultadoDeAudit: compara la rama contra main con el lock de main y reporta lo nuevo y lo existente', () => {
  const carpeta = crearRepo({ rama: 'dani/pol-1-x', mensajes: ['POL-1 uno'], archivosBase: { 'package.json': '{"name":"x"}', 'package-lock.json': '{}' } });
  const llamadas = [];
  const ejecutarAudit = (donde) => {
    llamadas.push(donde);
    return donde === carpeta ? auditoria({ xlsx: 'high', multer: 'high' }) : auditoria({ xlsx: 'high' });
  };
  const r = resultadoDeAudit(carpeta, 'main', { ejecutarAudit });
  assert.strictEqual(r.estado, 'FAIL');
  assert.match(r.salida, /NUEVAS altas o críticas que la rama principal no tiene: multer \(high\)/);
  assert.match(r.salida, /ADVERTENCIA \(ya existían, no bloquean\): xlsx \(high\)/);
  assert.strictEqual(llamadas.length, 2);
  assert.ok(!fs.existsSync(llamadas[1]), 'la carpeta temporal de main se borra');
  const igual = resultadoDeAudit(carpeta, 'main', { ejecutarAudit: () => auditoria({ xlsx: 'high' }) });
  assert.strictEqual(igual.estado, 'OK');
});

// ---------- Criterio 10a: lint ----------

test('resultadoDeLint: sin config de ESLint o sin código JS/TS es NO_APLICA', async () => {
  const sinConfig = carpetaTemporal('gate-lint-sin-config-');
  const r = await resultadoDeLint({ raiz: sinConfig, archivosDeCodigo: ['a.js'], resultadoEslint: null, milisegundosMaximo: 5000 });
  assert.strictEqual(r.estado, 'NO_APLICA');
  fs.writeFileSync(path.join(sinConfig, 'eslint.config.mjs'), 'export default [];\n');
  const sinCodigo = await resultadoDeLint({ raiz: sinConfig, archivosDeCodigo: [], resultadoEslint: null, milisegundosMaximo: 5000 });
  assert.strictEqual(sinCodigo.estado, 'NO_APLICA');
});

test('resultadoDeLint: si el bloque ESLINT ya corrió, LINT reutiliza su resultado sin volver a correr', async () => {
  const carpeta = carpetaTemporal('gate-lint-reuso-');
  fs.writeFileSync(path.join(carpeta, 'eslint.config.mjs'), 'export default [];\n');
  const ya = { nombre: 'ESLINT', comando: 'npx eslint --max-warnings 0 "a.js"', estado: 'FAIL', codigo: 1, segundos: 2, salida: 'a.js 1:1 error no-undef' };
  const r = await resultadoDeLint({ raiz: carpeta, archivosDeCodigo: ['a.js'], resultadoEslint: ya, milisegundosMaximo: 5000 });
  assert.deepStrictEqual(r, { ...ya, nombre: 'LINT' });
});

test('resultadoDeLint: sin ESLINT previo corre el comando (sin --fix) y un error de lint sale FAIL', async () => {
  const carpeta = carpetaTemporal('gate-lint-corre-');
  fs.writeFileSync(path.join(carpeta, 'eslint.config.mjs'), 'export default [];\n');
  fs.mkdirSync(path.join(carpeta, 'node_modules', '.bin'), { recursive: true });
  // npx no se usa de verdad: el comando que se ejecuta lo decide el script, y aquí se comprueba que es de solo lectura.
  const r = await resultadoDeLint({ raiz: carpeta, archivosDeCodigo: ['a.js'], resultadoEslint: null, milisegundosMaximo: 60000 });
  assert.match(r.comando, /^npx eslint --max-warnings 0 "a\.js"$/);
  assert.ok(!/--fix|--suppress-all/.test(r.comando));
  assert.strictEqual(r.nombre, 'LINT');
});

// ---------- Aviso al editar ----------

test('avisar-criterios-al-escribir: un error de lint del archivo editado se avisa como criterio 10 y se pide corregirlo ahora', () => {
  const carpeta = carpetaTemporal('gate-escribir-lint-');
  const binario = path.join(carpeta, 'node_modules', 'eslint', 'bin', 'eslint.js');
  fs.mkdirSync(path.dirname(binario), { recursive: true });
  // ESLint simulado: entrega el JSON con un error de la regla no-unused-vars (severidad 2) y uno de tamaño.
  fs.writeFileSync(
    binario,
    `process.stdout.write(JSON.stringify([{messages:[{ruleId:'no-unused-vars',severity:2,line:3,message:'x no se usa'},{ruleId:'prefer-const',severity:1,line:4,message:'usa const'}]}]));process.exit(1);`
  );
  const archivo = path.join(carpeta, 'src', 'precio.js');
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, 'const total = 1;\nmodule.exports = { total };\n');
  const hook = path.join(__dirname, '..', 'hooks', 'avisar-criterios-al-escribir.js');
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { file_path: archivo }, cwd: carpeta }), encoding: 'utf8' });
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /Criterio 10, línea 3: no-unused-vars: x no se usa \(ya que tocas este archivo, corrígelo ahora\)/);
  assert.ok(!/prefer-const/.test(r.stderr), 'una advertencia (severidad 1) no se avisa');
});
