// Pruebas de escenario: dos devs con git real (ayudas.js) y los scripts y hooks ejecutados como los ejecutan los editores.
// Cubren el CLI (crear-worktree, importar, comparar, estado, solapes) y los tres hooks, incluidos los comportamientos
// reales de Cursor que ya nos fallaron: JSON con BOM, cwd vacío y ejecución del hooks.json de Claude con eventos de Cursor.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git, escribir, crearEscenario, ejecutarParalelo, ejecutarHook, cuerpoDeReclamo, importarReclamos, RECLAMO_DE_MAURO, RECLAMO_DE_DANIEL } = require('./ayudas');

// Daniel arranca pol-102 con la skill: worktree nuevo desde main, y ahí hace un commit que choca con Mauro.
function danielConWorktree({ chocar = true } = {}) {
  const e = crearEscenario();
  const r = ejecutarParalelo(e.daniel, 'crear-worktree', 'daniel/pol-102-login');
  assert.strictEqual(r.codigo, 0, r.error);
  const worktree = path.join(e.carpeta, 'daniel-daniel-pol-102-login');
  if (chocar) {
    escribir(worktree, 'src/auth/session.ts', 'export function login(){return 222}\n\n\n\nexport function logout(){return 2}\n');
    git(worktree, 'commit', '-q', '-am', 'daniel');
  }
  return { ...e, worktree };
}

const eventoEdicion = (cwd, archivo) => ({ cwd, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: archivo } });
const eventoPush = (cwd, comando = 'git push -u origin daniel/pol-102-login') => ({ cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: comando } });

// ---------- CLI ----------

test('crear-worktree: carpeta hermana, rama desde main y sin tracking (un push no iría a main)', () => {
  const e = crearEscenario();
  const r = ejecutarParalelo(e.daniel, 'crear-worktree', 'daniel/pol-102-login');
  assert.strictEqual(r.codigo, 0, r.error);
  const worktree = path.join(e.carpeta, 'daniel-daniel-pol-102-login');
  assert.ok(fs.existsSync(path.join(worktree, 'src', 'auth', 'session.ts')));
  assert.strictEqual(git(worktree, 'rev-parse', '--abbrev-ref', 'HEAD'), 'daniel/pol-102-login');
  assert.throws(() => git(worktree, 'config', '--get', 'branch.daniel/pol-102-login.merge'), 'la rama no debe seguir a origin/main');
});

test('crear-worktree: rechaza una carpeta que ya existe y nombres de rama peligrosos', () => {
  const e = crearEscenario();
  assert.strictEqual(ejecutarParalelo(e.daniel, 'crear-worktree', 'daniel/pol-102-login').codigo, 0);
  assert.strictEqual(ejecutarParalelo(e.daniel, 'crear-worktree', 'daniel/pol-102-login').codigo, 2);
  assert.strictEqual(ejecutarParalelo(e.daniel, 'crear-worktree', 'x; rm -rf /').codigo, 2);
  assert.strictEqual(ejecutarParalelo(e.daniel, 'crear-worktree').codigo, 2);
});

test('crear-worktree: reutiliza una rama local que ya existía', () => {
  const e = crearEscenario();
  git(e.daniel, 'branch', 'daniel/pol-102-login');
  const r = ejecutarParalelo(e.daniel, 'crear-worktree', 'daniel/pol-102-login');
  assert.strictEqual(r.codigo, 0, r.error);
  assert.match(r.salida, /ya existía/);
});

test('importar y estado: guarda reclamos activos y descarta comentarios sin formato', () => {
  const e = danielConWorktree();
  const r = importarReclamos(e.worktree, [RECLAMO_DE_MAURO, RECLAMO_DE_DANIEL, { issue: 'POL-9', cuerpo: 'comentario normal' }]);
  assert.strictEqual(r.codigo, 0, r.error);
  assert.match(r.salida, /2 reclamo\(s\) activo\(s\), 0 liberado\(s\), 1 comentario\(s\) sin formato/);
  const estado = ejecutarParalelo(e.worktree, 'estado').salida;
  assert.match(estado, /Issue de esta rama: POL-102/);
  assert.match(estado, /POL-101 ACTIVO \(Mauro\)/);
});

test('importar: de varios reclamos del mismo issue gana el más reciente', () => {
  const e = danielConWorktree();
  const viejo = { ...RECLAMO_DE_MAURO, creado: '2026-10-25T10:00:00Z', cuerpo: cuerpoDeReclamo({ rama: 'mauro/pol-101-auth', zonas: ['viejo/'] }) };
  const nuevo = { ...RECLAMO_DE_MAURO, creado: '2026-10-26T10:00:00Z', cuerpo: cuerpoDeReclamo({ rama: 'mauro/pol-101-auth', zonas: ['nuevo/'] }) };
  const r = importarReclamos(e.worktree, [nuevo, viejo]);
  assert.match(r.salida, /nuevo\//);
  assert.doesNotMatch(r.salida, /viejo\//);
});

test('importar: archivo inexistente o con JSON roto falla con código 2', () => {
  const e = danielConWorktree({ chocar: false });
  assert.strictEqual(ejecutarParalelo(e.worktree, 'importar', path.join(e.carpeta, 'no-existe.json')).codigo, 2);
  const roto = path.join(e.carpeta, 'roto.json');
  fs.writeFileSync(roto, '{ no es json');
  assert.strictEqual(ejecutarParalelo(e.worktree, 'importar', roto).codigo, 2);
});

test('comparar: avisa solape de zona, de compartido y distingue funciones distintas del mismo archivo', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  const r = ejecutarParalelo(e.worktree, 'comparar', '--zonas', 'src/auth/session.ts#login,package.json,src/otro/,src/ui/a.ts#otra').salida;
  assert.match(r, /SOLAPE: tu `src\/auth\/session\.ts` ↔ `src\/auth\/` de POL-101 \(Mauro\)/);
  assert.match(r, /SOLAPE EN COMPARTIDO: tu `package\.json`/);
  assert.match(r, /funciones distintas del mismo archivo/);
  assert.doesNotMatch(r, /src\/otro/);
});

test('comparar: sin solape lo dice, y sin caché avisa que hay que sincronizar', () => {
  const e = danielConWorktree({ chocar: false });
  assert.match(ejecutarParalelo(e.worktree, 'comparar', '--zonas', 'src/otro/').salida, /no hay caché de reclamos/);
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  assert.match(ejecutarParalelo(e.worktree, 'comparar', '--zonas', 'src/otro/').salida, /Sin solape con los reclamos ajenos activos \(1 revisado/);
});

test('solapes: conflicto real contra la rama remota de Mauro', () => {
  const e = danielConWorktree();
  const r = ejecutarParalelo(e.worktree, 'solapes').salida;
  assert.match(r, /CONFLICTO REAL/);
  assert.match(r, /origin\/mauro\/pol-101-auth: `src\/auth\/session\.ts`/);
});

test('solapes: mismo archivo en otra rama sin chocar en las líneas se avisa como MISMO ARCHIVO', () => {
  const e = danielConWorktree({ chocar: false });
  escribir(e.worktree, 'src/auth/session.ts', 'export function login(){return 1}\n\n\n\nexport function logout(){return 222}\n');
  git(e.worktree, 'commit', '-q', '-am', 'daniel toca la otra línea');
  const r = ejecutarParalelo(e.worktree, 'solapes').salida;
  assert.doesNotMatch(r, /CONFLICTO REAL/);
  assert.match(r, /MISMO ARCHIVO/);
});

test('solapes: trabajo en archivos distintos no genera hallazgos de ramas', () => {
  const e = danielConWorktree({ chocar: false });
  escribir(e.worktree, 'src/otro/x.ts', 'x\n');
  git(e.worktree, 'add', '-A');
  git(e.worktree, 'commit', '-q', '-m', 'otro modulo');
  const r = ejecutarParalelo(e.worktree, 'solapes').salida;
  assert.doesNotMatch(r, /CONFLICTO REAL|MISMO ARCHIVO/);
});

test('solapes: cambios sin commit también cuentan (zona ajena y fuera del reclamo propio)', () => {
  const e = danielConWorktree({ chocar: false });
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO, RECLAMO_DE_DANIEL]);
  escribir(e.worktree, 'src/auth/nuevo.ts', 'x\n'); // Dentro de la carpeta de Mauro y fuera de lo que Daniel reclamó.
  const r = ejecutarParalelo(e.worktree, 'solapes', '--sin-fetch').salida;
  assert.match(r, /ARCHIVOS DENTRO DE UNA ZONA RECLAMADA POR OTRO ISSUE:\n {2}- POL-101 \(Mauro\): `src\/auth\/nuevo\.ts`/);
  assert.match(r, /FUERA DE LO QUE POL-102 RECLAMÓ[^\n]*\n {2}- `src\/auth\/nuevo\.ts`/);
});

test('solapes: un reclamo liberado deja de contar como zona ajena', () => {
  const e = danielConWorktree();
  const liberado = { ...RECLAMO_DE_MAURO, cuerpo: cuerpoDeReclamo({ rama: 'mauro/pol-101-auth', estado: 'LIBERADO', zonas: ['src/auth/'] }) };
  importarReclamos(e.worktree, [liberado, RECLAMO_DE_DANIEL]);
  assert.doesNotMatch(ejecutarParalelo(e.worktree, 'solapes', '--sin-fetch').salida, /ZONA RECLAMADA POR OTRO ISSUE/);
});

test('solapes: una rama ya mergeada a main no cuenta como trabajo de otro', () => {
  const e = danielConWorktree({ chocar: false });
  git(e.mauro, 'checkout', '-q', 'main');
  git(e.mauro, 'merge', '-q', '--ff-only', 'mauro/pol-101-auth');
  git(e.mauro, 'push', '-q', 'origin', 'main');
  escribir(e.worktree, 'src/auth/session.ts', 'export function login(){return 222}\n\n\n\nexport function logout(){return 2}\n');
  git(e.worktree, 'commit', '-q', '-am', 'daniel');
  assert.doesNotMatch(ejecutarParalelo(e.worktree, 'solapes').salida, /origin\/mauro\/pol-101-auth/);
});

test('solapes: dentro de un repo sin remoto avisa y no se cae', () => {
  const e = crearEscenario();
  const vacio = path.join(e.carpeta, 'vacio');
  fs.mkdirSync(vacio);
  git(vacio, 'init', '-q');
  const r = ejecutarParalelo(vacio, 'solapes', '--sin-fetch');
  assert.strictEqual(r.codigo, 0, r.error);
  assert.match(r.salida, /No encontré la rama principal/);
});

test('fuera de un repo git, los comandos fallan con un mensaje claro', () => {
  const e = crearEscenario();
  const r = ejecutarParalelo(e.carpeta, 'estado');
  assert.strictEqual(r.codigo, 2);
  assert.match(r.error, /no es un repo git/i);
});

// ---------- Hook de inicio de sesión ----------

test('sesión: lista los reclamos ajenos con el formato de Claude Code y de Cursor', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO, RECLAMO_DE_DANIEL]);
  const claude = ejecutarHook('al-iniciar-sesion.js', { cwd: e.worktree, hook_event_name: 'SessionStart' });
  assert.strictEqual(claude.json.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(claude.json.hookSpecificOutput.additionalContext, /POL-101 \(Mauro\): src\/auth\/, src\/ui\/a\.ts#render/);
  const cursor = ejecutarHook('al-iniciar-sesion.js', { cwd: e.worktree, hook_event_name: 'sessionStart' }, { cursor: true });
  assert.match(cursor.json.additional_context, /POL-101/);
});

test('sesión: rama con issue y sin reclamo ni caché pide reclamar y sincronizar', () => {
  const e = danielConWorktree({ chocar: false });
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.worktree });
  assert.match(r.json.hookSpecificOutput.additionalContext, /no tiene reclamo vigente/);
  assert.match(r.json.hookSpecificOutput.additionalContext, /modo sincronizar/);
});

test('sesión: en main, sin reclamos de nadie, no dice nada', () => {
  const e = crearEscenario();
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.daniel });
  assert.strictEqual(r.codigo, 0);
  assert.strictEqual(r.salida, '');
});

// ---------- Hook de edición ----------

test('edición: avisa una vez al editar una zona ajena y no repite el aviso', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO, RECLAMO_DE_DANIEL]);
  const evento = eventoEdicion(e.worktree, path.join(e.worktree, 'src', 'auth', 'session.ts'));
  const primera = ejecutarHook('avisar-zona-ajena.js', evento);
  assert.strictEqual(primera.codigo, 0);
  assert.match(primera.json.systemMessage, /POL-101 \(Mauro\) reclamó `src\/auth\/`/);
  assert.match(primera.json.hookSpecificOutput.additionalContext, /zona reclamada por otro issue/);
  assert.strictEqual(ejecutarHook('avisar-zona-ajena.js', evento).salida, '');
});

test('edición: una zona libre, un reclamo liberado o un archivo fuera del repo no avisan', () => {
  const e = danielConWorktree();
  const liberado = { ...RECLAMO_DE_MAURO, cuerpo: cuerpoDeReclamo({ rama: 'mauro/pol-101-auth', estado: 'LIBERADO', zonas: ['src/auth/'] }) };
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  assert.strictEqual(ejecutarHook('avisar-zona-ajena.js', eventoEdicion(e.worktree, path.join(e.worktree, 'src', 'otro', 'x.ts'))).salida, '');
  assert.strictEqual(ejecutarHook('avisar-zona-ajena.js', eventoEdicion(e.worktree, path.join(e.carpeta, 'fuera.txt'))).salida, '');
  importarReclamos(e.worktree, [liberado]);
  assert.strictEqual(ejecutarHook('avisar-zona-ajena.js', eventoEdicion(e.worktree, path.join(e.worktree, 'src', 'auth', 'session.ts'))).salida, '');
});

test('edición: un archivo nuevo dentro de una carpeta reclamada también avisa (el archivo aún no existe)', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  const r = ejecutarHook('avisar-zona-ajena.js', eventoEdicion(e.worktree, path.join(e.worktree, 'src', 'auth', 'carpeta-nueva', 'guard.ts')));
  assert.match(r.json.systemMessage, /src\/auth\/carpeta-nueva\/guard\.ts/);
});

test('edición: un reclamo en compartidos también avisa', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  const r = ejecutarHook('avisar-zona-ajena.js', eventoEdicion(e.worktree, path.join(e.worktree, 'package.json')));
  assert.match(r.json.systemMessage, /`package\.json`/);
});

test('edición: ruta relativa en tool_input y ruta con barras de Windows', { skip: process.platform !== 'win32' && 'las barras invertidas solo son separador en Windows' }, () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  const relativa = ejecutarHook('avisar-zona-ajena.js', eventoEdicion(e.worktree, 'src/auth/session.ts'));
  assert.match(relativa.json.systemMessage, /POL-101/);
  fs.rmSync(path.join(e.daniel, '.git', 'polaria-paralelo', 'avisados.json'), { force: true });
  const conBarras = e.worktree.replace(/\//g, '\\');
  const windows = ejecutarHook('avisar-zona-ajena.js', eventoEdicion(conBarras, `${conBarras}\\src\\auth\\session.ts`));
  assert.match(windows.json.systemMessage, /POL-101/);
});

test('edición: un archivo alcanzado por un enlace (junction o symlink) se resuelve al repo real', () => {
  // Reproduce lo que pasó en el CI de Windows: el editor entrega la ruta por un camino (RUNNER~1) y git la raíz por otro.
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  const enlace = path.join(e.carpeta, 'enlace-al-worktree');
  fs.symlinkSync(e.worktree, enlace, 'junction');
  const r = ejecutarHook('avisar-zona-ajena.js', eventoEdicion(enlace, path.join(enlace, 'src', 'auth', 'nuevo-por-enlace.ts')));
  assert.ok(r.json, 'debía avisar aunque la ruta llegue por un enlace');
  assert.match(r.json.systemMessage, /POL-101/);
});

test('edición: con POLARIA_PARALELO_MODO=bloquear Claude Code rechaza con código 2', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  const r = ejecutarHook('avisar-zona-ajena.js', eventoEdicion(e.worktree, path.join(e.worktree, 'src', 'auth', 'nuevo.ts')), { env: { POLARIA_PARALELO_MODO: 'bloquear' } });
  assert.strictEqual(r.codigo, 2);
  assert.match(r.error, /zona reclamada por otro issue/);
});

test('edición en Cursor: preToolUse permite en modo aviso, postToolUse avisa y en modo bloquear preToolUse rechaza', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  const archivo = path.join(e.worktree, 'src', 'auth', 'session.ts');
  const evento = (nombre) => ({ cwd: e.worktree, hook_event_name: nombre, tool_name: 'Write', tool_input: { file_path: archivo } });

  assert.deepStrictEqual(ejecutarHook('avisar-zona-ajena.js', evento('preToolUse'), { cursor: true }).json, { permission: 'allow' });
  const despues = ejecutarHook('avisar-zona-ajena.js', evento('postToolUse'), { cursor: true });
  assert.match(despues.json.additional_context, /POL-101/);

  const bloqueado = ejecutarHook('avisar-zona-ajena.js', evento('preToolUse'), { cursor: true, env: { POLARIA_PARALELO_MODO: 'bloquear' } });
  assert.strictEqual(bloqueado.codigo, 2);
  assert.strictEqual(bloqueado.json.permission, 'deny');
  assert.strictEqual(ejecutarHook('avisar-zona-ajena.js', evento('postToolUse'), { cursor: true, env: { POLARIA_PARALELO_MODO: 'bloquear' } }).salida, '');
});

// ---------- Hook de push ----------

test('push: avisa conflicto y zona ajena y deja pasar (Claude Code)', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO, RECLAMO_DE_DANIEL]);
  const r = ejecutarHook('revisar-antes-de-push.js', eventoPush(e.worktree));
  assert.strictEqual(r.codigo, 0);
  assert.match(r.json.systemMessage, /CONFLICTO REAL/);
  assert.match(r.json.hookSpecificOutput.additionalContext, /ARCHIVOS DENTRO DE UNA ZONA RECLAMADA/);
});

test('push: con POLARIA_PARALELO_MODO=bloquear un conflicto real bloquea el push', () => {
  const e = danielConWorktree();
  const r = ejecutarHook('revisar-antes-de-push.js', eventoPush(e.worktree), { env: { POLARIA_PARALELO_MODO: 'bloquear' } });
  assert.strictEqual(r.codigo, 2);
  assert.match(r.error, /CONFLICTO REAL/);
});

test('push: en modo bloquear, un solape sin conflicto real no bloquea', () => {
  const e = danielConWorktree({ chocar: false });
  escribir(e.worktree, 'src/auth/session.ts', 'export function login(){return 1}\n\n\n\nexport function logout(){return 222}\n');
  git(e.worktree, 'commit', '-q', '-am', 'otra linea');
  const r = ejecutarHook('revisar-antes-de-push.js', eventoPush(e.worktree), { env: { POLARIA_PARALELO_MODO: 'bloquear' } });
  assert.strictEqual(r.codigo, 0);
  assert.match(r.json.systemMessage, /MISMO ARCHIVO/);
});

test('push: sin solapes no dice nada', () => {
  const e = danielConWorktree({ chocar: false });
  escribir(e.worktree, 'src/otro/x.ts', 'x\n');
  git(e.worktree, 'add', '-A');
  git(e.worktree, 'commit', '-q', '-m', 'otro');
  const r = ejecutarHook('revisar-antes-de-push.js', eventoPush(e.worktree));
  assert.strictEqual(r.codigo, 0);
  assert.strictEqual(r.salida, '');
});

test('push: ignora comandos que no son push, borrar una rama remota y carpetas fuera de un repo', () => {
  const e = danielConWorktree();
  for (const comando of ['git status', 'git stash push', 'echo "git push" > nota.txt', 'git push origin --delete otra', 'git push origin -d otra']) {
    const r = ejecutarHook('revisar-antes-de-push.js', eventoPush(e.worktree, comando));
    assert.strictEqual(r.salida, '', `no debía actuar con: ${comando}`);
  }
  assert.strictEqual(ejecutarHook('revisar-antes-de-push.js', eventoPush(e.carpeta)).salida, '');
});

test('push: reconoce git con opciones globales (git -C ruta push)', () => {
  const e = danielConWorktree();
  const r = ejecutarHook('revisar-antes-de-push.js', eventoPush(e.worktree, `git -C "${e.worktree}" push`));
  assert.match(r.json.systemMessage, /CONFLICTO REAL/);
});

test('push en Cursor: responde permission allow con el aviso, y deny en modo bloquear', () => {
  const e = danielConWorktree();
  const evento = { cwd: e.worktree, hook_event_name: 'beforeShellExecution', command: 'git push' };
  const aviso = ejecutarHook('revisar-antes-de-push.js', evento, { cursor: true });
  assert.strictEqual(aviso.json.permission, 'allow');
  assert.match(aviso.json.agent_message, /CONFLICTO REAL/);
  const bloqueo = ejecutarHook('revisar-antes-de-push.js', evento, { cursor: true, env: { POLARIA_PARALELO_MODO: 'bloquear' } });
  assert.strictEqual(bloqueo.codigo, 2);
  assert.strictEqual(bloqueo.json.permission, 'deny');
});

// ---------- Comportamientos reales de Cursor y entradas hostiles ----------

test('Cursor en Windows: stdin con BOM, cwd vacío y repo por CURSOR_PROJECT_DIR / workspace_roots', () => {
  const e = danielConWorktree();
  importarReclamos(e.worktree, [RECLAMO_DE_MAURO]);
  const archivo = path.join(e.worktree, 'src', 'auth', 'session.ts');
  const base = { cwd: '', hook_event_name: 'postToolUse', tool_name: 'Write', tool_input: { file_path: archivo } };

  const conBom = ejecutarHook('avisar-zona-ajena.js', base, { cursor: true, bom: true, cwd: e.carpeta, env: { CURSOR_PROJECT_DIR: e.worktree } });
  assert.match(conBom.json.additional_context, /POL-101/, 'el BOM no debe romper el parseo');

  fs.rmSync(path.join(e.daniel, '.git', 'polaria-paralelo', 'avisados.json'), { force: true });
  const uri = `/${e.worktree.replace(/\\/g, '/').replace(/^\/?([a-zA-Z]:)/, '$1')}`;
  const porRaiz = ejecutarHook('revisar-antes-de-push.js', { cwd: '', hook_event_name: 'beforeShellExecution', command: 'git push', workspace_roots: [uri] }, { cursor: true, bom: true, cwd: e.carpeta });
  assert.match(porRaiz.json.agent_message || '', /CONFLICTO REAL/, 'workspace_roots como ruta de URI debe resolverse al repo');
});

test('Cursor ejecuta hooks.json de Claude: el push con evento de Cursor y sin CURSOR_VERSION sigue respondiendo en formato Cursor', () => {
  const e = danielConWorktree();
  const r = ejecutarHook('revisar-antes-de-push.js', { cwd: e.worktree, hook_event_name: 'PreToolUse', command: 'git push', workspace_roots: [] });
  assert.strictEqual(r.json.permission, 'allow', 'un evento sin tool_input es de Cursor aunque la variable no esté');
});

test('entradas hostiles: JSON ilegible, vacío o de un tipo inesperado nunca rompen ni bloquean', () => {
  const e = danielConWorktree();
  for (const hook of ['al-iniciar-sesion.js', 'avisar-zona-ajena.js', 'revisar-antes-de-push.js']) {
    for (const entrada of ['no es json', '', '[]', 'null', '{"tool_input":{}}', '{"tool_input":{"command":123}}']) {
      const r = ejecutarHook(hook, entrada, { cwd: e.worktree, env: { POLARIA_PARALELO_MODO: 'bloquear' } });
      assert.strictEqual(r.codigo, 0, `${hook} con ${JSON.stringify(entrada)} salió con ${r.codigo}: ${r.error}`);
    }
  }
});

test('una caché corrupta no rompe los hooks', () => {
  const e = danielConWorktree();
  fs.mkdirSync(path.join(e.daniel, '.git', 'polaria-paralelo'), { recursive: true });
  fs.writeFileSync(path.join(e.daniel, '.git', 'polaria-paralelo', 'reclamos.json'), '{ corrupto');
  const r = ejecutarHook('avisar-zona-ajena.js', eventoEdicion(e.worktree, path.join(e.worktree, 'src', 'auth', 'session.ts')), { env: { POLARIA_PARALELO_MODO: 'bloquear' } });
  assert.strictEqual(r.codigo, 0);
});
