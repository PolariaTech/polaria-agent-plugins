// Utilidades de las pruebas del plugin gate-calidad-n8n: workflows de ejemplo, repos git temporales y
// ejecución de los scripts. No contiene pruebas (node --test solo corre los *.test.js).

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const SCRIPT_REVISAR = path.join(RAIZ, 'scripts', 'revisar-workflow.js');
const SCRIPT_REGISTRAR = path.join(RAIZ, 'scripts', 'registrar-veredicto.js');
const HOOK_PUBLICACION = path.join(RAIZ, 'hooks', 'verificar-publicacion.js');

const ID_PRODUCCION = 'Prod1234567890AB';
const ID_DEV = 'Dev01234567890AB';
const VERSION_PRODUCCION = 'v-produccion-1';
const VERSION_DEV = 'v-dev-1';

const copia = (valor) => JSON.parse(JSON.stringify(valor));

function nodoSet(nombre, campo, valor, posicion) {
  return { id: `id-${nombre}`, name: nombre, type: 'n8n-nodes-base.set', typeVersion: 3.4, position: posicion, parameters: { assignments: { assignments: [{ id: `a-${nombre}`, name: campo, value: valor, type: 'string' }] } } };
}

// Sub-workflow chico: disparador → Edit Fields → HTTP Request, más una nota adhesiva.
function workflowDeProduccion() {
  return {
    id: ID_PRODUCCION,
    name: 'UTIL - Registrar Sospecha',
    versionId: VERSION_PRODUCCION,
    active: true,
    tags: [{ name: 'producción' }, { name: 'mateo' }],
    settings: { executionOrder: 'v1' },
    pinData: {},
    nodes: [
      { id: 'n1', name: 'Recibir Datos', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1.1, position: [0, 0], parameters: {} },
      nodoSet('Preparar Mensaje', 'aviso', 'Estamos revisando tu solicitud ahora mismo', [220, 0]),
      { id: 'n3', name: 'Enviar Aviso', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [440, 0], retryOnFail: true, maxTries: 3, onError: 'continueRegularOutput', credentials: { httpHeaderAuth: { id: 'cred-produccion', name: 'Aviso produccion' } }, parameters: { method: 'POST', url: 'https://aviso.polaria.test/enviar', jsonBody: '={{ $json }}' } },
      { id: 'n4', name: 'Nota General', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [0, -200], parameters: { content: 'Registra una sospecha de duplicado.', width: 300, height: 120, color: 3 } },
    ],
    connections: {
      'Recibir Datos': { main: [[{ node: 'Preparar Mensaje', type: 'main', index: 0 }]] },
      'Preparar Mensaje': { main: [[{ node: 'Enviar Aviso', type: 'main', index: 0 }]] },
    },
  };
}

// La copia DEV es idéntica a producción salvo lo que siempre difiere entre copias.
function copiaDev(produccion = workflowDeProduccion()) {
  const dev = copia(produccion);
  dev.id = ID_DEV;
  dev.name = `${produccion.name} - DEV`;
  dev.versionId = VERSION_DEV;
  dev.active = false;
  dev.tags = [{ name: 'desarrollo' }, { name: 'mateo' }];
  return dev;
}

function git(carpeta, ...argumentos) {
  return execFileSync('git', argumentos, { cwd: carpeta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Repo git temporal con una carpeta workflows/ (opcionalmente con archivos) y un commit inicial.
function crearRepo(archivos = {}) {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-n8n-'));
  git(carpeta, 'init', '-q', '-b', 'main');
  git(carpeta, 'config', 'user.email', 'prueba@polaria.tech');
  git(carpeta, 'config', 'user.name', 'Prueba');
  git(carpeta, 'config', 'commit.gpgsign', 'false');
  escribir(carpeta, 'workflows/.gitkeep', '');
  for (const [ruta, contenido] of Object.entries(archivos)) escribir(carpeta, ruta, contenido);
  git(carpeta, 'add', '.');
  git(carpeta, 'commit', '-q', '-m', 'base');
  return carpeta;
}

function escribir(carpeta, ruta, contenido) {
  const destino = path.join(carpeta, ruta);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, typeof contenido === 'string' ? contenido : `${JSON.stringify(contenido, null, 2)}\n`);
  return destino;
}

function commitear(carpeta, mensaje) {
  git(carpeta, 'add', '-A');
  git(carpeta, 'commit', '-q', '-m', mensaje);
}

function correr(script, argumentos, carpeta, opciones = {}) {
  return spawnSync(process.execPath, [script, ...argumentos], { cwd: carpeta, encoding: 'utf8', ...opciones });
}

// Modo texto: devuelve el resultado del script y la marca registrada (o null).
function correrTexto(carpeta, dev, publicado = workflowDeProduccion(), extra = []) {
  const rutaDev = escribir(carpeta, '.descargas/dev.json', dev);
  const rutaPublicado = escribir(carpeta, '.descargas/produccion.json', publicado);
  const resultado = correr(SCRIPT_REVISAR, ['texto', '--json', rutaDev, '--publicado', rutaPublicado, '--workflow-id', ID_PRODUCCION, '--version-publicada', VERSION_PRODUCCION, '--repo', carpeta, ...extra], carpeta);
  return { ...resultado, marca: leerMarca(carpeta, ID_PRODUCCION) };
}

function leerMarca(carpeta, workflowId) {
  const comun = path.resolve(carpeta, git(carpeta, 'rev-parse', '--git-common-dir'));
  const ruta = path.join(comun, 'polaria-gate-n8n', `${workflowId}.md`);
  return fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8').split(/\r?\n/) : null;
}

// Ejecuta el hook de publicación como lo haría Claude Code.
function correrHook(carpeta, workflowId) {
  return spawnSync(process.execPath, [HOOK_PUBLICACION], {
    cwd: carpeta,
    encoding: 'utf8',
    input: JSON.stringify({ tool_name: 'mcp__n8n__publish_workflow', tool_input: { workflowId }, cwd: carpeta }),
    env: { ...process.env, N8N_API_KEY: '' },
  });
}

// Fila de un criterio en la tabla de la salida del script: { estado, evidencia }.
function filaDeCriterio(salida, numero) {
  const fila = salida.split('\n').find((l) => l.startsWith(`| ${numero} |`));
  if (!fila) return null;
  const [, , , estado, ...evidencia] = fila.split(/(?<!\\)\|/).map((c) => c.trim());
  return { estado, evidencia: evidencia.filter((_, i, todas) => i < todas.length - 1 || todas[i] !== '').join('|') };
}

module.exports = { ID_PRODUCCION, ID_DEV, VERSION_PRODUCCION, VERSION_DEV, SCRIPT_REVISAR, SCRIPT_REGISTRAR, copia, nodoSet, workflowDeProduccion, copiaDev, crearRepo, escribir, commitear, correr, correrTexto, leerMarca, correrHook, filaDeCriterio, git };
