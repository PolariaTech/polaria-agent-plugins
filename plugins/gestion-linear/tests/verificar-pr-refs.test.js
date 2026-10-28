// Pruebas del hook verificar-pr-refs.js (gh pr create con Refs POL-X, Refs REQ-NNN o Sin ticket: motivo).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'hooks', 'verificar-pr-refs.js');

function correr(evento) {
  return spawnSync('node', [HOOK], { input: typeof evento === 'string' ? evento : JSON.stringify(evento), encoding: 'utf8' });
}

const claude = (command, cwd = os.tmpdir()) => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd });

test('un comando que no es gh pr create pasa', () => {
  assert.strictEqual(correr(claude('git status')).status, 0);
  assert.strictEqual(correr(claude('gh pr view 3')).status, 0);
});

test('gh pr create con Refs POL-X pasa', () => {
  assert.strictEqual(correr(claude('gh pr create --title "x" --body "Refs POL-370, POL-318"')).status, 0);
  assert.strictEqual(correr(claude('gh pr create --body "$(cat <<\'EOF\'\n## Qué\nPart of POL-12\nEOF\n)"')).status, 0);
});

test('gh pr create sin ningún vínculo se bloquea con exit 2 y explica los tres caminos', () => {
  const resultado = correr(claude('gh pr create --title "x" --body "cambia algo"'));
  assert.strictEqual(resultado.status, 2);
  assert.match(resultado.stderr, /Refs POL-X/);
  assert.match(resultado.stderr, /Refs REQ-NNN/);
  assert.match(resultado.stderr, /Sin ticket: <motivo>/);
});

test('gh pr create con Refs REQ-NNN (requerimiento del Sheet) pasa', () => {
  assert.strictEqual(correr(claude('gh pr create --title "x" --body "Refs REQ-012"')).status, 0);
  assert.strictEqual(correr(claude('gh pr create --title "x" --body "refs req-12, POL-5"')).status, 0);
  assert.strictEqual(correr(claude('gh pr create --title "x" --body "Related to REQ-7"')).status, 0);
});

test('Refs con un ID que no es POL ni REQ se bloquea', () => {
  assert.strictEqual(correr(claude('gh pr create --title "x" --body "Refs ABC-12"')).status, 2);
  assert.strictEqual(correr(claude('gh pr create --title "x" --body "Refs REQ"')).status, 2);
});

test('Sin ticket: con motivo pasa, también en heredoc y con mayúsculas distintas', () => {
  assert.strictEqual(correr(claude('gh pr create --title "x" --body "Sin ticket: corrección de documentación menor"')).status, 0);
  assert.strictEqual(correr(claude('gh pr create --body "$(cat <<\'EOF\'\n## Qué\nSIN TICKET: no hay requerimiento aún\nEOF\n)"')).status, 0);
});

test('Sin ticket: sin motivo o con un motivo de relleno se bloquea', () => {
  for (const cuerpo of ['Sin ticket:', 'Sin ticket: ', 'Sin ticket: n/a', 'Sin ticket: x', 'Sin ticket']) {
    assert.strictEqual(correr(claude(`gh pr create --title "x" --body "${cuerpo}"`)).status, 2, cuerpo);
  }
});

test('Sin ticket: no deja pasar una descripción que cierra un issue con Closes', () => {
  const resultado = correr(claude('gh pr create --body "Sin ticket: motivo suficiente\nCloses POL-2"'));
  assert.strictEqual(resultado.status, 2);
  assert.match(resultado.stderr, /cierra el issue/);
});

test('Sin ticket: en un archivo --body-file se lee', () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-sin-ticket-'));
  fs.writeFileSync(path.join(carpeta, 'bueno.md'), 'Sin ticket: ajuste de documentación\n');
  fs.writeFileSync(path.join(carpeta, 'malo.md'), 'Sin ticket:\n');
  assert.strictEqual(correr(claude('gh pr create --title t --body-file bueno.md', carpeta)).status, 0);
  assert.strictEqual(correr(claude('gh pr create --title t --body-file malo.md', carpeta)).status, 2);
});

test('gh pr create --fill, sin descripción, se bloquea', () => {
  assert.strictEqual(correr(claude('gh pr create --fill')).status, 2);
});

test('Closes, Fixes, Resolves o Implements se bloquean aunque haya Refs', () => {
  for (const palabra of ['Closes', 'fixes', 'Resolved', 'Implements']) {
    const resultado = correr(claude(`gh pr create --body "Refs POL-1\n${palabra} POL-2"`));
    assert.strictEqual(resultado.status, 2, palabra);
    assert.match(resultado.stderr, /cierra el issue/);
  }
});

test('la descripción en un archivo --body-file se lee', () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-refs-'));
  fs.writeFileSync(path.join(carpeta, 'bueno.md'), 'Refs POL-5\n');
  fs.writeFileSync(path.join(carpeta, 'malo.md'), 'Closes POL-5\n');
  assert.strictEqual(correr(claude('gh pr create --title t --body-file bueno.md', carpeta)).status, 0);
  assert.strictEqual(correr(claude('gh pr create --title t --body-file malo.md', carpeta)).status, 2);
  assert.strictEqual(correr(claude('gh pr create --title t --body-file no-existe.md', carpeta)).status, 2);
});

test('Cursor: responde JSON y bloquea con exit 2', () => {
  const malo = correr({ hook_event_name: 'beforeShellExecution', command: 'gh pr create --body "sin vínculo"', cwd: os.tmpdir() });
  assert.strictEqual(malo.status, 2);
  assert.strictEqual(JSON.parse(malo.stdout).permission, 'deny');
  const bueno = correr({ hook_event_name: 'beforeShellExecution', command: 'gh pr create --body "Refs POL-9"', cwd: os.tmpdir() });
  assert.strictEqual(bueno.status, 0);
  assert.strictEqual(JSON.parse(bueno.stdout).permission, 'allow');
});

test('stdin con BOM o ilegible no rompe la sesión', () => {
  assert.strictEqual(correr('﻿' + JSON.stringify(claude('gh pr create --body "Refs POL-1"'))).status, 0);
  assert.strictEqual(correr('no es json').status, 0);
  assert.strictEqual(correr('null').status, 0);
  assert.strictEqual(correr({ hook_event_name: 'beforeShellExecution', command: 'gh pr create --body "Refs POL-1"', workspace_roots: [1] }).status, 0);
});
