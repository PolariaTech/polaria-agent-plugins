// Pruebas del CLAIM.md como única fuente de verdad y del límite de escritura: reclamar, ampliar (autorizar), liberar, la
// inactividad, el pre-commit de git y los hooks que rechazan escribir fuera de las zonas. Usan git real (ayudas.js).

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const lib = require('../scripts/lib');
const claims = require('../scripts/claims');
const { RAIZ_PLUGIN, git, gitSinLanzar, escribir, crearEscenario, ejecutarParalelo, ejecutarHook, mauroPublicaClaim } = require('./ayudas');

const PARALELO = path.join(RAIZ_PLUGIN, 'scripts', 'paralelo.js');
const INSTALADOR = path.join(RAIZ_PLUGIN, 'scripts', 'instalar-pre-commit.js');

function conWorktree() {
  const e = crearEscenario();
  const r = ejecutarParalelo(e.daniel, 'iniciar-rama', 'daniel/pol-102-login');
  assert.strictEqual(r.codigo, 0, r.error);
  return { ...e, worktree: e.daniel };
}

// Daniel en su rama de ticket (misma carpeta del clon) y el reclamo ya creado y publicado por el CLI.
function conReclamo(zonas = 'src/ui/') {
  const e = conWorktree();
  const r = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', zonas, '--compartidos', 'package.json', '--confianza', '80', '--responsable', 'Daniel', '--porque', 'Prueba', '--permitir-carpetas');
  assert.strictEqual(r.codigo, 0, `${r.error}${r.salida}`);
  return e;
}

const claimDe = (e) => fs.readFileSync(path.join(e.worktree, 'CLAIM.md'), 'utf8');
const evento = (cwd, archivo, extra = {}) => ({ cwd, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: archivo }, ...extra });
const eventoBash = (cwd, comando) => ({ cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: comando } });

// ---------- reclamar ----------

test('reclamar: crea el CLAIM.md como primer commit, publica la rama e instala el pre-commit', () => {
  const e = conReclamo('src/ui/,src/ui/a.ts#fn');
  const claim = claimDe(e);
  assert.match(claim, /^<!-- polaria-reclamo v1 -->/);
  assert.match(claim, /\*\*Issue:\*\* POL-102/);
  assert.match(claim, /\*\*Confianza:\*\* 80%/);
  assert.match(claim, /- `src\/ui\/`/);
  assert.match(claim, /- `src\/ui\/a\.ts#fn`/);
  assert.match(claim, /- `package\.json`/);
  assert.strictEqual(git(e.worktree, 'log', '-1', '--format=%s'), 'claim(POL-102): reclama las zonas del ticket');
  assert.strictEqual(git(e.origen, 'show', 'daniel/pol-102-login:CLAIM.md').replace(/\r/g, ''), claim.replace(/\r/g, '').trim());
  assert.match(fs.readFileSync(path.join(e.daniel, '.git', 'hooks', 'pre-commit'), 'utf8'), /polaria-trabajo-en-paralelo/);
});

test('reclamar: una zona que choca con otra rama frena (código 3) y no escribe ni publica nada', () => {
  const e = conWorktree();
  mauroPublicaClaim(e);
  const r = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/auth/session.ts', '--confianza', '80');
  assert.strictEqual(r.codigo, 3);
  assert.match(r.error, /SOLAPE: tu `src\/auth\/session\.ts` ↔ `src\/auth\/` de POL-101 \(Mauro\)/);
  assert.match(r.error, /No reclamé nada/);
  assert.ok(!fs.existsSync(path.join(e.worktree, 'CLAIM.md')));
  assert.throws(() => git(e.origen, 'show', 'daniel/pol-102-login:CLAIM.md'), 'la rama no debía publicarse');
});

test('reclamar: un choque solo con archivos compartidos no frena, se anota', () => {
  const e = conWorktree();
  mauroPublicaClaim(e);
  const r = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'package.json', '--confianza', '70');
  assert.strictEqual(r.codigo, 0, r.error);
  assert.match(r.salida, /SOLAPE EN COMPARTIDO: tu `package\.json`.*\(solo se anota\)/);
});

test('reclamar: un reclamo inactivo (más de 5 días sin commits) no frena; uno de 4 días sí', () => {
  const inactivo = conWorktree();
  mauroPublicaClaim(inactivo, { diasAtras: 10 });
  const libre = ejecutarParalelo(inactivo.worktree, 'reclamar', '--zonas', 'src/auth/session.ts', '--confianza', '80');
  assert.strictEqual(libre.codigo, 0, libre.error);

  const vigente = conWorktree();
  mauroPublicaClaim(vigente, { diasAtras: 4 });
  assert.strictEqual(ejecutarParalelo(vigente.worktree, 'reclamar', '--zonas', 'src/auth/session.ts', '--confianza', '80').codigo, 3);
});

test('reclamar: rechaza un segundo reclamo, rutas peligrosas, confianza faltante y ramas sin ID de ticket', () => {
  const e = conReclamo();
  assert.strictEqual(ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/otro/', '--confianza', '80').codigo, 2);
  const otra = conWorktree();
  for (const zona of ['../fuera/', '/', 'C:\\Windows', 'a`b/']) {
    assert.strictEqual(ejecutarParalelo(otra.worktree, 'reclamar', '--zonas', zona, '--confianza', '80').codigo, 2, `debía rechazar ${zona}`);
  }
  assert.strictEqual(ejecutarParalelo(otra.worktree, 'reclamar', '--zonas', 'src/ui/a.ts').codigo, 2, 'sin --confianza');
  assert.strictEqual(ejecutarParalelo(otra.worktree, 'reclamar', '--confianza', '80').codigo, 2, 'sin --zonas');
  assert.match(ejecutarParalelo(crearEscenario().daniel, 'reclamar', '--zonas', 'src/a/', '--confianza', '80').error, /no trae un ID de ticket/);
});

// ---------- importar-claims, inactividad y cruce ----------

test('inactividad: el reclamo de una rama con el último commit de hace más de 5 días se ignora y se avisa', () => {
  const e = conWorktree();
  mauroPublicaClaim(e, { diasAtras: 10 });
  const importacion = ejecutarParalelo(e.worktree, 'importar-claims').salida;
  assert.match(importacion, /0 reclamo\(s\) ajeno\(s\) vigente\(s\), 1 inactivo\(s\)/);
  assert.match(importacion, /POL-101 INACTIVO/);
  const comparacion = ejecutarParalelo(e.worktree, 'comparar', '--zonas', 'src/auth/session.ts').salida;
  assert.match(comparacion, /AVISO: el reclamo de POL-101 está inactivo/);
  assert.match(comparacion, /Sin solape/);
  assert.match(ejecutarParalelo(e.worktree, 'estado').salida, /POL-101 INACTIVO/);
});

test('inactividad: un commit nuevo en la rama reactiva el reclamo', () => {
  const e = conWorktree();
  mauroPublicaClaim(e, { diasAtras: 10 });
  assert.match(ejecutarParalelo(e.worktree, 'importar-claims').salida, /1 inactivo/);
  escribir(e.mauro, 'src/ui/a.ts', 'ui3\n');
  git(e.mauro, 'commit', '-q', '-am', 'sigue trabajando');
  git(e.mauro, 'push', '-q', 'origin', 'mauro/pol-101-auth');
  assert.match(ejecutarParalelo(e.worktree, 'importar-claims').salida, /1 reclamo\(s\) ajeno\(s\) vigente\(s\), 0 inactivo\(s\)/);
});

test('solapes: el CLAIM.md de cada rama no se cuenta como conflicto entre ramas', () => {
  const e = conWorktree();
  mauroPublicaClaim(e);
  assert.strictEqual(ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/otro.ts', '--nuevos', 'src/otro.ts', '--confianza', '80').codigo, 0);
  // Las dos ramas "agregaron" CLAIM.md con contenido distinto: sin el filtro, git merge-tree lo reportaría como conflicto.
  const r = ejecutarParalelo(e.worktree, 'solapes', '--sin-fetch').salida;
  assert.doesNotMatch(r, /CONFLICTO REAL|CLAIM\.md/);
  assert.match(r, /Sin solapes/);
});

// ---------- autorizar / ampliar ----------

test('autorizar: sin terminal interactiva el CLI no hace nada (código 4)', () => {
  const e = conReclamo();
  const antes = claimDe(e);
  const r = ejecutarParalelo(e.worktree, 'autorizar', 'src/otro/');
  assert.strictEqual(r.codigo, 4);
  assert.match(r.error, /solo lo puede correr una persona/);
  assert.strictEqual(claimDe(e), antes);
});

test('ampliar: con la confirmación del usuario agrega la ruta, commitea y publica el nuevo alcance', async () => {
  const e = conReclamo();
  const repo = lib.infoDelRepo(e.worktree);
  let pregunta = '';
  const r = await claims.ampliar(repo, ['src/otro/'], { confirmar: async (texto) => ((pregunta = texto), true) });
  assert.strictEqual(r.codigo, 0, r.mensaje);
  assert.match(pregunta, /ampliar el reclamo de POL-102 con: src\/otro\//);
  assert.match(claimDe(e), /- `src\/otro\/` — autorizada por el usuario el \d{4}-\d{2}-\d{2}/);
  assert.match(claimDe(e), /### Compartidos/, 'el resto del archivo se conserva');
  assert.strictEqual(git(e.worktree, 'log', '-1', '--format=%s'), 'claim(POL-102): amplía el alcance con src/otro/');
  assert.match(git(e.origen, 'show', 'daniel/pol-102-login:CLAIM.md'), /src\/otro\//);
  // Ahora el pre-commit acepta un archivo de esa zona.
  escribir(e.worktree, 'src/otro/x.ts', 'x\n');
  git(e.worktree, 'add', 'src/otro/x.ts');
  assert.strictEqual(gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'dentro').codigo, 0);
});

test('ampliar: si la ruta choca con otra rama se detiene sin pedir confirmación ni cambiar nada', async () => {
  const e = conReclamo();
  mauroPublicaClaim(e);
  const antes = claimDe(e);
  const r = await claims.ampliar(lib.infoDelRepo(e.worktree), ['src/auth/x.ts'], {
    confirmar: async () => assert.fail('no debía pedir confirmación si hay un choque'),
  });
  assert.strictEqual(r.codigo, 3);
  assert.match(r.mensaje, /SOLAPE: tu `src\/auth\/x\.ts` ↔ `src\/auth\/` de POL-101/);
  assert.strictEqual(claimDe(e), antes);
});

test('ampliar: si el usuario no confirma no cambia nada; una ruta ya cubierta o inválida ni pregunta', async () => {
  const e = conReclamo();
  const repo = lib.infoDelRepo(e.worktree);
  const antes = claimDe(e);
  const commitsAntes = git(e.worktree, 'rev-list', '--count', 'HEAD');
  const rechazada = await claims.ampliar(repo, ['src/otro/'], { confirmar: async () => false });
  assert.strictEqual(rechazada.codigo, 1);
  assert.strictEqual(claimDe(e), antes);
  assert.strictEqual(git(e.worktree, 'rev-list', '--count', 'HEAD'), commitsAntes);

  const sinPreguntar = { confirmar: async () => assert.fail('no debía preguntar') };
  assert.strictEqual((await claims.ampliar(repo, ['src/ui/nuevo.ts'], sinPreguntar)).codigo, 0);
  assert.strictEqual((await claims.ampliar(repo, ['../afuera/'], sinPreguntar)).codigo, 2);
  assert.strictEqual((await claims.ampliar(repo, [], sinPreguntar)).codigo, 2);
  assert.strictEqual((await claims.ampliar(lib.infoDelRepo(crearEscenario().daniel), ['src/a/'], sinPreguntar)).codigo, 2, 'sin CLAIM.md');
});

// ---------- liberar ----------

test('liberar: borra el CLAIM.md con commit y push, y deja el resultado en el mensaje', () => {
  const e = conReclamo();
  escribir(e.worktree, 'src/ui/b.ts', 'b\n');
  git(e.worktree, 'add', 'src/ui/b.ts');
  git(e.worktree, 'commit', '-q', '-m', 'trabajo');
  const r = ejecutarParalelo(e.worktree, 'liberar');
  assert.strictEqual(r.codigo, 0, `${r.error}${r.salida}`);
  assert.match(r.salida, /1 de 1 archivos dentro de lo reclamado/);
  assert.ok(!fs.existsSync(path.join(e.worktree, 'CLAIM.md')));
  assert.match(git(e.worktree, 'log', '-1', '--format=%s'), /claim\(POL-102\): libera el reclamo \(1 de 1 archivos dentro de lo reclamado; confianza declarada 80%\)/);
  assert.doesNotMatch(git(e.origen, 'ls-tree', '--name-only', 'daniel/pol-102-login'), /CLAIM\.md/);
  assert.strictEqual(ejecutarParalelo(e.worktree, 'liberar').codigo, 2, 'ya no hay nada que liberar');
});

test('liberar: cuenta como fuera de lo reclamado el trabajo que se salió de las zonas', () => {
  const e = conReclamo();
  escribir(e.worktree, 'src/ui/b.ts', 'b\n');
  git(e.worktree, 'add', 'src/ui/b.ts');
  git(e.worktree, 'commit', '-q', '-m', 'dentro');
  // Un commit con --no-verify (lo único que se salta el pre-commit) deja un archivo fuera de la zona.
  escribir(e.worktree, 'src/afuera/c.ts', 'c\n');
  git(e.worktree, 'add', 'src/afuera/c.ts');
  git(e.worktree, 'commit', '-q', '--no-verify', '-m', 'fuera');
  assert.match(ejecutarParalelo(e.worktree, 'liberar').salida, /1 de 2 archivos dentro de lo reclamado/);
});

// ---------- pre-commit de git ----------

test('pre-commit: acepta archivos dentro de la zona y rechaza los de fuera', () => {
  const e = conReclamo();
  escribir(e.worktree, 'src/ui/ok.ts', 'x\n');
  git(e.worktree, 'add', 'src/ui/ok.ts');
  assert.strictEqual(gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'dentro').codigo, 0);

  escribir(e.worktree, 'src/otro/fuera.ts', 'x\n');
  git(e.worktree, 'add', 'src/otro/fuera.ts');
  const fuera = gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'fuera');
  assert.notStrictEqual(fuera.codigo, 0);
  assert.match(fuera.error, /fuera de las zonas de tu CLAIM\.md/);
  assert.match(fuera.error, /src\/otro\/fuera\.ts/);
  assert.match(fuera.error, /autorizar <ruta>/);
});

test('pre-commit: el CLAIM.md escrito o borrado a mano no pasa', () => {
  const e = conReclamo();
  const original = claimDe(e);
  fs.writeFileSync(path.join(e.worktree, 'CLAIM.md'), `${original}\n- \`src/otro/\` — a mano\n`);
  git(e.worktree, 'add', 'CLAIM.md');
  const ampliado = gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'amplío a mano');
  assert.notStrictEqual(ampliado.codigo, 0);
  assert.match(ampliado.error, /no fue escrito/);
  git(e.worktree, 'reset', '-q', '--hard', 'HEAD');

  git(e.worktree, 'rm', '-q', 'CLAIM.md');
  const borrado = gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'borro a mano');
  assert.notStrictEqual(borrado.codigo, 0);
  assert.match(borrado.error, /solo se borra con "paralelo\.js liberar"/);
});

test('pre-commit: una autorización caducada o de otro contenido no sirve', () => {
  const e = conReclamo();
  const repo = lib.infoDelRepo(e.worktree);
  fs.writeFileSync(path.join(e.worktree, 'CLAIM.md'), `${claimDe(e)}\n- \`src/otro/\` — a mano\n`);
  lib.registrarAutorizado(repo, lib.hashDeClaim('otro contenido'));
  git(e.worktree, 'add', 'CLAIM.md');
  assert.notStrictEqual(gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'x').codigo, 0);
  assert.ok(!lib.estaAutorizado({ directorioCache: path.join(e.carpeta, 'no-existe') }, 'x'));
});

test('pre-commit: en una rama sin CLAIM.md, y en un merge, deja pasar cualquier archivo', () => {
  const e = conWorktree();
  execFileSync(process.execPath, [INSTALADOR], { cwd: e.worktree, encoding: 'utf8' });
  escribir(e.worktree, 'src/cualquier/cosa.ts', 'x\n');
  git(e.worktree, 'add', 'src/cualquier/cosa.ts');
  assert.strictEqual(gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'sin reclamo').codigo, 0);

  const conReclamoYMerge = conReclamo();
  git(conReclamoYMerge.mauro, 'checkout', '-q', 'main');
  escribir(conReclamoYMerge.mauro, 'docs/nuevo.md', 'doc\n');
  git(conReclamoYMerge.mauro, 'add', 'docs/nuevo.md');
  git(conReclamoYMerge.mauro, 'commit', '-q', '-m', 'docs en main');
  git(conReclamoYMerge.mauro, 'push', '-q', 'origin', 'main');
  git(conReclamoYMerge.worktree, 'fetch', '-q', 'origin');
  git(conReclamoYMerge.worktree, 'merge', '-q', '--no-commit', '--no-ff', 'origin/main');
  assert.strictEqual(gitSinLanzar(conReclamoYMerge.worktree, 'commit', '-q', '-m', 'merge de main').codigo, 0, 'un merge trae archivos de otros y no es trabajo propio');
});

test('instalar-pre-commit: no pisa un pre-commit ajeno y avisa; es idempotente', () => {
  const e = conWorktree();
  assert.match(execFileSync(process.execPath, [INSTALADOR], { cwd: e.worktree, encoding: 'utf8' }), /instalado/);
  assert.match(execFileSync(process.execPath, [INSTALADOR], { cwd: e.worktree, encoding: 'utf8' }), /ya-instalado/);
  const propio = path.join(e.daniel, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(propio, '#!/bin/sh\necho mio\n');
  assert.match(execFileSync(process.execPath, [INSTALADOR], { cwd: e.worktree, encoding: 'utf8' }), /AVISO: ya existe un pre-commit propio/);
  assert.match(fs.readFileSync(propio, 'utf8'), /echo mio/);
});

// ---------- Hook que limita la escritura ----------

test('limitar-escritura: rechaza un archivo fuera de las zonas y explica cómo autorizar', () => {
  const e = conReclamo();
  const r = ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, 'src', 'otro', 'x.ts')));
  assert.strictEqual(r.codigo, 2);
  assert.match(r.error, /no puedes editar `src\/otro\/x\.ts`/);
  assert.match(r.error, /fuera de las zonas y compartidos del CLAIM\.md/);
  assert.match(r.error, /autorizar src\/otro\/x\.ts/);
});

test('limitar-escritura: deja editar dentro de una zona, de un archivo nuevo en ella y de un compartido', () => {
  const e = conReclamo();
  for (const archivo of ['src/ui/a.ts', 'src/ui/carpeta-nueva/x.ts', 'package.json']) {
    const r = ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, archivo)));
    assert.strictEqual(r.codigo, 0, `${archivo}: ${r.error}`);
    assert.strictEqual(r.salida, '');
  }
});

test('limitar-escritura: rechaza aunque el asistente edite en el worktree desde otro cwd, con ruta relativa y con NotebookEdit', () => {
  const e = conReclamo();
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.daniel, path.join(e.worktree, 'src', 'otro', 'x.ts'))).codigo, 2, 'cwd en el clon principal');
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, 'src/otro/x.ts')).codigo, 2, 'ruta relativa');
  const cuaderno = { cwd: e.worktree, hook_event_name: 'PreToolUse', tool_name: 'NotebookEdit', tool_input: { notebook_path: path.join(e.worktree, 'src', 'otro', 'n.ipynb') } };
  assert.strictEqual(ejecutarHook('limitar-escritura.js', cuaderno).codigo, 2);
});

test('limitar-escritura: sin CLAIM.md en la rama deja editar, pero el CLAIM.md nunca se escribe a mano', () => {
  const e = conWorktree();
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, 'src', 'otro', 'x.ts'))).codigo, 0);
  const aMano = ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, 'CLAIM.md')));
  assert.strictEqual(aMano.codigo, 2);
  assert.match(aMano.error, /no se edita a mano/);
  const conReclamoYa = conReclamo();
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(conReclamoYa.worktree, path.join(conReclamoYa.worktree, 'CLAIM.md'))).codigo, 2);
});

test('limitar-escritura: protege los archivos del plugin, su caché y los hooks de git mientras hay reclamo', () => {
  const e = conReclamo();
  const intentos = [
    path.join(RAIZ_PLUGIN, 'scripts', 'lib.js'),
    path.join(e.daniel, '.git', 'polaria-paralelo', 'autorizados.json'),
    path.join(e.daniel, '.git', 'hooks', 'pre-commit'),
  ];
  for (const archivo of intentos) {
    const r = ejecutarHook('limitar-escritura.js', evento(e.worktree, archivo));
    assert.strictEqual(r.codigo, 2, `debía rechazar ${archivo}`);
    assert.match(r.error, /no se editan durante una tarea con CLAIM\.md/);
  }
  // Sin reclamo no hay nada que proteger.
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(conWorktree().worktree, path.join(RAIZ_PLUGIN, 'scripts', 'lib.js'))).codigo, 0);
});

test('limitar-escritura: el rechazo no depende de POLARIA_PARALELO_MODO', () => {
  const e = conReclamo();
  for (const modo of [undefined, 'aviso', 'bloquear']) {
    const r = ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, 'src', 'otro', 'x.ts')), { env: modo ? { POLARIA_PARALELO_MODO: modo } : {} });
    assert.strictEqual(r.codigo, 2, `modo ${modo}`);
  }
});

test('limitar-escritura en Cursor: preToolUse rechaza con permission deny, permite lo que está en la zona y postToolUse calla', () => {
  const e = conReclamo();
  const cursor = (archivo, nombre = 'preToolUse') => ({ cwd: e.worktree, hook_event_name: nombre, tool_name: 'Write', tool_input: { file_path: path.join(e.worktree, archivo) } });
  const fuera = ejecutarHook('limitar-escritura.js', cursor('src/otro/x.ts'), { cursor: true });
  assert.strictEqual(fuera.codigo, 2);
  assert.strictEqual(fuera.json.permission, 'deny');
  assert.match(fuera.json.agent_message, /autorizar src\/otro\/x\.ts/);
  assert.deepStrictEqual(ejecutarHook('limitar-escritura.js', cursor('src/ui/a.ts'), { cursor: true }).json, { permission: 'allow' });
  assert.strictEqual(ejecutarHook('limitar-escritura.js', cursor('src/otro/x.ts', 'postToolUse'), { cursor: true }).salida, '');
});

// ---------- Hook de terminal ----------

test('guardar-bash: con reclamo rechaza saltarse los hooks de git', () => {
  const e = conReclamo();
  for (const comando of [
    'git commit --no-verify -m x',
    'git commit -n -m x',
    'git commit -anm x',
    'git push --no-verify',
    'git -c core.hooksPath=/dev/null commit -m x',
    'git config core.hooksPath /tmp/vacio',
    'cd /tmp && git commit --no-verify -m x',
  ]) {
    const r = ejecutarHook('guardar-bash.js', eventoBash(e.worktree, comando));
    assert.strictEqual(r.codigo, 2, `debía rechazar: ${comando}`);
    assert.match(r.error, /no puedes saltarte los hooks de git/);
  }
  for (const comando of ['git commit -m "arreglo"', 'git commit --amend --no-edit', 'git push -u origin daniel/pol-102-login', 'git push -n', 'git status']) {
    assert.strictEqual(ejecutarHook('guardar-bash.js', eventoBash(e.worktree, comando)).codigo, 0, `no debía rechazar: ${comando}`);
  }
});

test('guardar-bash: con reclamo rechaza escribir el CLAIM.md o la caché por la terminal, y deja leerlos', () => {
  const e = conReclamo();
  for (const comando of [
    'echo "- `x/`" >> CLAIM.md',
    'sed -i s/80/99/ CLAIM.md',
    'rm CLAIM.md',
    'mv CLAIM.md /tmp/c.md',
    'git checkout -- CLAIM.md',
    'python -c "open(\'CLAIM.md\',\'w\').write(\'x\')"',
    'Set-Content CLAIM.md "x"',
    'echo "{}" > .git/polaria-paralelo/autorizados.json',
    'rm .git/hooks/pre-commit',
  ]) {
    assert.strictEqual(ejecutarHook('guardar-bash.js', eventoBash(e.worktree, comando)).codigo, 2, `debía rechazar: ${comando}`);
  }
  for (const comando of ['cat CLAIM.md', 'git show origin/mauro/pol-101-auth:CLAIM.md', 'grep -n zonas CLAIM.md', `node "${PARALELO}" reclamar --zonas src/a/ --confianza 80 --porque "ver CLAIM.md"`, `node "${PARALELO}" liberar`]) {
    assert.strictEqual(ejecutarHook('guardar-bash.js', eventoBash(e.worktree, comando)).codigo, 0, `no debía rechazar: ${comando}`);
  }
});

test('guardar-bash: sin CLAIM.md en la rama no restringe nada; en Cursor responde con permission', () => {
  const sin = conWorktree();
  assert.strictEqual(ejecutarHook('guardar-bash.js', eventoBash(sin.worktree, 'git commit --no-verify -m x')).codigo, 0);
  const e = conReclamo();
  const comando = { cwd: e.worktree, hook_event_name: 'beforeShellExecution', command: 'git commit --no-verify -m x' };
  const rechazado = ejecutarHook('guardar-bash.js', comando, { cursor: true });
  assert.strictEqual(rechazado.codigo, 2);
  assert.strictEqual(rechazado.json.permission, 'deny');
  assert.strictEqual(ejecutarHook('guardar-bash.js', { ...comando, command: 'git status' }, { cursor: true }).json.permission, 'allow');
});

// ---------- Hook de inicio de sesión ----------

test('sesión: con CLAIM.md propio dice sus zonas y que fuera de ellas se necesita al usuario; instala el pre-commit', () => {
  const e = conReclamo('src/ui/');
  fs.rmSync(path.join(e.daniel, '.git', 'hooks', 'pre-commit'));
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.worktree, hook_event_name: 'SessionStart' });
  const texto = r.json.hookSpecificOutput.additionalContext;
  assert.match(texto, /esta rama tiene reclamo \(POL-102, confianza 80%\)/);
  assert.match(texto, /src\/ui\/, package\.json/);
  assert.match(texto, /paralelo\.js autorizar/);
  assert.ok(fs.existsSync(path.join(e.daniel, '.git', 'hooks', 'pre-commit')), 'el inicio de sesión reinstala el pre-commit');
});

test('sesión: menciona los reclamos inactivos que se ignoran', () => {
  const e = conWorktree();
  mauroPublicaClaim(e, { diasAtras: 10 });
  ejecutarParalelo(e.worktree, 'importar-claims');
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.worktree, hook_event_name: 'SessionStart' });
  assert.match(r.json.hookSpecificOutput.additionalContext, /Reclamos inactivos, ignorados.*POL-101/);
});

// ---------- zonas por archivo exacto ----------

test('reclamar: rechaza las carpetas y dice cómo listar archivos; con --permitir-carpetas exige el motivo y las marca', () => {
  const e = conWorktree();
  const sinPermiso = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/', '--confianza', '80', '--porque', 'Prueba');
  assert.strictEqual(sinPermiso.codigo, 2);
  assert.match(sinPermiso.error, /archivos exactos, no carpetas: src\/ui\//);
  assert.ok(!fs.existsSync(path.join(e.worktree, 'CLAIM.md')));
  const sinMotivo = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/', '--confianza', '80', '--permitir-carpetas');
  assert.strictEqual(sinMotivo.codigo, 2);
  assert.match(sinMotivo.error, /--porque debe explicar/);
  const conMotivo = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/', '--confianza', '80', '--permitir-carpetas', '--porque', 'Archivos generados');
  assert.strictEqual(conMotivo.codigo, 0, `${conMotivo.error}${conMotivo.salida}`);
  assert.match(claimDe(e), /- `src\/ui\/` — carpeta \(excepción\)/);
});

test('reclamar: una ruta que no existe se rechaza salvo que vaya en --nuevos, y el CLAIM.md la marca como archivo nuevo', () => {
  const e = conWorktree();
  const inventada = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/a.ts,src/ui/b.ts', '--confianza', '80', '--porque', 'Prueba');
  assert.strictEqual(inventada.codigo, 2);
  assert.match(inventada.error, /no existen en el repo: src\/ui\/b\.ts/);
  const existente = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/a.ts', '--nuevos', 'src/ui/a.ts', '--confianza', '80');
  assert.strictEqual(existente.codigo, 2);
  assert.match(existente.error, /ya existen/);
  const ajeno = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/a.ts', '--nuevos', 'src/ui/c.ts', '--confianza', '80');
  assert.strictEqual(ajeno.codigo, 2);
  assert.match(ajeno.error, /no están en --zonas/);
  const bien = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/a.ts#render,src/ui/b.ts', '--nuevos', 'src/ui/b.ts', '--confianza', '80', '--porque', 'Prueba');
  assert.strictEqual(bien.codigo, 0, `${bien.error}${bien.salida}`);
  const claim = claimDe(e);
  assert.match(claim, /- `src\/ui\/a\.ts#render`\r?\n/);
  assert.match(claim, /- `src\/ui\/b\.ts` — archivo nuevo/);
});
