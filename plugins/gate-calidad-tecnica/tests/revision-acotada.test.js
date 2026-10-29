// Pruebas de POL-392: revisión acotada desde la segunda ronda (ronda-previa.js, marca con reporte) y push del
// reclamo (CLAIM.md) sin veredicto. Cubren CA1 a CA6 del issue a nivel de scripts; el comportamiento del
// revisor y de la skill se prueba en el laboratorio de plugins.
// Se corren con: node --test "plugins/gate-calidad-tecnica/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { decidirRonda, leerMarca } = require('../hooks/ronda-previa');
const { criteriosConFail } = require('../hooks/registrar-veredicto');

const HOOKS = path.join(__dirname, '..', 'hooks');
const SHA_VACIO = '0'.repeat(40);

const REPORTE_CON_FAIL = [
  '### 🛡️ Reporte de Revisión Técnica — Polaria',
  '',
  '| Criterio | Estado | Evidencia / Justificación |',
  '| :--- | :---: | :--- |',
  '| **1. Nomenclatura** | `[PASS]` | Nombres claros. |',
  '| **2. Manejo de Errores** | `[FAIL]` | Falta try/catch en la query. |',
  '| **3. Secretos / Credenciales** | `[PASS]` | Sin secretos. |',
  '| **4. Código de Debug** | `[FAIL]` | Queda un console.log. |',
  '| **5. Convenciones Polaria** | `[PASS]` | Consistente. |',
  '| **6. Pruebas** | `[PASS]` | npm test: 10/10. |',
  '| **7. Validación de Formularios** | `[N/A]` | No toca formularios. |',
  '| **8. Build de Despliegue** | `[PASS]` | npm run build OK. |',
  '',
  '**Veredicto Final**: `RECHAZADO`',
].join('\n');

function git(carpeta, ...argumentos) {
  return execFileSync('git', argumentos, { cwd: carpeta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Repo de software con un commit base en main, publicado (origin/main) y la rama "cambio" encima.
function crearRepo() {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-acotado-'));
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

function registrar(carpeta, veredicto, reporte) {
  const argumentos = [path.join(HOOKS, 'registrar-veredicto.js'), veredicto];
  if (reporte !== undefined) argumentos.push('--reporte');
  return spawnSync('node', argumentos, { cwd: carpeta, encoding: 'utf8', input: reporte });
}

function rondaPrevia(carpeta) {
  const resultado = spawnSync('node', [path.join(HOOKS, 'ronda-previa.js'), 'main'], { cwd: carpeta, encoding: 'utf8' });
  assert.strictEqual(resultado.status, 0, resultado.stderr);
  return JSON.parse(resultado.stdout);
}

function pushDeGit(carpeta, sha) {
  return spawnSync('node', [path.join(HOOKS, 'verificar-gate.js'), '--git-pre-push'], {
    cwd: carpeta,
    encoding: 'utf8',
    input: `refs/heads/cambio ${sha} refs/heads/cambio ${SHA_VACIO}\n`,
  });
}

function pushDeLaIA(carpeta) {
  return spawnSync('node', [path.join(HOOKS, 'verificar-gate.js')], {
    cwd: carpeta,
    encoding: 'utf8',
    input: JSON.stringify({ tool_input: { command: 'git push -u origin cambio' }, cwd: carpeta }),
  });
}

test('criteriosConFail: lista los criterios en [FAIL] y no confunde la plantilla del reporte', () => {
  assert.deepStrictEqual(criteriosConFail(REPORTE_CON_FAIL), [2, 4]);
  assert.deepStrictEqual(criteriosConFail('| **3. Secretos** | `[PASS / FAIL]` | plantilla |'), []);
  assert.deepStrictEqual(criteriosConFail('| **1. Nomenclatura** | `[HEREDADO]` | ronda anterior |'), []);
});

test('registrar-veredicto con --reporte: la primera línea sigue siendo el veredicto y se guardan los FAIL y el reporte', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(registrar(carpeta, 'RECHAZADO', REPORTE_CON_FAIL).status, 0);
  const marca = fs.readFileSync(path.join(carpeta, '.git', 'polaria-gate', `${sha}.md`), 'utf8');
  assert.strictEqual(marca.split('\n')[0], 'VEREDICTO: RECHAZADO');
  assert.match(marca, /^CRITERIOS_FAIL: 2,4$/m);
  assert.match(marca, /Falta try\/catch en la query/);
});

test('registrar-veredicto: sin --reporte la marca queda solo con el veredicto, como antes', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(registrar(carpeta, 'APROBADO').status, 0);
  const marca = fs.readFileSync(path.join(carpeta, '.git', 'polaria-gate', `${sha}.md`), 'utf8');
  assert.deepStrictEqual(marca.trim().split('\n').map((l) => l.split(':')[0]), ['VEREDICTO', 'Registrado']);
});

test('registrar-veredicto: --reporte sin reporte por stdin no registra nada', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(registrar(carpeta, 'RECHAZADO', '').status, 1);
  assert.strictEqual(fs.existsSync(path.join(carpeta, '.git', 'polaria-gate', `${sha}.md`)), false);
});

test('leerMarca y decidirRonda: solo un RECHAZADO con CRITERIOS_FAIL acota la ronda siguiente', () => {
  assert.deepStrictEqual(leerMarca('VEREDICTO: RECHAZADO\nCRITERIOS_FAIL: 2,4\n---\nx'), { veredicto: 'RECHAZADO', criteriosFail: [2, 4] });
  const marcas = { aaa: 'VEREDICTO: RECHAZADO\nCRITERIOS_FAIL: 3\n', bbb: 'VEREDICTO: APROBADO\n', ccc: 'VEREDICTO: RECHAZADO\n' };
  const leer = (sha) => marcas[sha] ?? null;
  assert.strictEqual(decidirRonda(['aaa'], leer).ronda, 'ACOTADA');
  assert.strictEqual(decidirRonda(['bbb', 'aaa'], leer).ronda, 'COMPLETA', 'la marca más cercana manda');
  assert.strictEqual(decidirRonda(['ccc'], leer).ronda, 'COMPLETA', 'rechazo viejo sin reporte guardado');
  assert.strictEqual(decidirRonda(['zzz'], leer).ronda, 'COMPLETA', 'ninguna marca');
  assert.deepStrictEqual(decidirRonda(['aaa'], leer).criteriosSiempre, [6, 8]);
});

test('ronda-previa.js: la primera ronda de una rama es completa (CA4)', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  assert.deepStrictEqual(rondaPrevia(carpeta), { ronda: 'COMPLETA' });
});

test('ronda-previa.js: tras un RECHAZADO con reporte, el commit siguiente se revisa acotado con su delta (CA1, CA2)', () => {
  const carpeta = crearRepo();
  const primero = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  registrar(carpeta, 'RECHAZADO', REPORTE_CON_FAIL);
  commitear(carpeta, { 'src/app.js': 'module.exports = 2;\n' });
  assert.deepStrictEqual(rondaPrevia(carpeta), {
    ronda: 'ACOTADA',
    shaPrevio: primero,
    criteriosFail: [2, 4],
    criteriosSiempre: [6, 8],
    comandoDelta: `git diff ${primero}..HEAD`,
  });
});

test('ronda-previa.js: el commit con varios commits sin marca en medio sigue encontrando el rechazo', () => {
  const carpeta = crearRepo();
  const primero = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  registrar(carpeta, 'RECHAZADO', REPORTE_CON_FAIL);
  commitear(carpeta, { 'src/otro.js': 'module.exports = 3;\n' });
  commitear(carpeta, { 'src/app.js': 'module.exports = 2;\n' });
  assert.strictEqual(rondaPrevia(carpeta).shaPrevio, primero);
});

test('ronda-previa.js: la marca del propio HEAD no cuenta como ronda previa', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  registrar(carpeta, 'RECHAZADO', REPORTE_CON_FAIL);
  assert.strictEqual(rondaPrevia(carpeta).ronda, 'COMPLETA');
});

test('ronda-previa.js: un rechazo sin reporte guardado (marca de la versión anterior) obliga a revisión completa', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  registrar(carpeta, 'RECHAZADO');
  commitear(carpeta, { 'src/app.js': 'module.exports = 2;\n' });
  assert.strictEqual(rondaPrevia(carpeta).ronda, 'COMPLETA');
});

test('ronda-previa.js: tras un APROBADO la revisión vuelve a ser completa', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  registrar(carpeta, 'APROBADO', REPORTE_CON_FAIL.replace(/FAIL/g, 'PASS'));
  commitear(carpeta, { 'src/app.js': 'module.exports = 2;\n' });
  assert.strictEqual(rondaPrevia(carpeta).ronda, 'COMPLETA');
});

test('hook pre-push: la marca RECHAZADO con reporte sigue bloqueando el push igual que antes (CA5)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  registrar(carpeta, 'RECHAZADO', REPORTE_CON_FAIL);
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
});

test('hook pre-push: la marca APROBADO con reporte deja pasar el push (CA5)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  registrar(carpeta, 'APROBADO', REPORTE_CON_FAIL.replace(/FAIL/g, 'PASS'));
  assert.strictEqual(pushDeGit(carpeta, sha).status, 0);
});

test('hook pre-push: el push del commit que solo agrega CLAIM.md pasa sin veredicto (CA6)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'CLAIM.md': '# Reclamo\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 0);
});

test('hook pre-push: un push con código y sin marca sigue bloqueado (CA6)', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
});

test('hook pre-push: CLAIM.md junto a otro archivo en el mismo commit no se exime', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'CLAIM.md': '# Reclamo\n', 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
});

test('hook pre-push: código sin publicar debajo de un commit de CLAIM.md no se cuela', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'src/app.js': 'module.exports = 1;\n' });
  const sha = commitear(carpeta, { 'CLAIM.md': '# Reclamo\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
});

test('hook pre-push: un CLAIM.md dentro de una subcarpeta no es el reclamo; junto a código sigue bloqueado', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'docs/CLAIM.md': '# no es el reclamo\n', 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
});

test('hook pre-push: un CLAIM.md dentro de una subcarpeta pasa solo como documentación (POL-396), no como reclamo', () => {
  const carpeta = crearRepo();
  const sha = commitear(carpeta, { 'docs/CLAIM.md': '# no es el reclamo\n' });
  assert.strictEqual(pushDeGit(carpeta, sha).status, 0);
});

test('hook pre-push: un merge nunca se exime aunque solo traiga CLAIM.md', () => {
  const carpeta = crearRepo();
  commitear(carpeta, { 'CLAIM.md': '# Reclamo\n' });
  git(carpeta, 'checkout', '-q', '-b', 'lateral', 'main');
  commitear(carpeta, { 'LEEME.md': 'x\n' });
  git(carpeta, 'checkout', '-q', 'cambio');
  git(carpeta, 'merge', '-q', '--no-ff', '-m', 'merge', 'lateral');
  const sha = git(carpeta, 'rev-parse', 'HEAD');
  assert.strictEqual(pushDeGit(carpeta, sha).status, 1);
});

test('hook de la IA: el push del commit que solo agrega CLAIM.md pasa y el de código sin marca se bloquea (CA6)', () => {
  const conReclamo = crearRepo();
  commitear(conReclamo, { 'CLAIM.md': '# Reclamo\n' });
  assert.strictEqual(pushDeLaIA(conReclamo).status, 0);

  const conCodigo = crearRepo();
  commitear(conCodigo, { 'src/app.js': 'module.exports = 1;\n' });
  assert.strictEqual(pushDeLaIA(conCodigo).status, 2);
});
