// Pruebas de POL-304: paso opcional del catálogo de errores en el modo antes, y corrección del falso
// positivo de usosComoContrato en el modo texto (una subcadena ya no cuenta como contrato).

const test = require('node:test');
const assert = require('node:assert');

const { SCRIPT_REVISAR, copiaDev, crearRepo, escribir, commitear, correr, correrTexto, workflowDeProduccion } = require('./ayuda');

// ---------------------------------------------------------------------------------------------
// Falso positivo de usosComoContrato

function conMensaje(valorProduccion, extraNodos = []) {
  const produccion = workflowDeProduccion();
  produccion.nodes.find((n) => n.name === 'Preparar Mensaje').parameters.assignments.assignments[0].value = valorProduccion;
  produccion.nodes.push(...extraNodos);
  return produccion;
}

const nodoCodigo = (jsCode) => ({ id: 'cod', name: 'Evaluar Respuesta', type: 'n8n-nodes-base.code', typeVersion: 2, position: [600, 0], parameters: { jsCode } });
const nodoTool = (expresion) => ({ id: 'tool', name: 'Buscar Caso', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [600, 100], retryOnFail: true, maxTries: 3, parameters: { url: 'https://caso.polaria.test', jsonBody: expresion } });

function textoCambiado(publicado, nuevoTexto) {
  const dev = copiaDev(publicado);
  dev.nodes.find((n) => n.name === 'Preparar Mensaje').parameters.assignments.assignments[0].value = nuevoTexto;
  return dev;
}

test('falso positivo: un literal corto de una expresión que es subcadena del texto viejo no es contrato', () => {
  // `consulta` (8 caracteres, de $fromAI('consulta', …)) aparece dentro de "consultando", pero no es ese texto.
  const publicado = conMensaje('Seguimos consultando tu caso, un momento por favor', [nodoTool("={{ $fromAI('consulta', 'texto de la búsqueda') }}")]);
  const r = correrTexto(crearRepo(), textoCambiado(publicado, 'Seguimos revisando tu caso, un momento por favor'), publicado);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Resultado: EXENTO_TEXTO/);
});

test('un literal que sí es una palabra completa del texto viejo sigue siendo contrato', () => {
  const publicado = conMensaje('Tu consulta fue recibida, un momento por favor', [nodoTool("={{ $fromAI('consulta', 'texto de la búsqueda') }}")]);
  const r = correrTexto(crearRepo(), textoCambiado(publicado, 'Recibimos tu caso, un momento por favor'), publicado);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /se usa como contrato/);
});

test('contrato: una comparación parcial con includes() sigue bloqueando la exención', () => {
  const publicado = conMensaje('No encontre informacion sobre eso en la documentacion.', [nodoCodigo("return items.filter((i) => i.json.texto.includes('No encontre informacion'));")]);
  const r = correrTexto(crearRepo(), textoCambiado(publicado, 'No hay datos sobre ese tema en la documentación oficial'), publicado);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /se usa como contrato en este workflow → `Evaluar Respuesta`/);
});

test('contrato: un marcador entre corchetes como [[CLARIFICATION_REQUESTED]] sigue bloqueando', () => {
  const publicado = conMensaje('Necesito más datos para seguir [[CLARIFICATION_REQUESTED]]', [nodoCodigo("return items.filter((i) => i.json.texto.includes('[[CLARIFICATION_REQUESTED]]'));")]);
  const r = correrTexto(crearRepo(), textoCambiado(publicado, 'Necesito algunos datos más para seguir adelante'), publicado);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /se usa como contrato/);
});

test('contrato: el texto viejo completo dentro de otro texto del workflow sigue bloqueando', () => {
  const publicado = conMensaje('Estamos revisando tu solicitud ahora mismo', [nodoCodigo("return items.map((i) => ({ json: { ok: i.json.texto === 'Estamos revisando tu solicitud ahora mismo' } }));")]);
  const r = correrTexto(crearRepo(), textoCambiado(publicado, 'Seguimos con tu solicitud, un momento más'), publicado);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /se usa como contrato/);
});

// ---------------------------------------------------------------------------------------------
// Paso opcional: catálogo de errores

// Reemplazo mínimo del script de Mateo Support: mismo contrato de línea de comandos y de códigos de salida.
const SCRIPT_CATALOGO = `
const fs = require('fs'); const path = require('path');
const a = process.argv; const carpeta = a[a.indexOf('--workflows') + 1]; const catalogo = fs.readFileSync(a[a.indexOf('--catalogo') + 1], 'utf8');
if (catalogo.includes('ROTO')) { console.error('catálogo ilegible'); process.exit(2); }
const fallas = [];
for (const archivo of fs.readdirSync(carpeta).filter((f) => f.endsWith('.json'))) {
  const w = JSON.parse(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
  for (const n of w.nodes) {
    if (!/^ERROR: /.test(n.name)) continue;
    const t = (n.parameters.assignments.assignments.find((x) => x.name === 'response_text') || {}).value;
    if (!catalogo.includes(t)) fallas.push('[sin catalogar] ' + archivo + ' → "' + n.name + '": ' + JSON.stringify(t));
  }
}
if (fallas.length) { console.log('FAIL — ' + fallas.length + ' diferencia(s):'); fallas.forEach((f) => console.log('- ' + f)); process.exit(1); }
console.log('PASS — todo coincide con el catálogo.');
`;

function workflowConError(texto) {
  const w = workflowDeProduccion();
  w.nodes.push({ id: 'err', name: 'ERROR: Sin Servicio', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [0, 400], parameters: { assignments: { assignments: [{ id: 'r', name: 'response_text', value: texto, type: 'string' }] } } });
  return w;
}

function repoConCatalogo(textoPublicado) {
  const repo = crearRepo({
    'docs/catalogo-errores.md': '# Catálogo\n\n| Código | Texto vigente |\n|---|---|\n| SIN_SERVICIO | El servicio no está disponible por ahora. |\n',
    'scripts/verificar-catalogo-errores.js': SCRIPT_CATALOGO,
  });
  escribir(repo, 'workflows/util-registrar-sospecha.json', workflowConError(textoPublicado));
  commitear(repo, 'Publica el workflow');
  return repo;
}

function pasoCatalogo(repo, dev) {
  const rutaDev = escribir(repo, '.descargas/dev.json', dev);
  const r = correr(SCRIPT_REVISAR, ['antes', '--json', rutaDev, '--repo', repo], repo);
  assert.strictEqual(r.status, 0, r.stderr);
  const bloque = r.stdout.split('### Paso opcional')[1] || '';
  const [, estado, evidencia] = bloque.match(/Estado: (\S+) — (.*)/) || [];
  return { estado, evidencia, salida: r.stdout };
}

test('catálogo: PASS cuando los textos de error de la copia DEV están en el catálogo', () => {
  const repo = repoConCatalogo('El servicio no está disponible por ahora.');
  const r = pasoCatalogo(repo, copiaDev(workflowConError('El servicio no está disponible por ahora.')));
  assert.strictEqual(r.estado, 'PASS', r.salida);
});

test('catálogo: FAIL cuando la copia DEV trae un texto de error fuera del catálogo', () => {
  const repo = repoConCatalogo('El servicio no está disponible por ahora.');
  const r = pasoCatalogo(repo, copiaDev(workflowConError('Algo salió mal, intenta más tarde.')));
  assert.strictEqual(r.estado, 'FAIL', r.salida);
  assert.match(r.evidencia, /sin catalogar/);
});

test('catálogo: la copia DEV reemplaza a la de producción en la verificación', () => {
  // Lo publicado en workflows/ tiene un texto fuera del catálogo; la copia DEV ya lo corrigió.
  const repo = repoConCatalogo('Texto viejo que nadie catalogó.');
  const r = pasoCatalogo(repo, copiaDev(workflowConError('El servicio no está disponible por ahora.')));
  assert.strictEqual(r.estado, 'PASS', r.salida);
});

test('catálogo: REVISAR cuando el script del repo termina con error', () => {
  const repo = repoConCatalogo('El servicio no está disponible por ahora.');
  escribir(repo, 'docs/catalogo-errores.md', 'ROTO');
  const r = pasoCatalogo(repo, copiaDev(workflowConError('El servicio no está disponible por ahora.')));
  assert.strictEqual(r.estado, 'REVISAR', r.salida);
  assert.match(r.evidencia, /código 2/);
});

test('catálogo: N/A con una sugerencia cuando el repo no tiene catálogo, y no cambia los 23 criterios', () => {
  const repo = crearRepo();
  const r = pasoCatalogo(repo, copiaDev(workflowConError('Cualquier texto de error.')));
  assert.strictEqual(r.estado, 'N/A', r.salida);
  assert.match(r.evidencia, /Sugerencia: crear un catálogo de errores/);
  assert.match(r.evidencia, /no bloquea/);
  assert.match(r.salida, /Resumen: \d+ FAIL/);
  assert.doesNotMatch(r.salida, /\| 24 \|/);
});

test('catálogo: solo con el script o solo con el catálogo tampoco corre', () => {
  const repo = crearRepo({ 'docs/catalogo-errores.md': '# Catálogo\n' });
  const r = pasoCatalogo(repo, copiaDev(workflowConError('Cualquier texto de error.')));
  assert.strictEqual(r.estado, 'N/A', r.salida);
});
