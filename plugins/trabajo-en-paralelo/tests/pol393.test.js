// Pruebas de POL-393 con git real (ayudas.js): liberar el CLAIM.md antes de crear el PR (CA7, CA8), prefijo de la rama
// según git o Linear y no según el usuario del PC (CA9) y revisión de cambios por descargar antes de trabajar (CA10).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git, gitSinLanzar, escribir, crearEscenario, ejecutarParalelo, ejecutarParaleloConEntorno, ejecutarHook } = require('./ayudas');

const eventoBash = (cwd, comando) => ({ cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: comando } });
const PR = 'gh pr create --title "x" --body "Refs POL-102"';

// Daniel con su rama de ticket y el reclamo ya publicado.
function danielConReclamo() {
  const e = crearEscenario();
  assert.strictEqual(ejecutarParalelo(e.daniel, 'iniciar-rama', 'daniel/pol-102-login').codigo, 0);
  const r = ejecutarParalelo(e.daniel, 'reclamar', '--zonas', 'src/ui/', '--confianza', '80', '--responsable', 'Daniel', '--porque', 'Prueba');
  assert.strictEqual(r.codigo, 0, r.error + r.salida);
  return e;
}

// ---------- CA7 y CA8: el CLAIM.md se libera antes de crear el PR ----------

test('CA7: con el CLAIM.md puesto, gh pr create se bloquea (código 2) y el mensaje dice cómo liberar', () => {
  const e = danielConReclamo();
  const r = ejecutarHook('exigir-claim-liberado.js', eventoBash(e.daniel, PR), { cwd: e.daniel });
  assert.strictEqual(r.codigo, 2);
  assert.match(r.error, /CLAIM\.md/);
  assert.match(r.error, /paralelo\.js"? liberar/);
});

test('CA7: en Cursor responde permission deny con el mismo motivo', () => {
  const e = danielConReclamo();
  const r = ejecutarHook('exigir-claim-liberado.js', { cwd: e.daniel, command: PR }, { cursor: true, cwd: e.daniel });
  assert.strictEqual(r.codigo, 2);
  assert.strictEqual(r.json.permission, 'deny');
  assert.match(r.json.agent_message, /CLAIM\.md/);
});

test('CA7: liberar commitea el borrado y lo publica antes del PR; después gh pr create pasa', () => {
  const e = danielConReclamo();
  const liberar = ejecutarParalelo(e.daniel, 'liberar');
  assert.strictEqual(liberar.codigo, 0, liberar.error + liberar.salida);
  assert.match(git(e.daniel, 'log', '-1', '--format=%s'), /libera el reclamo/);
  assert.ok(!fs.existsSync(path.join(e.daniel, 'CLAIM.md')));
  assert.throws(() => git(e.daniel, 'cat-file', '-e', 'origin/daniel/pol-102-login:CLAIM.md'), 'la rama publicada ya no trae el CLAIM.md');
  const pr = ejecutarHook('exigir-claim-liberado.js', eventoBash(e.daniel, PR), { cwd: e.daniel });
  assert.strictEqual(pr.codigo, 0, pr.error);
});

test('CA7: si el borrado está solo en local y origin todavía trae el CLAIM.md, bloquea hasta publicarlo', () => {
  const e = danielConReclamo();
  git(e.daniel, 'rm', '-q', 'CLAIM.md');
  assert.strictEqual(gitSinLanzar(e.daniel, '-c', 'user.name=Prueba', '-c', 'user.email=prueba@polaria.tech', 'commit', '-q', '--no-verify', '-m', 'borra el claim').codigo, 0);
  const antes = ejecutarHook('exigir-claim-liberado.js', eventoBash(e.daniel, PR), { cwd: e.daniel });
  assert.strictEqual(antes.codigo, 2);
  assert.match(antes.error, /origin\/daniel\/pol-102-login/);
  git(e.daniel, 'push', '-q', 'origin', 'daniel/pol-102-login');
  const despues = ejecutarHook('exigir-claim-liberado.js', eventoBash(e.daniel, PR), { cwd: e.daniel });
  assert.strictEqual(despues.codigo, 0, despues.error);
});

test('CA8: un push intermedio con el reclamo puesto pasa y conserva el CLAIM.md', () => {
  const e = danielConReclamo();
  escribir(e.daniel, 'src/ui/b.ts', 'b\n');
  git(e.daniel, 'add', 'src/ui/b.ts');
  git(e.daniel, 'commit', '-q', '-m', 'avance');
  const r = ejecutarHook('exigir-claim-liberado.js', eventoBash(e.daniel, 'git push origin daniel/pol-102-login'), { cwd: e.daniel });
  assert.strictEqual(r.codigo, 0, r.error);
  git(e.daniel, 'push', '-q', 'origin', 'daniel/pol-102-login');
  assert.ok(fs.existsSync(path.join(e.daniel, 'CLAIM.md')), 'el reclamo sigue puesto');
});

test('CA8: nombrar gh pr create dentro de un echo o de un mensaje de commit no cuenta como crear un PR', () => {
  const e = danielConReclamo();
  for (const comando of ['echo "gh pr create"', 'git commit -m "documenta gh pr create"', 'gh pr view 7', 'gh pr list']) {
    assert.strictEqual(ejecutarHook('exigir-claim-liberado.js', eventoBash(e.daniel, comando), { cwd: e.daniel }).codigo, 0, comando);
  }
});

test('CA8: una rama sin CLAIM.md deja crear el PR, también con variables de entorno o encadenado', () => {
  const e = crearEscenario();
  assert.strictEqual(ejecutarParalelo(e.daniel, 'iniciar-rama', 'daniel/pol-102-login').codigo, 0);
  for (const comando of [PR, `GH_TOKEN=x ${PR}`, `git push -u origin HEAD && ${PR}`]) {
    assert.strictEqual(ejecutarHook('exigir-claim-liberado.js', eventoBash(e.daniel, comando), { cwd: e.daniel }).codigo, 0, comando);
  }
});

test('liberar --volver cuando el reclamo ya se liberó antes del PR solo vuelve a la rama principal', () => {
  const e = danielConReclamo();
  assert.strictEqual(ejecutarParalelo(e.daniel, 'liberar').codigo, 0);
  const r = ejecutarParalelo(e.daniel, 'liberar', '--volver');
  assert.strictEqual(r.codigo, 0, r.error + r.salida);
  assert.match(r.salida, /ya estaba liberado/);
  assert.strictEqual(git(e.daniel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
});

// ---------- CA9: prefijo de la rama ----------

// El usuario del PC es "daniel" (como en la rama de Lucho) y nada debe usarlo.
const USUARIO_DEL_PC = { USERNAME: 'daniel', USER: 'daniel', LOGNAME: 'daniel' };

test('CA9: el prefijo sale del nombre en git ("Lucho") y no del usuario del PC ("daniel")', () => {
  const e = crearEscenario();
  git(e.daniel, 'config', 'user.name', 'Lucho');
  const r = ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'prefijo');
  assert.strictEqual(r.codigo, 0, r.error);
  assert.strictEqual(r.salida.trim(), 'lucho');
});

test('CA9: un nombre completo de git se convierte a su prefijo (Daniel De Jesus Galvis Zambrano -> dani, tildes incluidas)', () => {
  const e = crearEscenario();
  git(e.daniel, 'config', 'user.name', 'Daniel De Jesus Galvis Zambrano');
  assert.strictEqual(ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'prefijo').salida.trim(), 'dani');
  git(e.daniel, 'config', 'user.name', 'MAURO');
  assert.strictEqual(ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'prefijo').salida.trim(), 'mauro');
});

test('CA9: con user.name vacío usa el nombre de Linear', () => {
  const e = crearEscenario();
  const r = ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'prefijo', '--linear', 'Mauro');
  assert.strictEqual(r.codigo, 0, r.error);
  assert.strictEqual(r.salida.trim(), 'mauro');
});

test('CA9: un nombre de git que no está en la tabla pasa al nombre de Linear', () => {
  const e = crearEscenario();
  git(e.daniel, 'config', 'user.name', 'Prueba');
  assert.strictEqual(ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'prefijo', '--linear', 'Lucho').salida.trim(), 'lucho');
});

test('CA9: sin ningún nombre reconocido sale con código 8 y no usa el usuario del PC', () => {
  const e = crearEscenario();
  const r = ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'prefijo');
  assert.strictEqual(r.codigo, 8);
  assert.doesNotMatch(r.salida, /daniel/);
  assert.match(r.error, /user\.name/);
  const noReconocido = ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'prefijo', '--linear', 'Alguien Nuevo');
  assert.strictEqual(noReconocido.codigo, 8);
  assert.match(noReconocido.error, /prefijos\.json/);
});

test('CA9: iniciar-rama de un REQ-NNN con el prefijo del PC se rechaza (código 8) y no cambia de rama', () => {
  const e = crearEscenario();
  git(e.daniel, 'config', 'user.name', 'Lucho');
  const r = ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'daniel/req-172-occ-po-largas');
  assert.strictEqual(r.codigo, 8);
  assert.match(r.error, /debe empezar con "lucho\/"/);
  assert.strictEqual(git(e.daniel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  const bien = ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'lucho/req-172-occ-po-largas');
  assert.strictEqual(bien.codigo, 0, bien.error);
  assert.strictEqual(git(e.daniel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'lucho/req-172-occ-po-largas');
});

test('CA9: iniciar-rama de un REQ-NNN sin ningún nombre no crea la rama (código 8)', () => {
  const e = crearEscenario();
  const r = ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'daniel/req-172-occ-po-largas');
  assert.strictEqual(r.codigo, 8);
  assert.strictEqual(git(e.daniel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
});

test('CA9: los POL-X conservan el nombre de rama que sugiere Linear y una rama que ya existía se reutiliza', () => {
  const e = crearEscenario();
  assert.strictEqual(ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'dani/pol-393-algo').codigo, 0);
  git(e.daniel, 'switch', '-q', 'main');
  git(e.daniel, 'branch', 'daniel/req-001-vieja');
  assert.strictEqual(ejecutarParaleloConEntorno(e.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'daniel/req-001-vieja').codigo, 0);
});

// ---------- CA10: cambios por descargar antes de trabajar ----------

// Mauro publica N commits nuevos en main.
function mauroAvanzaMain(e, cantidad = 2) {
  git(e.mauro, 'checkout', '-q', 'main');
  for (let i = 1; i <= cantidad; i += 1) {
    escribir(e.mauro, `src/nuevo${i}.ts`, `nuevo ${i}\n`);
    git(e.mauro, 'add', '-A');
    git(e.mauro, 'commit', '-q', '-m', `nuevo ${i}`);
  }
  git(e.mauro, 'push', '-q', 'origin', 'main');
}

const contexto = (r) => (r.json && ((r.json.hookSpecificOutput && r.json.hookSpecificOutput.additionalContext) || r.json.additional_context)) || '';

test('CA10: con commits nuevos y árbol limpio, al iniciar la sesión descarga con --ff-only y lo avisa', () => {
  const e = crearEscenario();
  mauroAvanzaMain(e, 2);
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.daniel, hook_event_name: 'SessionStart' }, { cwd: e.daniel });
  assert.strictEqual(r.codigo, 0);
  assert.match(contexto(r), /2 commits descargados/);
  assert.strictEqual(git(e.daniel, 'rev-parse', 'HEAD'), git(e.mauro, 'rev-parse', 'HEAD'));
  assert.ok(fs.existsSync(path.join(e.daniel, 'src', 'nuevo2.ts')));
});

test('CA10: en Cursor entrega el aviso como additional_context', () => {
  const e = crearEscenario();
  mauroAvanzaMain(e, 1);
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.daniel, hook_event_name: 'sessionStart' }, { cursor: true, cwd: e.daniel });
  assert.match(r.json.additional_context, /1 commit descargado/);
});

test('CA10: con un archivo modificado sin guardar no descarga nada y avisa que está atrás por 2 commits', () => {
  const e = crearEscenario();
  mauroAvanzaMain(e, 2);
  escribir(e.daniel, 'src/ui/a.ts', 'cambio local sin guardar\n');
  const antes = git(e.daniel, 'rev-parse', 'HEAD');
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.daniel, hook_event_name: 'SessionStart' }, { cwd: e.daniel });
  assert.strictEqual(r.codigo, 0);
  assert.match(contexto(r), /atrás por 2 commits/);
  assert.strictEqual(git(e.daniel, 'rev-parse', 'HEAD'), antes);
  assert.strictEqual(fs.readFileSync(path.join(e.daniel, 'src', 'ui', 'a.ts'), 'utf8'), 'cambio local sin guardar\n');
});

test('CA10: si la rama divergió de la remota avisa y no toca nada', () => {
  const e = crearEscenario();
  mauroAvanzaMain(e, 1);
  escribir(e.daniel, 'src/propio.ts', 'mío\n');
  git(e.daniel, 'add', '-A');
  git(e.daniel, 'commit', '-q', '-m', 'mío');
  const antes = git(e.daniel, 'rev-parse', 'HEAD');
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.daniel, hook_event_name: 'SessionStart' }, { cwd: e.daniel });
  assert.match(contexto(r), /divergieron/);
  assert.strictEqual(git(e.daniel, 'rev-parse', 'HEAD'), antes);
});

test('CA10: con el remoto inaccesible avisa que no pudo comprobar y deja trabajar (código 0)', () => {
  const e = crearEscenario();
  git(e.daniel, 'remote', 'set-url', 'origin', path.join(e.carpeta, 'no-existe.git'));
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.daniel, hook_event_name: 'SessionStart' }, { cwd: e.daniel });
  assert.strictEqual(r.codigo, 0);
  assert.match(contexto(r), /no pude comprobar/);
});

test('CA10: sin nada por descargar el hook de inicio no dice nada', () => {
  const e = crearEscenario();
  const r = ejecutarHook('al-iniciar-sesion.js', { cwd: e.daniel, hook_event_name: 'SessionStart' }, { cwd: e.daniel });
  assert.strictEqual(r.codigo, 0);
  assert.strictEqual(r.salida, '');
});

test('CA10: en una rama de ticket avisa si la principal avanzó, sin integrarla', () => {
  const e = crearEscenario();
  assert.strictEqual(ejecutarParalelo(e.daniel, 'iniciar-rama', 'daniel/pol-102-login').codigo, 0);
  mauroAvanzaMain(e, 2);
  const antes = git(e.daniel, 'rev-parse', 'HEAD');
  const r = ejecutarParalelo(e.daniel, 'sincronizar');
  assert.strictEqual(r.codigo, 0, r.error);
  assert.match(r.salida, /origin\/main tiene 2 commits que daniel\/pol-102-login no tiene/);
  assert.strictEqual(git(e.daniel, 'rev-parse', 'HEAD'), antes);
});

test('CA10: sincronizar a mano descarga y, al día, lo dice', () => {
  const e = crearEscenario();
  mauroAvanzaMain(e, 1);
  assert.match(ejecutarParalelo(e.daniel, 'sincronizar').salida, /1 commit descargado/);
  assert.match(ejecutarParalelo(e.daniel, 'sincronizar').salida, /al día/);
});

test('CA10: iniciar-rama de una rama que ya existía y está atrás de su remota la descarga antes de empezar', () => {
  const e = crearEscenario();
  assert.strictEqual(ejecutarParalelo(e.daniel, 'iniciar-rama', 'daniel/pol-102-login').codigo, 0);
  escribir(e.daniel, 'src/ui/b.ts', 'b\n');
  git(e.daniel, 'add', '-A');
  git(e.daniel, 'commit', '-q', '-m', 'b');
  git(e.daniel, 'push', '-q', '-u', 'origin', 'daniel/pol-102-login');
  // Otro clon (Mauro) publica un commit más en la misma rama; Daniel se va a main y la retoma.
  git(e.mauro, 'fetch', '-q', 'origin');
  git(e.mauro, 'checkout', '-q', '-B', 'daniel/pol-102-login', 'origin/daniel/pol-102-login');
  escribir(e.mauro, 'src/ui/c.ts', 'c\n');
  git(e.mauro, 'add', '-A');
  git(e.mauro, 'commit', '-q', '-m', 'c');
  git(e.mauro, 'push', '-q', 'origin', 'daniel/pol-102-login');
  git(e.daniel, 'switch', '-q', 'main');
  const r = ejecutarParalelo(e.daniel, 'iniciar-rama', 'daniel/pol-102-login');
  assert.strictEqual(r.codigo, 0, r.error);
  assert.match(r.salida, /1 commit descargado/);
  assert.ok(fs.existsSync(path.join(e.daniel, 'src', 'ui', 'c.ts')));
});
