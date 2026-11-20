// Pruebas del límite de tickets por reclamo: un reclamo es una sola funcionalidad y admite hasta MAX_TICKETS_POR_RECLAMO
// tickets. Usan git real (ayudas.js), igual que limite.test.js.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const lib = require('../scripts/lib');
const { git, crearEscenario, ejecutarParalelo, cuerpoDeReclamo } = require('./ayudas');

function conRama() {
  const e = crearEscenario();
  const r = ejecutarParalelo(e.daniel, 'iniciar-rama', 'daniel/pol-102-recepcion');
  assert.strictEqual(r.codigo, 0, r.error);
  return e;
}

function reclamar(e, issue, zonas, extra = []) {
  return ejecutarParalelo(e.daniel, 'reclamar', '--issue', issue, '--zonas', zonas, '--confianza', '80', '--responsable', 'Daniel', ...extra);
}

const sinClaim = (e) => assert.ok(!fs.existsSync(path.join(e.daniel, 'CLAIM.md')), 'no debía escribirse el CLAIM.md');

test('lote: un solo ticket sigue igual que siempre (sin Tickets ni Funcionalidad)', () => {
  const e = conRama();
  const r = reclamar(e, 'REQ-012', 'src/ui/a.ts');
  assert.strictEqual(r.codigo, 0, `${r.error}${r.salida}`);
  const claim = fs.readFileSync(path.join(e.daniel, 'CLAIM.md'), 'utf8');
  assert.doesNotMatch(claim, /\*\*Tickets:\*\*|\*\*Funcionalidad:\*\*/);
  assert.strictEqual(git(e.daniel, 'log', '-1', '--format=%s'), 'claim(REQ-012): reclama las zonas del ticket');
});

test('lote: 3 tickets de una funcionalidad con --funcionalidad se reclaman y quedan en el CLAIM.md', () => {
  const e = conRama();
  const r = reclamar(e, 'REQ-012,REQ-015,REQ-019', 'src/ui/a.ts,src/otro/x.ts', ['--funcionalidad', 'Recepción de pedidos: validación']);
  assert.strictEqual(r.codigo, 0, `${r.error}${r.salida}`);
  const claim = fs.readFileSync(path.join(e.daniel, 'CLAIM.md'), 'utf8');
  assert.match(claim, /\*\*Issue:\*\* REQ-012/);
  assert.match(claim, /\*\*Tickets:\*\* REQ-012, REQ-015, REQ-019/);
  assert.match(claim, /\*\*Funcionalidad:\*\* Recepción de pedidos: validación/);
  assert.strictEqual(git(e.daniel, 'log', '-1', '--format=%s'), 'claim(REQ-012+REQ-015+REQ-019): reclama las zonas de los tickets');
  const leido = lib.parsearReclamo(claim);
  assert.deepStrictEqual(leido.tickets, ['REQ-012', 'REQ-015', 'REQ-019']);
  assert.strictEqual(leido.issue, 'REQ-012');
  assert.strictEqual(leido.funcionalidad, 'Recepción de pedidos: validación');
});

test('lote: más de 3 tickets se rechaza (código 2) y no escribe nada', () => {
  const e = conRama();
  const r = reclamar(e, 'REQ-012,REQ-013,REQ-014,REQ-015', 'src/ui/a.ts', ['--funcionalidad', 'Algo']);
  assert.strictEqual(r.codigo, 2);
  assert.match(r.error, /máximo 3 tickets|como máximo 3 tickets/);
  sinClaim(e);
});

test('lote: varios tickets sin --funcionalidad se rechaza', () => {
  const e = conRama();
  const r = reclamar(e, 'REQ-012,REQ-013', 'src/ui/a.ts');
  assert.strictEqual(r.codigo, 2);
  assert.match(r.error, /falta --funcionalidad/);
  sinClaim(e);
});

test('lote: un ticket repetido o mal formado se rechaza', () => {
  const e = conRama();
  const repetido = reclamar(e, 'REQ-012,REQ-012', 'src/ui/a.ts', ['--funcionalidad', 'X']);
  assert.strictEqual(repetido.codigo, 2);
  assert.match(repetido.error, /repetido/);
  const malo = reclamar(e, 'REQ-012,abc', 'src/ui/a.ts', ['--funcionalidad', 'X']);
  assert.strictEqual(malo.codigo, 2);
  assert.match(malo.error, /Ticket no válido: "ABC"/);
  sinClaim(e);
});

test('lote: un lote repartido en más de 2 áreas de código se rechaza; con un solo ticket no aplica', () => {
  const e = conRama();
  const zonas = 'src/ui/a.ts,src/otro/x.ts,src/afuera/c.ts';
  const lote = reclamar(e, 'REQ-012,REQ-013', zonas, ['--funcionalidad', 'Mezcla']);
  assert.strictEqual(lote.codigo, 2);
  assert.match(lote.error, /3 áreas de código/);
  sinClaim(e);
  const uno = reclamar(e, 'REQ-012', zonas);
  assert.strictEqual(uno.codigo, 0, `${uno.error}${uno.salida}`);
});

test('lote: un claim de varios tickets se cruza por su ticket principal y un claim v1 viejo se sigue leyendo', () => {
  const lote = lib.parsearReclamo(cuerpoDeReclamo({ issue: 'REQ-012', rama: 'daniel/req-012-x', zonas: ['src/ui/a.ts'] }).replace('**Rama:**', '**Tickets:** REQ-012, REQ-013\n**Funcionalidad:** Prueba\n**Rama:**'));
  assert.deepStrictEqual(lote.tickets, ['REQ-012', 'REQ-013']);
  const viejo = lib.parsearReclamo(cuerpoDeReclamo({ issue: 'POL-101', rama: 'mauro/pol-101-auth', zonas: ['src/auth/'] }));
  assert.deepStrictEqual(viejo.tickets, ['POL-101']);
  assert.strictEqual(viejo.funcionalidad, '');
  const cache = { reclamos: [{ ...lote, ultimoCommit: new Date().toISOString() }] };
  assert.strictEqual(lib.reclamosAjenos(cache, 'POL-102').length, 1);
  assert.strictEqual(lib.reclamosAjenos(cache, 'REQ-012').length, 0);
});
