// Ayudas compartidas de las pruebas del plugin trabajo-en-paralelo: arman un escenario real de dos devs con git
// (remoto + clones en una carpeta temporal) y ejecutan los scripts y hooks como lo hacen Claude Code y Cursor.

const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ_PLUGIN = path.resolve(__dirname, '..');
const PARALELO = path.join(RAIZ_PLUGIN, 'scripts', 'paralelo.js');
const HOOKS = path.join(RAIZ_PLUGIN, 'hooks');

// Variables que cambian el comportamiento de los hooks: se limpian para que la máquina de quien corre las pruebas no influya.
const VARIABLES_AISLADAS = ['CURSOR_VERSION', 'CURSOR_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'POLARIA_PARALELO_MODO'];

function git(directorio, ...argumentos) {
  return execFileSync('git', ['-c', 'user.name=Prueba', '-c', 'user.email=prueba@polaria.tech', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...argumentos], {
    cwd: directorio,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function escribir(directorio, relativa, contenido) {
  const destino = path.join(directorio, relativa);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, contenido);
}

function entornoLimpio(extra = {}) {
  const entorno = { ...process.env };
  VARIABLES_AISLADAS.forEach((v) => delete entorno[v]);
  return { ...entorno, ...extra };
}

// Un remoto, el clon de Mauro (con su rama pol-101 ya publicada) y el clon de Daniel, que trabajará pol-102.
// Mauro cambió la línea 1 de src/auth/session.ts y src/ui/a.ts. Para chocar con él, Daniel cambia la misma línea.
function crearEscenario() {
  const carpeta = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'paralelo-')));
  const origen = path.join(carpeta, 'origen.git');
  git(carpeta, 'init', '-q', '--bare', '-b', 'main', origen);

  const mauro = path.join(carpeta, 'mauro');
  git(carpeta, 'clone', '-q', origen, mauro);
  git(mauro, 'config', 'core.autocrlf', 'false');
  // login y logout están separadas por líneas vacías: git trata como conflicto dos cambios en líneas contiguas.
  escribir(mauro, 'src/auth/session.ts', 'export function login(){return 1}\n\n\n\nexport function logout(){return 2}\n');
  escribir(mauro, 'src/ui/a.ts', 'ui\n');
  escribir(mauro, 'package.json', '{}\n');
  git(mauro, 'add', '-A');
  git(mauro, 'commit', '-q', '-m', 'base');
  git(mauro, 'branch', '-M', 'main');
  git(mauro, 'push', '-q', '-u', 'origin', 'main');
  git(mauro, 'checkout', '-q', '-b', 'mauro/pol-101-auth');
  escribir(mauro, 'src/auth/session.ts', 'export function login(){return 111}\n\n\n\nexport function logout(){return 2}\n');
  escribir(mauro, 'src/ui/a.ts', 'ui2\n');
  git(mauro, 'commit', '-q', '-am', 'mauro');
  git(mauro, 'push', '-q', '-u', 'origin', 'mauro/pol-101-auth');

  const daniel = path.join(carpeta, 'daniel');
  git(carpeta, 'clone', '-q', origen, daniel);
  git(daniel, 'config', 'core.autocrlf', 'false'); // El worktree comparte esta configuración: checkout y commits con los mismos saltos de línea.
  return { carpeta, origen, mauro, daniel };
}

function ejecutarParalelo(directorio, ...argumentos) {
  const r = spawnSync(process.execPath, [PARALELO, ...argumentos], { cwd: directorio, encoding: 'utf8', env: entornoLimpio() });
  return { codigo: r.status, salida: r.stdout, error: r.stderr };
}

// Entrega el evento por stdin igual que el editor. bom: antepone U+FEFF, como Cursor en Windows.
function ejecutarHook(nombre, evento, { cursor = false, env = {}, bom = false, cwd } = {}) {
  const texto = typeof evento === 'string' ? evento : JSON.stringify(evento);
  const r = spawnSync(process.execPath, [path.join(HOOKS, nombre)], {
    input: (bom ? '﻿' : '') + texto,
    cwd,
    encoding: 'utf8',
    env: entornoLimpio({ ...(cursor ? { CURSOR_VERSION: '3.17.0' } : {}), ...env }),
  });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    // Sin salida JSON: el hook dejó pasar sin decir nada.
  }
  return { codigo: r.status, salida: r.stdout, error: r.stderr, json };
}

function cuerpoDeReclamo({ rama, responsable = 'Prueba', estado = 'ACTIVO', confianza = 80, zonas = [], compartidos = [] }) {
  const lista = (rutas) => rutas.map((r) => `- \`${r}\``).join('\n');
  return [
    '<!-- polaria-reclamo v1 -->',
    '## 🔒 Reclamo de trabajo en paralelo',
    '',
    `**Estado:** ${estado}`,
    `**Rama:** ${rama}`,
    `**Responsable:** ${responsable}`,
    `**Confianza:** ${confianza}%`,
    '',
    '### Zonas que voy a tocar',
    lista(zonas),
    '',
    '### Compartidos (cambio mínimo y aviso)',
    lista(compartidos),
    '',
  ].join('\n');
}

// Escribe el archivo que la skill le pasa a "paralelo.js importar" y lo importa en el repo de `directorio`.
function importarReclamos(directorio, reclamos) {
  const archivo = path.join(directorio, '..', `importar-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(archivo, JSON.stringify(reclamos));
  return ejecutarParalelo(directorio, 'importar', archivo);
}

const RECLAMO_DE_MAURO = {
  issue: 'POL-101',
  comentarioId: 'c1',
  autor: 'Mauro',
  creado: '2026-10-26T10:00:00Z',
  cuerpo: cuerpoDeReclamo({ rama: 'mauro/pol-101-auth', responsable: 'Mauro', confianza: 85, zonas: ['src/auth/', 'src/ui/a.ts#render'], compartidos: ['package.json'] }),
};

const RECLAMO_DE_DANIEL = {
  issue: 'POL-102',
  comentarioId: 'c2',
  autor: 'Daniel',
  creado: '2026-10-26T11:00:00Z',
  cuerpo: cuerpoDeReclamo({ rama: 'daniel/pol-102-login', responsable: 'Daniel', confianza: 70, zonas: ['src/auth/session.ts'] }),
};

module.exports = { RAIZ_PLUGIN, git, escribir, crearEscenario, ejecutarParalelo, ejecutarHook, cuerpoDeReclamo, importarReclamos, RECLAMO_DE_MAURO, RECLAMO_DE_DANIEL };
