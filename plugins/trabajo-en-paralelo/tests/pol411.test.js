// POL-411: detectar PR abiertos que tocan las zonas del ticket y apilar la rama sobre el PR padre. Usan git real
// (ayudas.js) y un gh simulado (POLARIA_PARALELO_GH apunta a un .js que imprime los PR de la prueba).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git, gitSinLanzar, escribir, crearEscenario, ejecutarParalelo, ejecutarParaleloConEntorno, ejecutarHook, mauroPublicaClaim } = require('./ayudas');

const PADRE = 'mauro/pol-101-auth';
const HIJA = 'daniel/pol-102-login';

// Crea un gh falso que imprime siempre `prs` y devuelve el entorno para usarlo.
function ghFalso(prs) {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-falso-'));
  const archivo = path.join(carpeta, 'gh.js');
  fs.writeFileSync(archivo, `process.stdout.write(${JSON.stringify(JSON.stringify(prs))});\n`);
  return { POLARIA_PARALELO_GH: archivo };
}

const PR_DE_MAURO = { number: 7, headRefName: PADRE, baseRefName: 'main', files: [{ path: 'src/ui/a.ts' }, { path: 'src/auth/session.ts' }] };
const PR_AJENO = { number: 9, headRefName: 'lucho/pol-200-otro', baseRefName: 'main', files: [{ path: 'docs/x.md' }] };

// Mauro tiene su PR abierto: su rama trae un archivo nuevo (src/ui/nuevo.ts) que main no tiene y todavía un CLAIM.md.
function conPadreConArchivoNuevo() {
  const e = crearEscenario();
  mauroPublicaClaim(e);
  escribir(e.mauro, 'src/ui/nuevo.ts', 'nuevo\n');
  git(e.mauro, 'add', 'src/ui/nuevo.ts');
  git(e.mauro, 'commit', '-q', '-m', 'archivo nuevo del padre');
  git(e.mauro, 'push', '-q', 'origin', PADRE);
  return e;
}

test('prs-abiertos: lista el PR que toca las zonas y ofrece apilar o esperar; ignora los que no tocan nada (CA1)', () => {
  const e = crearEscenario();
  const entorno = ghFalso([PR_DE_MAURO, PR_AJENO]);
  const r = ejecutarParaleloConEntorno(e.daniel, entorno, 'prs-abiertos', '--zonas', 'src/ui/a.ts,src/otro/x.ts', '--issue', 'POL-102');
  assert.strictEqual(r.codigo, 0, r.error);
  assert.match(r.salida, /PR ABIERTO #7 \(rama mauro\/pol-101-auth, base main\) toca: `src\/ui\/a\.ts`/);
  assert.doesNotMatch(r.salida, /#9/);
  assert.match(r.salida, /1\. Apilar: .*iniciar-rama <rama> --base mauro\/pol-101-auth/);
  assert.match(r.salida, /2\. Esperar el merge de #7/);
  assert.match(r.salida, /Reapuntado automático.*: no\./);
  assert.match(r.salida, /NO recomendado/);
});

test('prs-abiertos: una zona de carpeta también cruza; sin solape o con el PR del mismo ticket no dice nada que cambie el flujo', () => {
  const e = crearEscenario();
  const entorno = ghFalso([PR_DE_MAURO, PR_AJENO]);
  assert.match(ejecutarParaleloConEntorno(e.daniel, entorno, 'prs-abiertos', '--zonas', 'src/auth/', '--issue', 'POL-102').salida, /PR ABIERTO #7/);
  const sinSolape = ejecutarParaleloConEntorno(e.daniel, entorno, 'prs-abiertos', '--zonas', 'src/afuera/c.ts', '--issue', 'POL-102');
  assert.strictEqual(sinSolape.codigo, 0);
  assert.match(sinSolape.salida, /Sin PR abiertos que toquen tus archivos/);
  const mismoTicket = ejecutarParaleloConEntorno(e.daniel, entorno, 'prs-abiertos', '--zonas', 'src/ui/a.ts', '--issue', 'POL-101');
  assert.match(mismoTicket.salida, /Sin PR abiertos/);
});

test('prs-abiertos: si el repo tiene el workflow de reapuntado lo dice y no desaconseja apilar', () => {
  const e = crearEscenario();
  escribir(e.daniel, '.github/workflows/auto-rebase-stacked-prs.yml', 'name: auto-rebase\n');
  git(e.daniel, 'add', '-A');
  git(e.daniel, 'commit', '-q', '-m', 'workflow');
  git(e.daniel, 'push', '-q', 'origin', 'main');
  const r = ejecutarParaleloConEntorno(e.daniel, ghFalso([PR_DE_MAURO]), 'prs-abiertos', '--zonas', 'src/ui/a.ts', '--issue', 'POL-102');
  assert.match(r.salida, /Reapuntado automático.*: sí\./);
  assert.doesNotMatch(r.salida, /NO recomendado/);
});

test('prs-abiertos: sin gh o sin sesión avisa en una línea y sale con 0 (CA3, R4)', () => {
  const e = crearEscenario();
  const r = ejecutarParaleloConEntorno(e.daniel, { POLARIA_PARALELO_GH: path.join(e.carpeta, 'no-existe.js') }, 'prs-abiertos', '--zonas', 'src/ui/a.ts');
  assert.strictEqual(r.codigo, 0);
  assert.match(r.salida, /^AVISO: no pude consultar los PR abiertos/);
  assert.strictEqual(r.salida.trim().split('\n').length, 1);
  assert.strictEqual(ejecutarParalelo(e.daniel, 'prs-abiertos').codigo, 2, 'sin --zonas es un error de uso');
});

test('iniciar-rama --base: la hija sale del padre, no trae su CLAIM.md y reclama el archivo que solo existe en el padre (CA2, R2, R3)', () => {
  const e = conPadreConArchivoNuevo();
  const r = ejecutarParalelo(e.daniel, 'iniciar-rama', HIJA, '--base', PADRE);
  assert.strictEqual(r.codigo, 0, r.error);
  assert.match(r.salida, /desde origin\/mauro\/pol-101-auth/);
  assert.match(r.salida, /Se quitó el CLAIM\.md heredado/);
  assert.strictEqual(git(e.daniel, 'ls-files', 'CLAIM.md'), '', 'la hija no trae el CLAIM.md del padre');
  assert.strictEqual(git(e.daniel, 'config', '--get', `branch.${HIJA}.polaria-base`), PADRE);
  assert.ok(fs.existsSync(path.join(e.daniel, 'src/ui/nuevo.ts')), 'la hija parte del trabajo del padre');
  const reclamo = ejecutarParalelo(e.daniel, 'reclamar', '--zonas', 'src/ui/nuevo.ts,src/otro/x.ts', '--confianza', '80', '--porque', 'Prueba');
  assert.strictEqual(reclamo.codigo, 0, `${reclamo.error}${reclamo.salida}`);
  assert.match(fs.readFileSync(path.join(e.daniel, 'CLAIM.md'), 'utf8'), /src\/ui\/nuevo\.ts/);
});

test('iniciar-rama sin --base: el archivo que solo existe en el PR de otro sigue sin poder reclamarse (el comportamiento de siempre)', () => {
  const e = conPadreConArchivoNuevo();
  assert.strictEqual(ejecutarParalelo(e.daniel, 'iniciar-rama', HIJA).codigo, 0);
  assert.ok(!fs.existsSync(path.join(e.daniel, 'src/ui/nuevo.ts')));
  assert.throws(() => git(e.daniel, 'config', '--get', `branch.${HIJA}.polaria-base`));
  const reclamo = ejecutarParalelo(e.daniel, 'reclamar', '--zonas', 'src/ui/nuevo.ts', '--confianza', '80');
  assert.strictEqual(reclamo.codigo, 2);
  assert.match(reclamo.error, /no existen en origin\/main: src\/ui\/nuevo\.ts/);
});

test('rama apilada: el hook protege el archivo del padre fuera de zona y solapes no cuenta el trabajo del padre como propio', () => {
  const e = conPadreConArchivoNuevo();
  assert.strictEqual(ejecutarParalelo(e.daniel, 'iniciar-rama', HIJA, '--base', PADRE).codigo, 0);
  assert.strictEqual(ejecutarParalelo(e.daniel, 'reclamar', '--zonas', 'src/otro/x.ts', '--confianza', '80', '--porque', 'Prueba').codigo, 0);
  const evento = (archivo) => ({ cwd: e.daniel, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(e.daniel, archivo) } });
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento('src/ui/nuevo.ts')).codigo, 2, 'existe en el padre y no está reclamado');
  assert.strictEqual(ejecutarHook('limitar-escritura.js', evento('src/ui/inventado.ts')).codigo, 0, 'no existe ni en main ni en el padre');
  escribir(e.daniel, 'src/otro/x.ts', 'cambio\n');
  git(e.daniel, 'add', 'src/otro/x.ts');
  git(e.daniel, 'commit', '-q', '-m', 'trabajo de la hija');
  const r = ejecutarParalelo(e.daniel, 'solapes', '--sin-fetch');
  assert.doesNotMatch(r.salida, /FUERA DE LO QUE/);
  assert.doesNotMatch(r.salida, /MISMO ARCHIVO/, 'el PR padre se solapa por diseño y no se avisa');
});

test('iniciar-rama --base: rechaza la rama principal y una rama padre que no existe (código 2); una rama que ya existía ignora --base', () => {
  const e = crearEscenario();
  const principal = ejecutarParalelo(e.daniel, 'iniciar-rama', HIJA, '--base', 'main');
  assert.strictEqual(principal.codigo, 2);
  assert.match(principal.error, /rama principal/);
  const inexistente = ejecutarParalelo(e.daniel, 'iniciar-rama', HIJA, '--base', 'nadie/pol-999-x');
  assert.strictEqual(inexistente.codigo, 2);
  assert.match(inexistente.error, /No encontré la rama padre/);
  assert.strictEqual(gitSinLanzar(e.daniel, 'rev-parse', '--verify', '-q', `refs/heads/${HIJA}`).codigo, 1, 'no se creó la rama');
  assert.strictEqual(ejecutarParalelo(e.daniel, 'iniciar-rama', HIJA).codigo, 0);
  git(e.daniel, 'switch', '-q', 'main');
  const existente = ejecutarParalelo(e.daniel, 'iniciar-rama', HIJA, '--base', PADRE);
  assert.strictEqual(existente.codigo, 0, existente.error);
  assert.match(existente.salida, /AVISO: .* ya existía, así que --base mauro\/pol-101-auth se ignora/);
});
