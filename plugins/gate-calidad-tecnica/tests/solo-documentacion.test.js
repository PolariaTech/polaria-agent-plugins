// Pruebas de POL-396: el push cuyos archivos cambiados son todos documentación pasa sin veredicto (es-documentacion.js
// y verificar-gate.js); cualquier archivo de código, de instrucciones de IA o de configuración lo vuelve a exigir.
// Cubren el hook de Claude Code, el de Cursor y el pre-push de git. El comportamiento en sesiones reales se prueba
// en el laboratorio de plugins.
// Se corren con: node --test "plugins/gate-calidad-tecnica/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { esDocumentacion } = require('../hooks/es-documentacion');

const HOOKS = path.join(__dirname, '..', 'hooks');
const SHA_VACIO = '0'.repeat(40);

function git(carpeta, ...argumentos) {
  return execFileSync('git', argumentos, { cwd: carpeta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Repo de software con un commit base en main, publicado (origin/main) y la rama "cambio" encima.
function crearRepo() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-docs-'));
  git(carpeta, 'init', '-q', '-b', 'main');
  git(carpeta, 'config', 'user.email', 'prueba@polaria.tech');
  git(carpeta, 'config', 'user.name', 'Prueba');
  git(carpeta, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(carpeta, 'package.json'), '{}\n');
  git(carpeta, 'add', '.');
  git(carpeta, 'commit', '-q', '-m', 'base');
  git(carpeta, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(carpeta, 'checkout', '-q', '-b', 'cambio');
  return carpeta;
}

function commitear(carpeta, archivos) {
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = path.join(carpeta, ruta);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
  }
  git(carpeta, 'add', '.');
  git(carpeta, 'commit', '-q', '-m', 'cambio');
  return git(carpeta, 'rev-parse', 'HEAD');
}

function pushDeGit(carpeta, sha, hooks = HOOKS) {
  return spawnSync('node', [path.join(hooks, 'verificar-gate.js'), '--git-pre-push'], {
    cwd: carpeta,
    encoding: 'utf8',
    input: `refs/heads/cambio ${sha} refs/heads/cambio ${SHA_VACIO}\n`,
  });
}

function pushDeClaudeCode(carpeta, hooks = HOOKS) {
  return spawnSync('node', [path.join(hooks, 'verificar-gate.js')], {
    cwd: carpeta,
    encoding: 'utf8',
    input: JSON.stringify({ tool_input: { command: 'git push -u origin cambio' }, cwd: carpeta }),
  });
}

function pushDeCursor(carpeta) {
  return spawnSync('node', [path.join(HOOKS, 'verificar-gate.js')], {
    cwd: carpeta,
    encoding: 'utf8',
    env: { ...process.env, CURSOR_VERSION: '1.0.0' },
    input: JSON.stringify({ command: 'git push -u origin cambio', cwd: carpeta, hook_event_name: 'beforeShellExecution' }),
  });
}

test('esDocumentacion: reconoce la documentación pura (CA1)', () => {
  for (const ruta of [
    'CHANGELOG.md',
    'README.md',
    'README',
    'LICENSE',
    'wms-web/CHANGELOG.md',
    'wms-web/docs/arquitectura.md',
    'docs/diagrama.png',
    'docs/guia.mdx',
    'docs/api/openapi-notas.txt',
    'CONTRIBUTING.md',
    'CHANGELOG.es.md',
  ]) {
    assert.strictEqual(esDocumentacion(ruta), true, ruta);
  }
});

test('esDocumentacion: no exime código, configuración ni instrucciones de IA (CA2)', () => {
  for (const ruta of [
    'src/app.js',
    'package.json',
    '.env',
    '.github/workflows/ci.yml',
    'README.js',
    'CHANGELOG.json',
    'app/pagina.mdx',
    'docs/script.js',
    'docs/config.json',
    'CLAUDE.md',
    'front/AGENTS.md',
    'GEMINI.md',
    '.claude/rules/estilo.md',
    '.cursor/rules/estilo.md',
    '.claude/skills/x/SKILL.md',
    'skills/x/SKILL.md',
    'plugins/p/agents/revisor.md',
    'plugins/p/hooks/LEEME.md',
    'src/prompts/sistema.md',
    'CLAIM.md/../src/app.js',
    '',
    undefined,
  ]) {
    assert.strictEqual(esDocumentacion(ruta), false, String(ruta));
  }
});

test('hook pre-push: un commit que solo cambia el changelog pasa sin veredicto (CA3)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'wms-web/CHANGELOG.md': '# Cambios\n', 'docs/guia.md': 'guía\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 0);
});

test('hook de Claude Code y de Cursor: el push de solo documentación pasa sin veredicto (CA3)', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'CHANGELOG.md': '# Cambios\n' });
  assert.strictEqual(pushDeClaudeCode(carpeta).status, 0);
  const cursor = pushDeCursor(carpeta);
  assert.strictEqual(cursor.status, 0);
  assert.strictEqual(JSON.parse(cursor.stdout).permission, 'allow');
});

test('hook pre-push: un commit con código sigue exigiendo veredicto (CA4)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
  assert.strictEqual(pushDeClaudeCode(carpeta).status, 2);
  assert.strictEqual(JSON.parse(pushDeCursor(carpeta).stdout).permission, 'deny');
});

test('hook pre-push: documentación mezclada con código en el mismo commit exige veredicto (CA4)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'CHANGELOG.md': '# Cambios\n', 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
});

test('hook pre-push: si un commit anterior de lo que se publica lleva código, exige veredicto aunque el último sea documentación (CA4)', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  const sha = commitear(carpeta, { 'CHANGELOG.md': '# Cambios\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
  assert.strictEqual(pushDeClaudeCode(carpeta).status, 2);
});

test('hook pre-push: los .md de instrucciones de IA siguen exigiendo veredicto (CA2)', () => {
  for (const ruta of ['CLAUDE.md', '.claude/skills/x/SKILL.md', 'agents/revisor.md']) {
    const carpeta = crearRepo();
    const sha = commitear(carpeta, { [ruta]: 'instrucciones\n' });
    assert.strictEqual(pushDeGit(carpeta, sha).status, 1, ruta);
  }
});

test('hook pre-push: un commit vacío o un merge no cuentan como documentación (CA5)', () => {
  const carpeta = crearRepo();
  git(carpeta, 'commit', '-q', '--allow-empty', '-m', 'vacío');
  assert.strictEqual(pushDeGit(carpeta, git(carpeta, 'rev-parse', 'HEAD')).status, 1);

  const otra = crearRepo();
  commitear(otra, { 'CHANGELOG.md': '# Cambios\n' });
  git(otra, 'checkout', '-q', '-b', 'lateral', 'main');
  commitear(otra, { 'docs/otra.md': 'otra\n' });
  git(otra, 'checkout', '-q', 'cambio');
  git(otra, 'merge', '-q', '--no-ff', '-m', 'merge', 'lateral');
  assert.strictEqual(pushDeGit(otra, git(otra, 'rev-parse', 'HEAD')).status, 1);
});

test('hook pre-push: si el diff no se puede calcular (sha inexistente) exige veredicto (CA5)', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'CHANGELOG.md': '# Cambios\n' });
  assert.strictEqual(pushDeGit(carpeta, 'f'.repeat(40)).status, 1);
});

test('hook: sin es-documentacion.js (copia incompleta) nada cuenta como documentación (CA5)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'CHANGELOG.md': '# Cambios\n' });
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-hooks-'));
  for (const archivo of fs.readdirSync(HOOKS)) {
    if (archivo !== 'es-documentacion.js') fs.copyFileSync(path.join(HOOKS, archivo), path.join(copia, archivo));
  }
  assert.strictEqual(pushDeGit(carpeta, sha, copia).status, 1);
  assert.strictEqual(pushDeClaudeCode(carpeta, copia).status, 2);
});

test('hook pre-push: el veredicto APROBADO sigue dejando pasar un commit de código (CA6)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  fs.mkdirSync(path.join(carpeta, '.git', 'polaria-gate'));
  fs.writeFileSync(path.join(carpeta, '.git', 'polaria-gate', `${sha}.md`), 'VEREDICTO: APROBADO\n');
  assert.strictEqual(pushDeGit(carpeta, sha).status, 0);
});

test('instalar-pre-push copia es-documentacion.js y el git push real de solo documentación sale sin veredicto (CA3)', () => {
  const remoto = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-remoto-'));
  git(remoto, 'init', '-q', '--bare', '-b', 'main');
  const carpeta = crearRepo();
  git(carpeta, 'remote', 'add', 'origin', remoto);
  git(carpeta, 'push', '-q', 'origin', 'main');
  const instalacion = spawnSync('node', [path.join(HOOKS, 'instalar-pre-push.js')], { cwd: carpeta, encoding: 'utf8' });
  assert.strictEqual(instalacion.status, 0, instalacion.stderr);
  assert.ok(fs.existsSync(path.join(carpeta, '.git', 'polaria-gate', 'es-documentacion.js')));

  commitear(carpeta, { 'wms-web/CHANGELOG.md': '# Cambios\n' });
  const documentacion = spawnSync('git', ['push', '-q', 'origin', 'cambio'], { cwd: carpeta, encoding: 'utf8' });
  assert.strictEqual(documentacion.status, 0, documentacion.stderr);

  commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  const codigo = spawnSync('git', ['push', '-q', 'origin', 'cambio'], { cwd: carpeta, encoding: 'utf8' });
  assert.notStrictEqual(codigo.status, 0);
  assert.match(codigo.stderr, /Gate de Calidad Técnica Pre-Merge/);
});
