// Pruebas de la lógica pura de scripts/lib.js: nombres de rama, lectura del reclamo y cruce de zonas.

const test = require('node:test');
const assert = require('node:assert');
const lib = require('../scripts/lib');
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

test('cacheVencida: sin caché o de hace más de 4 h está vencida', () => {
  assert.ok(lib.cacheVencida(null));
  assert.ok(lib.cacheVencida({ sincronizado: new Date(Date.now() - 5 * 3600000).toISOString() }));
  assert.ok(!lib.cacheVencida({ sincronizado: new Date().toISOString() }));
});
