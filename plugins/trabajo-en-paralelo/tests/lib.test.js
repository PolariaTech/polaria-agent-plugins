// Pruebas de la lógica pura de scripts/lib.js: nombres de rama, lectura del reclamo y cruce de zonas.

const test = require('node:test');
const assert = require('node:assert');
const lib = require('../scripts/lib');
const claims = require('../scripts/claims');
const { cuerpoDeReclamo } = require('./ayudas');

test('issueDeRama: rama generada por Linear, en mayúsculas, con prefijo largo y sin issue', () => {
  assert.strictEqual(lib.issueDeRama('daniel/pol-123-login-con-google'), 'POL-123');
  assert.strictEqual(lib.issueDeRama('POL-5'), 'POL-5');
  assert.strictEqual(lib.issueDeRama('mauro/pol-7'), 'POL-7');
  assert.strictEqual(lib.issueDeRama('main'), null);
  assert.strictEqual(lib.issueDeRama(''), null);
  assert.strictEqual(lib.issueDeRama(undefined), null);
});

test('parsearReclamo: lee estado, rama, responsable, confianza, zonas y compartidos', () => {
  const r = lib.parsearReclamo(
    cuerpoDeReclamo({ rama: 'x/pol-1-a', responsable: 'Ana', confianza: 65, zonas: ['src/a/', 'src/b.ts', 'src/c.ts#doblar'], compartidos: ['package.json'] })
  );
  assert.strictEqual(r.estado, 'ACTIVO');
  assert.strictEqual(r.rama, 'x/pol-1-a');
  assert.strictEqual(r.responsable, 'Ana');
  assert.strictEqual(r.confianza, 65);
  assert.deepStrictEqual(r.zonas.map((z) => [z.ruta, z.tipo, z.funcion]), [
    ['src/a/', 'carpeta', null],
    ['src/b.ts', 'archivo', null],
    ['src/c.ts', 'funcion', 'doblar'],
  ]);
  assert.deepStrictEqual(r.compartidos.map((z) => z.ruta), ['package.json']);
});

test('parsearReclamo: reclamo liberado, sin marcador y con rutas de Windows', () => {
  assert.strictEqual(lib.parsearReclamo(cuerpoDeReclamo({ rama: 'a', estado: 'LIBERADO' })).estado, 'LIBERADO');
  assert.strictEqual(lib.parsearReclamo('Un comentario normal sobre el issue'), null);
  assert.strictEqual(lib.parsearReclamo(''), null);
  assert.strictEqual(lib.parsearReclamo(null), null);
  const conBarras = lib.parsearReclamo(cuerpoDeReclamo({ rama: 'a', zonas: ['src\\auth\\'] }));
  assert.strictEqual(conBarras.zonas[0].ruta, 'src/auth/');
});

test('parsearReclamo: sin sección de zonas devuelve listas vacías, no falla', () => {
  const r = lib.parsearReclamo('<!-- polaria-reclamo v1 -->\n**Estado:** ACTIVO\n**Rama:** a\n');
  assert.deepStrictEqual(r.zonas, []);
  assert.deepStrictEqual(r.compartidos, []);
  assert.strictEqual(r.confianza, null);
});

test('zonaCubre: carpeta, archivo y función', () => {
  const carpeta = { ruta: 'src/auth/', tipo: 'carpeta' };
  assert.ok(lib.zonaCubre(carpeta, 'src/auth/session.ts'));
  assert.ok(lib.zonaCubre(carpeta, 'src/auth/sub/otro.ts'));
  assert.ok(!lib.zonaCubre(carpeta, 'src/authentication/x.ts'), 'un prefijo de texto no es una carpeta');
  assert.ok(!lib.zonaCubre(carpeta, 'src/ui/a.ts'));
  assert.ok(lib.zonaCubre({ ruta: 'src/a.ts', tipo: 'archivo' }, 'src/a.ts'));
  assert.ok(!lib.zonaCubre({ ruta: 'src/a.ts', tipo: 'archivo' }, 'src/a.tsx'));
  assert.ok(lib.zonaCubre({ ruta: 'src/a.ts', tipo: 'funcion', funcion: 'f' }, 'src/a.ts'));
  assert.ok(lib.zonaCubre({ ruta: 'src/auth/**', tipo: 'carpeta' }, 'src/auth/x.ts'));
  assert.ok(lib.zonaCubre({ ruta: '/', tipo: 'carpeta' }, 'cualquier/cosa.ts'));
});

test('zonasSeSolapan: carpeta con carpeta, carpeta con archivo, archivo con archivo', () => {
  const c = (ruta) => ({ ruta, tipo: 'carpeta' });
  const a = (ruta) => ({ ruta, tipo: 'archivo' });
  assert.ok(lib.zonasSeSolapan(c('src/'), c('src/auth/')));
  assert.ok(lib.zonasSeSolapan(c('src/auth/'), c('src/')));
  assert.ok(!lib.zonasSeSolapan(c('src/auth/'), c('src/ui/')));
  assert.ok(!lib.zonasSeSolapan(c('src/auth/'), c('src/authz/')));
  assert.ok(lib.zonasSeSolapan(c('src/auth/'), a('src/auth/x.ts')));
  assert.ok(lib.zonasSeSolapan(a('src/auth/x.ts'), c('src/auth/')));
  assert.ok(lib.zonasSeSolapan(a('a.ts'), a('a.ts')));
  assert.ok(!lib.zonasSeSolapan(a('a.ts'), a('b.ts')));
});

test('rutaRelativaAlRepo y normalizarRuta', () => {
  assert.strictEqual(lib.normalizarRuta('.\\src\\a.ts'), 'src/a.ts');
  assert.strictEqual(lib.normalizarRuta('/src/a.ts'), 'src/a.ts');
  assert.strictEqual(lib.rutaRelativaAlRepo('/repo', 'src/a.ts'), 'src/a.ts');
});

test('rutaReal: resuelve el ancestro que existe aunque el archivo no exista y respeta lo que no puede resolver', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'ruta-real-'));
  const real = fs.realpathSync.native(carpeta);
  assert.strictEqual(lib.rutaReal(path.join(carpeta, 'a', 'b', 'nuevo.ts')), path.join(real, 'a', 'b', 'nuevo.ts'));
  const enlace = path.join(carpeta, 'enlace');
  fs.mkdirSync(path.join(carpeta, 'destino'));
  fs.symlinkSync(path.join(carpeta, 'destino'), enlace, 'junction');
  assert.strictEqual(lib.rutaReal(path.join(enlace, 'x.ts')), path.join(real, 'destino', 'x.ts'));
});

test('reclamosAjenos y reclamoPropio ignoran los liberados y al propio issue', () => {
  const cache = {
    reclamos: [
      { issue: 'POL-1', estado: 'ACTIVO' },
      { issue: 'POL-2', estado: 'LIBERADO' },
      { issue: 'POL-3', estado: 'ACTIVO' },
    ],
  };
  assert.deepStrictEqual(lib.reclamosAjenos(cache, 'POL-1').map((r) => r.issue), ['POL-3']);
  assert.strictEqual(lib.reclamoPropio(cache, 'POL-2'), null);
  assert.strictEqual(lib.reclamoPropio(cache, 'POL-1').issue, 'POL-1');
  assert.deepStrictEqual(lib.reclamosAjenos(null, 'POL-1'), []);
});

test('parsearReclamo: lee el campo Issue (POL- o REQ-) y lo pone en mayúsculas; sin el campo queda vacío', () => {
  assert.strictEqual(lib.parsearReclamo(cuerpoDeReclamo({ issue: 'req-012', rama: 'x/req-012-a' })).issue, 'REQ-012');
  assert.strictEqual(lib.parsearReclamo(cuerpoDeReclamo({ issue: 'POL-7', rama: 'x/pol-7-a' })).issue, 'POL-7');
  assert.strictEqual(lib.parsearReclamo(cuerpoDeReclamo({ rama: 'x/pol-7-a' })).issue, '');
  assert.strictEqual(lib.issueDeRama('usuario/req-012-corregir-unidades'), 'REQ-012');
});

test('estaInactivo: más de 5 días sin commits en la rama deja de contar; sin fecha cuenta', () => {
  const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
  assert.ok(!lib.estaInactivo({ ultimoCommit: hace(0) }));
  assert.ok(!lib.estaInactivo({ ultimoCommit: hace(4.9) }));
  assert.ok(lib.estaInactivo({ ultimoCommit: hace(5.1) }));
  assert.ok(!lib.estaInactivo({}), 'sin fecha no se puede decir que esté inactivo');
  assert.ok(!lib.estaInactivo({ ultimoCommit: 'no es una fecha' }));
  const cache = {
    reclamos: [
      { issue: 'POL-1', estado: 'ACTIVO', ultimoCommit: hace(1) },
      { issue: 'POL-2', estado: 'ACTIVO', ultimoCommit: hace(9) },
      { issue: 'POL-3', estado: 'LIBERADO', ultimoCommit: hace(1) },
    ],
  };
  assert.deepStrictEqual(lib.reclamosAjenos(cache, 'POL-9').map((r) => r.issue), ['POL-1']);
  assert.deepStrictEqual(lib.reclamosInactivos(cache, 'POL-9').map((r) => r.issue), ['POL-2']);
});

test('construirClaim se lee de vuelta con parsearReclamo; agregarZonas solo toca la sección de zonas', () => {
  const texto = claims.construirClaim({ issue: 'REQ-012', rama: 'x/req-012-a', responsable: 'Ana', confianza: 75, zonas: ['src/a/', 'src/b.ts#f'], compartidos: ['package.json'], porque: 'Porque sí.' });
  const leido = lib.parsearReclamo(texto);
  assert.strictEqual(leido.issue, 'REQ-012');
  assert.strictEqual(leido.confianza, 75);
  assert.deepStrictEqual(leido.zonas.map((z) => z.ruta), ['src/a/', 'src/b.ts']);
  assert.deepStrictEqual(leido.compartidos.map((z) => z.ruta), ['package.json']);

  const ampliado = claims.agregarZonas(texto, ['src/c/'], '2026-10-27');
  const releido = lib.parsearReclamo(ampliado);
  assert.deepStrictEqual(releido.zonas.map((z) => z.ruta), ['src/a/', 'src/b.ts', 'src/c/']);
  assert.deepStrictEqual(releido.compartidos.map((z) => z.ruta), ['package.json'], 'los compartidos no cambian');
  assert.match(ampliado, /- `src\/c\/` — autorizada por el usuario el 2026-10-27\n\n### Compartidos/, 'la nueva ruta queda al final de la sección, antes de la siguiente');
  assert.match(ampliado, /### Por qué\nPorque sí\./);
  assert.throws(() => claims.agregarZonas('sin secciones', ['x/'], '2026-10-27'), /Zonas que voy a tocar/);
});

test('construirClaim con compartidos vacíos no inventa rutas', () => {
  const leido = lib.parsearReclamo(claims.construirClaim({ issue: 'POL-1', rama: 'x/pol-1-a', confianza: 50, zonas: ['src/a/'] }));
  assert.deepStrictEqual(leido.compartidos, []);
});

test('rutaValida: rechaza rutas absolutas, con .., a secas "/" o con comillas invertidas', () => {
  assert.ok(claims.rutaValida('src/auth/'));
  assert.ok(claims.rutaValida('package.json'));
  for (const mala of ['', '/', '../x', 'a/../b', 'C:/x', 'a`b']) assert.ok(!claims.rutaValida(mala), mala);
});

test('hashDeClaim: ignora los saltos de línea de Windows', () => {
  assert.strictEqual(lib.hashDeClaim('a\r\nb\r\n'), lib.hashDeClaim('a\nb\n'));
  assert.notStrictEqual(lib.hashDeClaim('a'), lib.hashDeClaim('b'));
});

test('cacheVencida: sin caché o de hace más de 4 h está vencida', () => {
  assert.ok(lib.cacheVencida(null));
  assert.ok(lib.cacheVencida({ sincronizado: new Date(Date.now() - 5 * 3600000).toISOString() }));
  assert.ok(!lib.cacheVencida({ sincronizado: new Date().toISOString() }));
});
