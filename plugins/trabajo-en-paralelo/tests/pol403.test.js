// POL-403: el CLAIM.md solo cubre archivos que existen en origin/main. Un archivo que main no tiene se crea y se edita
// sin reclamarlo; uno que sí está en main sigue exigiendo zona o compartido. Usan git real (ayudas.js).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const lib = require('../scripts/lib');
const claims = require('../scripts/claims');
const { RAIZ_PLUGIN, git, gitSinLanzar, escribir, crearEscenario, ejecutarParalelo, ejecutarHook } = require('./ayudas');

function conWorktree() {
  const e = crearEscenario();
  const r = ejecutarParalelo(e.daniel, 'iniciar-rama', 'daniel/pol-102-login');
  assert.strictEqual(r.codigo, 0, r.error);
  return { ...e, worktree: e.daniel };
}

function conReclamo(zonas = 'src/ui/') {
  const e = conWorktree();
  const r = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', zonas, '--compartidos', 'package.json', '--confianza', '80', '--responsable', 'Daniel', '--porque', 'Prueba', '--permitir-carpetas');
  assert.strictEqual(r.codigo, 0, `${r.error}${r.salida}`);
  return e;
}

const claimDe = (e) => fs.readFileSync(path.join(e.worktree, 'CLAIM.md'), 'utf8');
const evento = (cwd, archivo) => ({ cwd, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: archivo } });

test('reclamar: una ruta que origin/main no tiene no se reclama (código 2); --nuevos ya no existe; una de main sí', () => {
  const e = conWorktree();
  const inventada = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/a.ts,src/ui/b.ts', '--confianza', '80', '--porque', 'Prueba');
  assert.strictEqual(inventada.codigo, 2);
  assert.match(inventada.error, /no existen en origin\/main: src\/ui\/b\.ts/);
  assert.match(inventada.error, /no se reclama/);
  const conNuevos = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/a.ts', '--nuevos', 'src/ui/b.ts', '--confianza', '80');
  assert.strictEqual(conNuevos.codigo, 2);
  assert.match(conNuevos.error, /--nuevos ya no existe/);
  assert.ok(!fs.existsSync(path.join(e.worktree, 'CLAIM.md')));
  // Un archivo que solo existe en la rama (no en origin/main) tampoco se reclama.
  escribir(e.worktree, 'src/ui/solo-rama.ts', 'x\n');
  git(e.worktree, 'add', 'src/ui/solo-rama.ts');
  git(e.worktree, 'commit', '-q', '-m', 'solo en la rama');
  const soloRama = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/solo-rama.ts', '--confianza', '80');
  assert.strictEqual(soloRama.codigo, 2);
  assert.match(soloRama.error, /no existen en origin\/main: src\/ui\/solo-rama\.ts/);
  const bien = ejecutarParalelo(e.worktree, 'reclamar', '--zonas', 'src/ui/a.ts#render,src/auth/session.ts', '--confianza', '80', '--porque', 'Prueba');
  assert.strictEqual(bien.codigo, 0, `${bien.error}${bien.salida}`);
  assert.doesNotMatch(claimDe(e), /archivo nuevo/);
});

test('limitar-escritura: un archivo que origin/main no tiene se crea y edita sin reclamarlo; uno de main fuera de zona sigue rechazado', () => {
  const e = conReclamo();
  for (const archivo of ['src/otro/nuevo.ts', 'src/modulo-nuevo/a/b.ts', 'src/ui2/c.ts']) {
    const r = ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, archivo)));
    assert.strictEqual(r.codigo, 0, `${archivo}: ${r.error}`);
  }
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, 'src', 'otro', 'x.ts'))).codigo, 2, 'src/otro/x.ts está en main');
  // Existir en la rama o en el árbol de trabajo no cuenta: se mira origin/main.
  escribir(e.worktree, 'src/otro/solo-rama.ts', 'x\n');
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, 'src', 'otro', 'solo-rama.ts'))).codigo, 0);
  // Lo que no cambia: el CLAIM.md a mano, el plugin, la caché y los hooks de git siguen rechazados.
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, 'CLAIM.md'))).codigo, 2);
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(RAIZ_PLUGIN, 'scripts', 'lib.js'))).codigo, 2);
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.daniel, '.git', 'hooks', 'pre-commit'))).codigo, 2);
});

test('limitar-escritura en Cursor: un archivo ausente de origin/main se permite; uno de main fuera de zona se deniega', () => {
  const e = conReclamo();
  const cursor = (archivo) => ({ cwd: e.worktree, hook_event_name: 'preToolUse', tool_name: 'Write', tool_input: { file_path: path.join(e.worktree, archivo) } });
  assert.deepStrictEqual(ejecutarHook('limitar-escritura.js', cursor('src/otro/nuevo.ts'), { cursor: true }).json, { permission: 'allow' });
  assert.strictEqual(ejecutarHook('limitar-escritura.js', cursor('src/otro/x.ts'), { cursor: true }).json.permission, 'deny');
});

test('limitar-escritura: sin origin/main que consultar exige el reclamo como antes', () => {
  const e = conReclamo();
  git(e.worktree, 'update-ref', '-d', 'refs/remotes/origin/main');
  try {
    git(e.worktree, 'symbolic-ref', '--delete', 'refs/remotes/origin/HEAD');
  } catch {
    // Puede no existir.
  }
  const r = ejecutarHook('limitar-escritura.js', evento(e.worktree, path.join(e.worktree, 'src', 'otro', 'nuevo.ts')));
  assert.strictEqual(r.codigo, 2, 'no se puede saber si existe en main: se protege');
});

test('limitar-escritura: la última copia local de origin/main manda; sin fetch, lo que main acaba de recibir se trata como nuevo', () => {
  const e = conReclamo();
  git(e.mauro, 'checkout', '-q', 'main');
  escribir(e.mauro, 'src/otro/recien-llegado.ts', 'x\n');
  git(e.mauro, 'add', '-A');
  git(e.mauro, 'commit', '-q', '-m', 'llega a main');
  git(e.mauro, 'push', '-q', 'origin', 'main');
  const archivo = path.join(e.worktree, 'src', 'otro', 'recien-llegado.ts');
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, archivo)).codigo, 0, 'sin fetch aún no se ve en origin/main');
  git(e.worktree, 'fetch', '-q', 'origin');
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento(e.worktree, archivo)).codigo, 2, 'tras el fetch ya está en origin/main');
});

test('pre-commit: un archivo que origin/main no tiene pasa fuera de zonas; modificar o borrar uno de main fuera de zonas se rechaza', () => {
  const e = conReclamo();
  escribir(e.worktree, 'src/otro/nuevo.ts', 'nuevo\n');
  git(e.worktree, 'add', 'src/otro/nuevo.ts');
  assert.strictEqual(gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'nuevo fuera de zonas').codigo, 0);

  escribir(e.worktree, 'src/otro/x.ts', 'cambio\n');
  git(e.worktree, 'add', 'src/otro/x.ts');
  const modificado = gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'modifica uno de main');
  assert.notStrictEqual(modificado.codigo, 0);
  assert.match(modificado.error, /src\/otro\/x\.ts/);
  git(e.worktree, 'reset', '-q', 'HEAD', 'src/otro/x.ts');
  git(e.worktree, 'checkout', '--', 'src/otro/x.ts');

  git(e.worktree, 'rm', '-q', 'src/otro/fuera.ts');
  const borrado = gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'borra uno de main');
  assert.notStrictEqual(borrado.codigo, 0);
  assert.match(borrado.error, /src\/otro\/fuera\.ts/);
});

test('pre-commit: un renombre de un archivo de main a una ruta nueva se rechaza solo por la ruta vieja', () => {
  const e = conReclamo();
  git(e.worktree, 'mv', 'src/otro/x.ts', 'src/otro/renombrado.ts');
  const r = gitSinLanzar(e.worktree, 'commit', '-q', '-m', 'renombra');
  assert.notStrictEqual(r.codigo, 0);
  assert.match(r.error, /src\/otro\/x\.ts/);
  assert.doesNotMatch(r.error, /renombrado\.ts/);
});

test('ampliar: una ruta que origin/main no tiene no pregunta ni cambia nada; con una de main solo pregunta por esa', async () => {
  const e = conReclamo();
  const repo = lib.infoDelRepo(e.worktree);
  const antes = claimDe(e);
  const sinPreguntar = { confirmar: async () => assert.fail('no debía preguntar') };
  const libre = await claims.ampliar(repo, ['src/otro/nuevo.ts'], sinPreguntar);
  assert.strictEqual(libre.codigo, 0);
  assert.match(libre.mensaje, /no existe\(n\) en origin\/main y esa ruta no se reclama/);
  assert.strictEqual(claimDe(e), antes);

  let pregunta = '';
  const mezcla = await claims.ampliar(repo, ['src/otro/nuevo.ts', 'src/otro/x.ts'], { confirmar: async (texto) => ((pregunta = texto), true) });
  assert.strictEqual(mezcla.codigo, 0, mezcla.mensaje);
  assert.match(pregunta, /con: src\/otro\/x\.ts\./);
  assert.doesNotMatch(pregunta, /nuevo\.ts/);
  assert.match(claimDe(e), /- `src\/otro\/x\.ts` — autorizada/);
  assert.doesNotMatch(claimDe(e), /nuevo\.ts/);
});

test('liberar: lo creado fuera de las zonas que origin/main no tiene no cuenta como fuera de lo reclamado', () => {
  const e = conReclamo();
  escribir(e.worktree, 'src/ui/b.ts', 'b\n');
  escribir(e.worktree, 'src/otro/nuevo.ts', 'n\n');
  git(e.worktree, 'add', '-A');
  git(e.worktree, 'commit', '-q', '-m', 'trabajo');
  assert.match(ejecutarParalelo(e.worktree, 'liberar').salida, /2 de 2 archivos dentro de lo reclamado/);
});
