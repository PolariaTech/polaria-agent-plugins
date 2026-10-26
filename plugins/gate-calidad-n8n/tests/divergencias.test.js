// Pruebas de POL-318: divergencias DEV↔producción declaradas en el criterio 23 (modo despues --dev).
// Caso modelo: el orquestador de Mateo Support, con un bloque solo-DEV, otra conexión y otro path de webhook.

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { SCRIPT_REVISAR, copia, crearRepo, escribir, commitear, correr, filaDeCriterio } = require('./ayuda');

const ID = 'Orq0123456789ABC';
const VERSION = 'v-orquestador-1';
const NODO_SOLO_DEV = 'Verificar Firma JWT (solo DEV)';
const RUTA_DECLARACION = `.polaria-gate-n8n/divergencias/${ID}.json`;

function orquestadorDeProduccion() {
  return {
    id: ID,
    name: 'Mateo Support - Atender - Web',
    versionId: VERSION,
    settings: { executionOrder: 'v1' },
    nodes: [
      { id: 'a', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], parameters: { path: 'mateo-support', httpMethod: 'POST' } },
      { id: 'b', name: 'Discriminar Canal', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [200, 0], parameters: {} },
      { id: 'c', name: 'Responder', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [400, 0], parameters: {} },
    ],
    connections: {
      Webhook: { main: [[{ node: 'Discriminar Canal', type: 'main', index: 0 }]] },
      'Discriminar Canal': { main: [[{ node: 'Responder', type: 'main', index: 0 }]] },
    },
  };
}

// La copia DEV agrega un nodo de verificación entre el webhook y el discriminador, y usa otro path.
function orquestadorDev() {
  const dev = orquestadorDeProduccion();
  dev.name = 'Mateo Support - Atender - Web - DEV';
  dev.id = 'OrqDev123456789A';
  dev.nodes.push({ id: 'd', name: NODO_SOLO_DEV, type: 'n8n-nodes-base.code', typeVersion: 2, position: [100, 200], parameters: { jsCode: 'return items;' } });
  dev.nodes[0].parameters.path = 'mateo-support-dev';
  dev.connections.Webhook = { main: [[{ node: NODO_SOLO_DEV, type: 'main', index: 0 }]] };
  dev.connections[NODO_SOLO_DEV] = { main: [[{ node: 'Discriminar Canal', type: 'main', index: 0 }]] };
  return dev;
}

const DECLARACION_COMPLETA = {
  nodosSoloDev: [NODO_SOLO_DEV],
  conexiones: [{ ruta: 'Webhook.main[0][0].node', valorProd: 'Discriminar Canal', valorDev: NODO_SOLO_DEV }],
  parametros: [{ nodo: 'Webhook', ruta: 'parameters.path', valorProd: 'mateo-support', valorDev: 'mateo-support-dev' }],
};

// Repo con lo publicado en workflows/, su commit y su CHANGELOG; la declaración es opcional.
function prepararRepo({ declaracion, commitearDeclaracion = true, dev = orquestadorDev() } = {}) {
  const repo = crearRepo();
  escribir(repo, 'workflows/mateo-support-atender-web.json', orquestadorDeProduccion());
  escribir(repo, 'CHANGELOG.md', `## 1.0.1\n\n- Publicado ${VERSION}\n`);
  commitear(repo, `Publica el orquestador ${VERSION}`);
  const rutaDev = escribir(repo, '.descargas/dev.json', dev);
  if (declaracion !== undefined) {
    escribir(repo, RUTA_DECLARACION, declaracion);
    if (commitearDeclaracion) commitear(repo, 'Declara las divergencias DEV');
  }
  return { repo, rutaDev };
}

function criterio23({ repo, rutaDev }) {
  const r = correr(SCRIPT_REVISAR, ['despues', '--json', path.join(repo, 'workflows', 'mateo-support-atender-web.json'), '--version-publicada', VERSION, '--dev', rutaDev, '--repo', repo], repo);
  assert.strictEqual(r.status, 0, r.stderr);
  return { ...filaDeCriterio(r.stdout, 23), salida: r.stdout };
}

test('sin declaración, las diferencias DEV↔producción dan FAIL', () => {
  const resultado = criterio23(prepararRepo());
  assert.strictEqual(resultado.estado, 'FAIL');
  assert.match(resultado.evidencia, /lo publicado no es la copia DEV verificada/);
  assert.match(resultado.evidencia, /sin declarar/);
});

test('con todas las divergencias declaradas y commiteadas, el criterio 23 da PASS y las lista', () => {
  const resultado = criterio23(prepararRepo({ declaracion: DECLARACION_COMPLETA }));
  assert.strictEqual(resultado.estado, 'PASS', resultado.evidencia);
  assert.match(resultado.evidencia, /PASS con divergencias declaradas \(4\)/);
  assert.match(resultado.evidencia, /parameters\.path/);
  assert.doesNotMatch(resultado.salida, /declaración obsoleta/);
});

test('una diferencia que no está declarada sigue dando FAIL', () => {
  const dev = orquestadorDev();
  dev.nodes[2].parameters.mensaje = 'cambio no declarado';
  const resultado = criterio23(prepararRepo({ declaracion: DECLARACION_COMPLETA, dev }));
  assert.strictEqual(resultado.estado, 'FAIL');
  assert.match(resultado.evidencia, /1 diferencia\(s\) sin declarar/);
  assert.match(resultado.evidencia, /nodo `Responder` parameters\.mensaje/);
});

test('el valor declarado tiene que coincidir exactamente con el de la diferencia', () => {
  const declaracion = copia(DECLARACION_COMPLETA);
  declaracion.parametros[0].valorDev = 'mateo-support-otro';
  const resultado = criterio23(prepararRepo({ declaracion }));
  assert.strictEqual(resultado.estado, 'FAIL');
  assert.match(resultado.evidencia, /parameters\.path/);
  assert.match(resultado.salida, /declaración obsoleta/);
});

test('una entrada que ya no coincide con ninguna diferencia se avisa como obsoleta', () => {
  const declaracion = copia(DECLARACION_COMPLETA);
  declaracion.nodosSoloDev.push('Nodo que ya no existe');
  const resultado = criterio23(prepararRepo({ declaracion }));
  assert.strictEqual(resultado.estado, 'PASS', resultado.evidencia);
  assert.match(resultado.salida, /declaración obsoleta.*Nodo que ya no existe/);
});

test('una divergencia declarada fuera de git no cuenta', () => {
  const resultado = criterio23(prepararRepo({ declaracion: DECLARACION_COMPLETA, commitearDeclaracion: false }));
  assert.strictEqual(resultado.estado, 'FAIL');
  assert.match(resultado.evidencia, /no está en git/);
});

test('una declaración con cambios sin commit no cuenta', () => {
  const preparado = prepararRepo({ declaracion: DECLARACION_COMPLETA });
  const editada = copia(DECLARACION_COMPLETA);
  editada.parametros[0].valorDev = 'mateo-support-dev-2';
  escribir(preparado.repo, RUTA_DECLARACION, editada);
  const resultado = criterio23(preparado);
  assert.strictEqual(resultado.estado, 'FAIL');
  assert.match(resultado.evidencia, /cambios sin commit/);
});

test('una sección desconocida o mal formada se rechaza en vez de ignorarse', () => {
  const desconocida = criterio23(prepararRepo({ declaracion: { ...DECLARACION_COMPLETA, nodosSoloDevs: ['x'] } }));
  assert.strictEqual(desconocida.estado, 'FAIL');
  assert.match(desconocida.evidencia, /secciones desconocidas/);
  const malFormada = criterio23(prepararRepo({ declaracion: { parametros: [{ ruta: 'parameters.path' }] } }));
  assert.strictEqual(malFormada.estado, 'FAIL');
  assert.match(malFormada.evidencia, /no tiene el formato esperado/);
});

test('sin --dev no se leen las divergencias (el criterio 23 solo compara lo publicado)', () => {
  const { repo } = prepararRepo({ declaracion: DECLARACION_COMPLETA });
  const r = correr(SCRIPT_REVISAR, ['despues', '--json', path.join(repo, 'workflows', 'mateo-support-atender-web.json'), '--version-publicada', VERSION, '--repo', repo], repo);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(filaDeCriterio(r.stdout, 23).estado, 'PASS');
});

test('lista todas las diferencias sin declarar, no solo las primeras 5', () => {
  const dev = orquestadorDev();
  for (let i = 1; i <= 8; i++) dev.nodes[2].parameters[`campo${i}`] = `valor ${i}`;
  const resultado = criterio23(prepararRepo({ declaracion: DECLARACION_COMPLETA, dev }));
  assert.strictEqual(resultado.estado, 'FAIL');
  assert.match(resultado.evidencia, /8 diferencia\(s\) sin declarar/);
  for (let i = 1; i <= 8; i++) assert.match(resultado.evidencia, new RegExp(String.raw`parameters\.campo${i}\b`));
});

test('si hay más de 50 diferencias sin declarar, lista 50 y anuncia cuántas faltan', () => {
  const dev = orquestadorDev();
  for (let i = 1; i <= 51; i++) dev.nodes[2].parameters[`campo${i}`] = `valor ${i}`;
  const resultado = criterio23(prepararRepo({ declaracion: DECLARACION_COMPLETA, dev }));
  assert.strictEqual(resultado.estado, 'FAIL');
  assert.match(resultado.evidencia, /51 diferencia\(s\) sin declarar/);
  assert.match(resultado.evidencia, /; y 1 más\)/);
  assert.match(resultado.evidencia, new RegExp(String.raw`parameters\.campo50\b`));
  assert.doesNotMatch(resultado.evidencia, new RegExp(String.raw`parameters\.campo51\b`));
});
