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
  const escenario = crearEscenario();
  assert.strictEqual(ejecutarParalelo(escenario.daniel, 'iniciar-rama', 'daniel/pol-102-login').codigo, 0);
  const resultado = ejecutarParalelo(escenario.daniel, 'reclamar', '--zonas', 'src/ui/', '--confianza', '80', '--responsable', 'Daniel', '--porque', 'Prueba');
  assert.strictEqual(resultado.codigo, 0, resultado.error + resultado.salida);
  return escenario;
}

// ---------- CA7 y CA8: el CLAIM.md se libera antes de crear el PR ----------

test('CA7: con el CLAIM.md puesto, gh pr create se bloquea (código 2) y el mensaje dice cómo liberar', () => {
  const escenario = danielConReclamo();
  const resultado = ejecutarHook('exigir-claim-liberado.js', eventoBash(escenario.daniel, PR), { cwd: escenario.daniel });
  assert.strictEqual(resultado.codigo, 2);
  assert.match(resultado.error, /CLAIM\.md/);
  assert.match(resultado.error, /paralelo\.js"? liberar/);
});

test('CA7: en Cursor responde permission deny con el mismo motivo', () => {
  const escenario = danielConReclamo();
  const resultado = ejecutarHook('exigir-claim-liberado.js', { cwd: escenario.daniel, command: PR }, { cursor: true, cwd: escenario.daniel });
  assert.strictEqual(resultado.codigo, 2);
  assert.strictEqual(resultado.json.permission, 'deny');
  assert.match(resultado.json.agent_message, /CLAIM\.md/);
});

test('CA7: liberar commitea el borrado y lo publica antes del PR; después gh pr create pasa', () => {
  const escenario = danielConReclamo();
  const liberar = ejecutarParalelo(escenario.daniel, 'liberar');
  assert.strictEqual(liberar.codigo, 0, liberar.error + liberar.salida);
  assert.match(git(escenario.daniel, 'log', '-1', '--format=%s'), /libera el reclamo/);
  assert.ok(!fs.existsSync(path.join(escenario.daniel, 'CLAIM.md')));
  assert.throws(() => git(escenario.daniel, 'cat-file', '-e', 'origin/daniel/pol-102-login:CLAIM.md'), 'la rama publicada ya no trae el CLAIM.md');
  const pr = ejecutarHook('exigir-claim-liberado.js', eventoBash(escenario.daniel, PR), { cwd: escenario.daniel });
  assert.strictEqual(pr.codigo, 0, pr.error);
});

test('CA7: si el borrado está solo en local y origin todavía trae el CLAIM.md, bloquea hasta publicarlo', () => {
  const escenario = danielConReclamo();
  git(escenario.daniel, 'rm', '-q', 'CLAIM.md');
  assert.strictEqual(gitSinLanzar(escenario.daniel, '-c', 'user.name=Prueba', '-c', 'user.email=prueba@polaria.tech', 'commit', '-q', '--no-verify', '-m', 'borra el claim').codigo, 0);
  const antes = ejecutarHook('exigir-claim-liberado.js', eventoBash(escenario.daniel, PR), { cwd: escenario.daniel });
  assert.strictEqual(antes.codigo, 2);
  assert.match(antes.error, /origin\/daniel\/pol-102-login/);
  git(escenario.daniel, 'push', '-q', 'origin', 'daniel/pol-102-login');
  const despues = ejecutarHook('exigir-claim-liberado.js', eventoBash(escenario.daniel, PR), { cwd: escenario.daniel });
  assert.strictEqual(despues.codigo, 0, despues.error);
});

test('CA8: un push intermedio con el reclamo puesto pasa y conserva el CLAIM.md', () => {
  const escenario = danielConReclamo();
  escribir(escenario.daniel, 'src/ui/b.ts', 'b\n');
  git(escenario.daniel, 'add', 'src/ui/b.ts');
  git(escenario.daniel, 'commit', '-q', '-m', 'avance');
  const resultado = ejecutarHook('exigir-claim-liberado.js', eventoBash(escenario.daniel, 'git push origin daniel/pol-102-login'), { cwd: escenario.daniel });
  assert.strictEqual(resultado.codigo, 0, resultado.error);
  git(escenario.daniel, 'push', '-q', 'origin', 'daniel/pol-102-login');
  assert.ok(fs.existsSync(path.join(escenario.daniel, 'CLAIM.md')), 'el reclamo sigue puesto');
});

test('CA8: nombrar gh pr create dentro de un echo o de un mensaje de commit no cuenta como crear un PR', () => {
  const escenario = danielConReclamo();
  for (const comando of ['echo "gh pr create"', 'git commit -m "documenta gh pr create"', 'gh pr view 7', 'gh pr list']) {
    assert.strictEqual(ejecutarHook('exigir-claim-liberado.js', eventoBash(escenario.daniel, comando), { cwd: escenario.daniel }).codigo, 0, comando);
  }
});

test('CA8: una rama sin CLAIM.md deja crear el PR, también con variables de entorno o encadenado', () => {
  const escenario = crearEscenario();
  assert.strictEqual(ejecutarParalelo(escenario.daniel, 'iniciar-rama', 'daniel/pol-102-login').codigo, 0);
  for (const comando of [PR, `GH_TOKEN=x ${PR}`, `git push -u origin HEAD && ${PR}`]) {
    assert.strictEqual(ejecutarHook('exigir-claim-liberado.js', eventoBash(escenario.daniel, comando), { cwd: escenario.daniel }).codigo, 0, comando);
  }
});

test('liberar --volver cuando el reclamo ya se liberó antes del PR solo vuelve a la rama principal', () => {
  const escenario = danielConReclamo();
  assert.strictEqual(ejecutarParalelo(escenario.daniel, 'liberar').codigo, 0);
  const resultado = ejecutarParalelo(escenario.daniel, 'liberar', '--volver');
  assert.strictEqual(resultado.codigo, 0, resultado.error + resultado.salida);
  assert.match(resultado.salida, /ya estaba liberado/);
  assert.strictEqual(git(escenario.daniel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
});

// ---------- CA9: prefijo de la rama ----------

// El usuario del PC es "daniel" (como en la rama de Lucho) y nada debe usarlo.
const USUARIO_DEL_PC = { USERNAME: 'daniel', USER: 'daniel', LOGNAME: 'daniel' };

test('CA9: el prefijo sale del nombre en git ("Lucho") y no del usuario del PC ("daniel")', () => {
  const escenario = crearEscenario();
  git(escenario.daniel, 'config', 'user.name', 'Lucho');
  const resultado = ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'prefijo');
  assert.strictEqual(resultado.codigo, 0, resultado.error);
  assert.strictEqual(resultado.salida.trim(), 'lucho');
});

test('CA9: un nombre completo de git se convierte a su prefijo (Daniel De Jesus Galvis Zambrano -> dani, tildes incluidas)', () => {
  const escenario = crearEscenario();
  git(escenario.daniel, 'config', 'user.name', 'Daniel De Jesus Galvis Zambrano');
  assert.strictEqual(ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'prefijo').salida.trim(), 'dani');
  git(escenario.daniel, 'config', 'user.name', 'MAURO');
  assert.strictEqual(ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'prefijo').salida.trim(), 'mauro');
});

test('CA9: con user.name vacío usa el nombre de Linear', () => {
  const escenario = crearEscenario();
  const resultado = ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'prefijo', '--linear', 'Mauro');
  assert.strictEqual(resultado.codigo, 0, resultado.error);
  assert.strictEqual(resultado.salida.trim(), 'mauro');
});

test('CA9: un nombre de git que no está en la tabla pasa al nombre de Linear', () => {
  const escenario = crearEscenario();
  git(escenario.daniel, 'config', 'user.name', 'Prueba');
  assert.strictEqual(ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'prefijo', '--linear', 'Lucho').salida.trim(), 'lucho');
});

test('CA9: sin ningún nombre reconocido sale con código 8 y no usa el usuario del PC', () => {
  const escenario = crearEscenario();
  const resultado = ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'prefijo');
  assert.strictEqual(resultado.codigo, 8);
  assert.doesNotMatch(resultado.salida, /daniel/);
  assert.match(resultado.error, /user\.name/);
  const noReconocido = ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'prefijo', '--linear', 'Alguien Nuevo');
  assert.strictEqual(noReconocido.codigo, 8);
  assert.match(noReconocido.error, /prefijos\.json/);
});

test('CA9: iniciar-rama de un REQ-NNN con el prefijo del PC se rechaza (código 8) y no cambia de rama', () => {
  const escenario = crearEscenario();
  git(escenario.daniel, 'config', 'user.name', 'Lucho');
  const resultado = ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'daniel/req-172-occ-po-largas');
  assert.strictEqual(resultado.codigo, 8);
  assert.match(resultado.error, /debe empezar con "lucho\/"/);
  assert.strictEqual(git(escenario.daniel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  const bien = ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'lucho/req-172-occ-po-largas');
  assert.strictEqual(bien.codigo, 0, bien.error);
  assert.strictEqual(git(escenario.daniel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'lucho/req-172-occ-po-largas');
});

test('CA9: iniciar-rama de un REQ-NNN sin ningún nombre no crea la rama (código 8)', () => {
  const escenario = crearEscenario();
  const resultado = ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'daniel/req-172-occ-po-largas');
  assert.strictEqual(resultado.codigo, 8);
  assert.strictEqual(git(escenario.daniel, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
});

test('CA9: los POL-X conservan el nombre de rama que sugiere Linear y una rama que ya existía se reutiliza', () => {
  const escenario = crearEscenario();
  assert.strictEqual(ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'dani/pol-393-algo').codigo, 0);
  git(escenario.daniel, 'switch', '-q', 'main');
  git(escenario.daniel, 'branch', 'daniel/req-001-vieja');
  assert.strictEqual(ejecutarParaleloConEntorno(escenario.daniel, USUARIO_DEL_PC, 'iniciar-rama', 'daniel/req-001-vieja').codigo, 0);
});

// ---------- CA10: cambios por descargar antes de trabajar ----------

// Mauro publica N commits nuevos en main.
function mauroAvanzaMain(escenario, cantidad = 2) {
  git(escenario.mauro, 'checkout', '-q', 'main');
  for (let i = 1; i <= cantidad; i += 1) {
    escribir(escenario.mauro, `src/nuevo${i}.ts`, `nuevo ${i}\n`);
    git(escenario.mauro, 'add', '-A');
    git(escenario.mauro, 'commit', '-q', '-m', `nuevo ${i}`);
  }
  git(escenario.mauro, 'push', '-q', 'origin', 'main');
}

const contexto = (resultado) => (resultado.json && ((resultado.json.hookSpecificOutput && resultado.json.hookSpecificOutput.additionalContext) || resultado.json.additional_context)) || '';

test('CA10: con commits nuevos y árbol limpio, al iniciar la sesión descarga con --ff-only y lo avisa', () => {
  const escenario = crearEscenario();
  mauroAvanzaMain(escenario, 2);
  const resultado = ejecutarHook('al-iniciar-sesion.js', { cwd: escenario.daniel, hook_event_name: 'SessionStart' }, { cwd: escenario.daniel });
  assert.strictEqual(resultado.codigo, 0);
  assert.match(contexto(resultado), /2 commits descargados/);
  assert.strictEqual(git(escenario.daniel, 'rev-parse', 'HEAD'), git(escenario.mauro, 'rev-parse', 'HEAD'));
  assert.ok(fs.existsSync(path.join(escenario.daniel, 'src', 'nuevo2.ts')));
});

test('CA10: en Cursor entrega el aviso como additional_context', () => {
  const escenario = crearEscenario();
  mauroAvanzaMain(escenario, 1);
  const resultado = ejecutarHook('al-iniciar-sesion.js', { cwd: escenario.daniel, hook_event_name: 'sessionStart' }, { cursor: true, cwd: escenario.daniel });
  assert.match(resultado.json.additional_context, /1 commit descargado/);
});

test('CA10: con un archivo modificado sin guardar no descarga nada y avisa que está atrás por 2 commits', () => {
  const escenario = crearEscenario();
  mauroAvanzaMain(escenario, 2);
  escribir(escenario.daniel, 'src/ui/a.ts', 'cambio local sin guardar\n');
  const antes = git(escenario.daniel, 'rev-parse', 'HEAD');
  const resultado = ejecutarHook('al-iniciar-sesion.js', { cwd: escenario.daniel, hook_event_name: 'SessionStart' }, { cwd: escenario.daniel });
  assert.strictEqual(resultado.codigo, 0);
  assert.match(contexto(resultado), /atrás por 2 commits/);
  assert.strictEqual(git(escenario.daniel, 'rev-parse', 'HEAD'), antes);
  assert.strictEqual(fs.readFileSync(path.join(escenario.daniel, 'src', 'ui', 'a.ts'), 'utf8'), 'cambio local sin guardar\n');
});

test('CA10: si la rama divergió de la remota avisa y no toca nada', () => {
  const escenario = crearEscenario();
  mauroAvanzaMain(escenario, 1);
  escribir(escenario.daniel, 'src/propio.ts', 'mío\n');
  git(escenario.daniel, 'add', '-A');
  git(escenario.daniel, 'commit', '-q', '-m', 'mío');
  const antes = git(escenario.daniel, 'rev-parse', 'HEAD');
  const resultado = ejecutarHook('al-iniciar-sesion.js', { cwd: escenario.daniel, hook_event_name: 'SessionStart' }, { cwd: escenario.daniel });
  assert.match(contexto(resultado), /divergieron/);
  assert.strictEqual(git(escenario.daniel, 'rev-parse', 'HEAD'), antes);
});

test('CA10: con el remoto inaccesible avisa que no pudo comprobar y deja trabajar (código 0)', () => {
  const escenario = crearEscenario();
  git(escenario.daniel, 'remote', 'set-url', 'origin', path.join(escenario.carpeta, 'no-existe.git'));
  const resultado = ejecutarHook('al-iniciar-sesion.js', { cwd: escenario.daniel, hook_event_name: 'SessionStart' }, { cwd: escenario.daniel });
  assert.strictEqual(resultado.codigo, 0);
  assert.match(contexto(resultado), /no pude comprobar/);
});

test('CA10: sin nada por descargar el hook de inicio no dice nada', () => {
  const escenario = crearEscenario();
  const resultado = ejecutarHook('al-iniciar-sesion.js', { cwd: escenario.daniel, hook_event_name: 'SessionStart' }, { cwd: escenario.daniel });
  assert.strictEqual(resultado.codigo, 0);
  assert.strictEqual(resultado.salida, '');
});

test('CA10: en una rama de ticket avisa si la principal avanzó, sin integrarla', () => {
  const escenario = crearEscenario();
  assert.strictEqual(ejecutarParalelo(escenario.daniel, 'iniciar-rama', 'daniel/pol-102-login').codigo, 0);
  mauroAvanzaMain(escenario, 2);
  const antes = git(escenario.daniel, 'rev-parse', 'HEAD');
  const resultado = ejecutarParalelo(escenario.daniel, 'sincronizar');
  assert.strictEqual(resultado.codigo, 0, resultado.error);
  assert.match(resultado.salida, /origin\/main tiene 2 commits que daniel\/pol-102-login no tiene/);
  assert.strictEqual(git(escenario.daniel, 'rev-parse', 'HEAD'), antes);
});

test('CA10: sincronizar a mano descarga y, al día, lo dice', () => {
  const escenario = crearEscenario();
  mauroAvanzaMain(escenario, 1);
  assert.match(ejecutarParalelo(escenario.daniel, 'sincronizar').salida, /1 commit descargado/);
  assert.match(ejecutarParalelo(escenario.daniel, 'sincronizar').salida, /al día/);
});

test('CA10: iniciar-rama de una rama que ya existía y está atrás de su remota la descarga antes de empezar', () => {
  const escenario = crearEscenario();
  assert.strictEqual(ejecutarParalelo(escenario.daniel, 'iniciar-rama', 'daniel/pol-102-login').codigo, 0);
  escribir(escenario.daniel, 'src/ui/b.ts', 'b\n');
  git(escenario.daniel, 'add', '-A');
  git(escenario.daniel, 'commit', '-q', '-m', 'b');
  git(escenario.daniel, 'push', '-q', '-u', 'origin', 'daniel/pol-102-login');
  // Otro clon (Mauro) publica un commit más en la misma rama; Daniel se va a main y la retoma.
  git(escenario.mauro, 'fetch', '-q', 'origin');
  git(escenario.mauro, 'checkout', '-q', '-B', 'daniel/pol-102-login', 'origin/daniel/pol-102-login');
  escribir(escenario.mauro, 'src/ui/c.ts', 'c\n');
  git(escenario.mauro, 'add', '-A');
  git(escenario.mauro, 'commit', '-q', '-m', 'c');
  git(escenario.mauro, 'push', '-q', 'origin', 'daniel/pol-102-login');
  git(escenario.daniel, 'switch', '-q', 'main');
  const resultado = ejecutarParalelo(escenario.daniel, 'iniciar-rama', 'daniel/pol-102-login');
  assert.strictEqual(resultado.codigo, 0, resultado.error);
  assert.match(resultado.salida, /1 commit descargado/);
  assert.ok(fs.existsSync(path.join(escenario.daniel, 'src', 'ui', 'c.ts')));
});
