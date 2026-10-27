// Ayudas compartidas de las pruebas del plugin trabajo-en-paralelo: arman un escenario real de dos devs con git
// (remoto + clones en una carpeta temporal) y ejecutan los scripts y hooks como lo hacen Claude Code y Cursor.

const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('../scripts/lib');

// Los commits que hacen el CLI y el pre-commit necesitan identidad aunque la máquina que corre las pruebas no la tenga.
Object.assign(process.env, { GIT_AUTHOR_NAME: 'Prueba', GIT_AUTHOR_EMAIL: 'prueba@polaria.tech', GIT_COMMITTER_NAME: 'Prueba', GIT_COMMITTER_EMAIL: 'prueba@polaria.tech' });

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

// git que no lanza: devuelve el código y los textos, para probar commits y pushes que deben fallar.
function gitSinLanzar(directorio, ...argumentos) {
  const r = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...argumentos], { cwd: directorio, encoding: 'utf8' });
  return { codigo: r.status, salida: (r.stdout || '').trim(), error: (r.stderr || '').trim() };
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

function cuerpoDeReclamo({ issue, rama, responsable = 'Prueba', estado = 'ACTIVO', confianza = 80, zonas = [], compartidos = [] }) {
  const lista = (rutas) => rutas.map((r) => `- \`${r}\``).join('\n');
  return [
    '<!-- polaria-reclamo v1 -->',
    '## 🔒 Reclamo de trabajo en paralelo',
    '',
    `**Estado:** ${estado}`,
    ...(issue ? [`**Issue:** ${issue}`] : []),
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

// Siembra la caché de reclamos directamente (como la deja "importar-claims"), para probar los hooks y el cruce sin
// depender de ramas publicadas. Cada reclamo: { issue, autor, creado, cuerpo, ultimoCommit? }; el más reciente por issue gana.
function importarReclamos(directorio, reclamos) {
  const repo = lib.infoDelRepo(directorio);
  const porIssue = new Map();
  for (const entrada of reclamos) {
    const reclamo = lib.parsearReclamo(entrada.cuerpo);
    if (!reclamo || !entrada.issue) continue;
    const actual = porIssue.get(entrada.issue);
    if (actual && String(entrada.creado || '') < String(actual.creado || '')) continue;
    porIssue.set(entrada.issue, {
      issue: String(entrada.issue).toUpperCase(),
      creado: entrada.creado || null,
      ultimoCommit: entrada.ultimoCommit || new Date().toISOString(),
      responsable: reclamo.responsable || entrada.autor || '',
      rama: reclamo.rama,
      estado: reclamo.estado,
      confianza: reclamo.confianza,
      zonas: reclamo.zonas,
      compartidos: reclamo.compartidos,
    });
  }
  lib.escribirCache(repo, { sincronizado: new Date().toISOString(), reclamos: [...porIssue.values()] });
  return { codigo: 0 };
}

// Mauro publica el CLAIM.md real de su rama. diasAtras fecha el commit para probar la inactividad.
function mauroPublicaClaim(e, { zonas = ['src/auth/', 'src/ui/a.ts#render'], compartidos = ['package.json'], diasAtras = 0, confianza = 85 } = {}) {
  git(e.mauro, 'checkout', '-q', 'mauro/pol-101-auth');
  escribir(e.mauro, 'CLAIM.md', cuerpoDeReclamo({ issue: 'POL-101', rama: 'mauro/pol-101-auth', responsable: 'Mauro', confianza, zonas, compartidos }));
  git(e.mauro, 'add', 'CLAIM.md');
  const fecha = new Date(Date.now() - diasAtras * 86400000).toISOString();
  execFileSync('git', ['-c', 'user.name=Prueba', '-c', 'user.email=prueba@polaria.tech', '-c', 'core.autocrlf=false', 'commit', '-q', '-m', 'claim mauro'], {
    cwd: e.mauro,
    env: { ...process.env, GIT_AUTHOR_DATE: fecha, GIT_COMMITTER_DATE: fecha },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  git(e.mauro, 'push', '-q', 'origin', 'mauro/pol-101-auth');
}

const RECLAMO_DE_MAURO = {
  issue: 'POL-101',
  autor: 'Mauro',
  creado: '2026-10-26T10:00:00Z',
  cuerpo: cuerpoDeReclamo({ issue: 'POL-101', rama: 'mauro/pol-101-auth', responsable: 'Mauro', confianza: 85, zonas: ['src/auth/', 'src/ui/a.ts#render'], compartidos: ['package.json'] }),
};

const RECLAMO_DE_DANIEL = {
  issue: 'POL-102',
  autor: 'Daniel',
  creado: '2026-10-26T11:00:00Z',
  cuerpo: cuerpoDeReclamo({ issue: 'POL-102', rama: 'daniel/pol-102-login', responsable: 'Daniel', confianza: 70, zonas: ['src/auth/session.ts'] }),
};

module.exports = {
  RAIZ_PLUGIN,
  git,
  gitSinLanzar,
  escribir,
  crearEscenario,
  ejecutarParalelo,
  ejecutarHook,
  cuerpoDeReclamo,
  importarReclamos,
  mauroPublicaClaim,
  RECLAMO_DE_MAURO,
  RECLAMO_DE_DANIEL,
};
