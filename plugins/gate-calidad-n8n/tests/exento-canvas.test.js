// Pruebas de POL-370: veredicto EXENTO_CANVAS para los cambios de solo diseño del canvas.
// Se corren con: node --test "plugins/gate-calidad-n8n/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { ID_PRODUCCION, SCRIPT_REGISTRAR, copia, copiaDev, crearRepo, correr, correrTexto, correrHook, escribir, leerMarca, git } = require('./ayuda');

const GRUPOS = [{ id: 'g1', name: 'Preparación', nodes: ['Preparar Mensaje', 'Enviar Aviso'] }];

function nodo(dev, nombre) {
  return dev.nodes.find((n) => n.name === nombre);
}

test('CA1: solo nodeGroups agregado → EXENTO_CANVAS, código 0 y marca escrita', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Resultado: EXENTO_CANVAS/);
  assert.match(r.stdout, /grupos de nodos/);
  assert.strictEqual(r.marca[0], 'VEREDICTO: EXENTO_CANVAS');
});

test('CA2: solo cambió la posición de los nodos → EXENTO_CANVAS', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  nodo(dev, 'Preparar Mensaje').position = [999, 111];
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /posición de `Preparar Mensaje`/);
  assert.strictEqual(r.marca[0], 'VEREDICTO: EXENTO_CANVAS');
});

test('R1: ancho, alto y color de una nota adhesiva son canvas', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  Object.assign(nodo(dev, 'Nota General').parameters, { width: 640, height: 300, color: 5 });
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /width de la nota `Nota General`/);
  assert.strictEqual(r.marca[0], 'VEREDICTO: EXENTO_CANVAS');
});

test('el orden de las claves de nodeGroups no cuenta como cambio de canvas', () => {
  const repo = crearRepo();
  const produccion = copia(copiaDev());
  produccion.nodeGroups = [{ id: 'g1', name: 'Preparación', nodes: ['Preparar Mensaje'] }];
  const publicado = require('./ayuda').workflowDeProduccion();
  publicado.nodeGroups = [{ nodes: ['Preparar Mensaje'], name: 'Preparación', id: 'g1' }];
  const dev = copiaDev(publicado);
  dev.nodeGroups = [{ id: 'g1', name: 'Preparación', nodes: ['Preparar Mensaje'] }];
  const r = correrTexto(repo, dev, publicado);
  assert.strictEqual(r.status, 3, 'sin diferencias de ningún tipo no hay nada que publicar');
  assert.match(r.stdout, /no hay nada que publicar/);
});

test('CA3: grupos más el cambio de un parámetro → NO EXENTO y lista la diferencia', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  nodo(dev, 'Enviar Aviso').parameters.jsonBody = '={{ { "otro": true } }}';
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /Resultado: NO EXENTO/);
  assert.match(r.stdout, /parameters\.jsonBody/);
  assert.strictEqual(r.marca, null);
});

test('CA4: grupos más un nodo agregado → NO EXENTO', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  dev.nodes.push({ id: 'n9', name: 'Nodo Nuevo', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [0, 300], parameters: {} });
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /Nodo Nuevo/);
  assert.strictEqual(r.marca, null);
});

test('CA4: grupos más un nodo quitado → NO EXENTO', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  dev.nodes = dev.nodes.filter((n) => n.name !== 'Nota General');
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /Nota General/);
  assert.strictEqual(r.marca, null);
});

test('CA4: grupos más un nodo renombrado (y sus conexiones) → NO EXENTO', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  nodo(dev, 'Preparar Mensaje').name = 'Armar Mensaje';
  dev.connections = {
    'Recibir Datos': { main: [[{ node: 'Armar Mensaje', type: 'main', index: 0 }]] },
    'Armar Mensaje': { main: [[{ node: 'Enviar Aviso', type: 'main', index: 0 }]] },
  };
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.strictEqual(r.marca, null);
});

test('CA4: grupos más una conexión distinta → NO EXENTO', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  dev.connections['Recibir Datos'] = { main: [[{ node: 'Enviar Aviso', type: 'main', index: 0 }]] };
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /connections/);
  assert.strictEqual(r.marca, null);
});

test('CA5: grupos más un cambio de credencial → NO EXENTO', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  nodo(dev, 'Enviar Aviso').credentials.httpHeaderAuth.id = 'cred-otra';
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.strictEqual(r.marca, null);
});

for (const [campo, valor] of [['onError', 'stopWorkflow'], ['executeOnce', true], ['retryOnFail', false]]) {
  test(`CA5: grupos más un cambio de ${campo} → NO EXENTO`, () => {
    const repo = crearRepo();
    const dev = copiaDev();
    dev.nodeGroups = GRUPOS;
    nodo(dev, 'Enviar Aviso')[campo] = valor;
    const r = correrTexto(repo, dev);
    assert.strictEqual(r.status, 3);
    assert.strictEqual(r.marca, null);
  });
}

test('un cambio en los settings del workflow junto con el canvas → NO EXENTO', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  dev.settings = { executionOrder: 'v1', errorWorkflow: 'OtroErrorHandler01' };
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.strictEqual(r.marca, null);
});

test('CA7: sin ninguna diferencia → "nada que publicar" y sin marca', () => {
  const repo = crearRepo();
  const r = correrTexto(repo, copiaDev());
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /no hay nada que publicar/);
  assert.strictEqual(r.marca, null);
});

test('mixto: canvas más un texto permitido → se evalúa con la regla de texto (EXENTO_TEXTO)', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  nodo(dev, 'Preparar Mensaje').position = [300, 40];
  nodo(dev, 'Preparar Mensaje').parameters.assignments.assignments[0].value = 'Seguimos revisando tu solicitud, gracias por esperar';
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Resultado: EXENTO_TEXTO/);
  assert.match(r.stdout, /grupos de nodos/);
  assert.strictEqual(r.marca[0], 'VEREDICTO: EXENTO_TEXTO');
});

test('mixto: canvas más un texto que no califica → NO EXENTO', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  nodo(dev, 'Preparar Mensaje').parameters.assignments.assignments[0].name = 'status';
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.strictEqual(r.marca, null);
});

test('el contenido de una nota adhesiva sigue la regla de texto, no la de canvas', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  nodo(dev, 'Nota General').parameters.content = 'Registra una sospecha de duplicado y la deja en la cola.';
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Resultado: EXENTO_TEXTO/);
});

test('--registrar no: dice EXENTO_CANVAS pero no deja marca', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  const r = correrTexto(repo, dev, undefined, ['--registrar', 'no']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Sin marca registrada/);
  assert.strictEqual(r.marca, null);
});

test('un cambio de solo canvas no necesita la carpeta workflows/', () => {
  const repo = crearRepo();
  git(repo, 'rm', '-rq', 'workflows');
  fs.rmSync(path.join(repo, 'workflows'), { recursive: true, force: true });
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.strictEqual(r.marca[0], 'VEREDICTO: EXENTO_CANVAS');
});

test('el pin data con forma de clave impide la exención, también la de canvas', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  dev.pinData = { 'Enviar Aviso': [{ json: { clave: 'sk_live_abcdefghij1234567890' } }] };
  const r = correrTexto(repo, dev);
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /pin data/);
  assert.strictEqual(r.marca, null);
});

test('CA6: el hook deja publicar con la marca EXENTO_CANVAS vigente y bloquea sin marca', () => {
  const repo = crearRepo();
  assert.strictEqual(correrHook(repo, ID_PRODUCCION).status, 2, 'sin marca se bloquea');
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  assert.strictEqual(correrTexto(repo, dev).status, 0);
  assert.strictEqual(correrHook(repo, ID_PRODUCCION).status, 0, 'con la marca EXENTO_CANVAS se permite');
});

test('CA6: la marca EXENTO_CANVAS de hace más de 24 horas ya no sirve', () => {
  const repo = crearRepo();
  const dev = copiaDev();
  dev.nodeGroups = GRUPOS;
  correrTexto(repo, dev);
  const comun = path.resolve(repo, git(repo, 'rev-parse', '--git-common-dir'));
  const ruta = path.join(comun, 'polaria-gate-n8n', `${ID_PRODUCCION}.md`);
  const vieja = fs.readFileSync(ruta, 'utf8').replace(/^fecha: .*$/m, `fecha: ${new Date(Date.now() - 25 * 3600 * 1000).toISOString()}`);
  fs.writeFileSync(ruta, vieja);
  assert.strictEqual(correrHook(repo, ID_PRODUCCION).status, 2);
});

test('R2: registrar-veredicto.js se niega a escribir EXENTO_CANVAS a mano', () => {
  const repo = crearRepo();
  const r = correr(SCRIPT_REGISTRAR, [ID_PRODUCCION, 'EXENTO_CANVAS', 'v-dev-1', 'Dev01234567890AB'], repo);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /EXENTO_CANVAS solo lo registra/);
  assert.strictEqual(leerMarca(repo, ID_PRODUCCION), null);
});
