// Pruebas de contrato de las skills de 1.3.0: campo Repo en linear-crear-issue y rama/repo en MODO INICIO de linear-transicionar-estado.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS = path.join(__dirname, '..', 'skills');
const leer = (skill) => fs.readFileSync(path.join(SKILLS, skill, 'SKILL.md'), 'utf8');

test('linear-crear-issue lee la línea Repo: del proyecto y la muestra en el preview', () => {
  const texto = leer('linear-crear-issue');
  assert.match(texto, /\*\*Repo del proyecto:\*\*/);
  assert.match(texto, /^Repo: +\[repo leído de la descripción del proyecto, o "no aplica"\]\s*$/m);
});

test('linear-crear-issue propone un issue por repo y no confunde un error con "no aplica"', () => {
  const texto = leer('linear-crear-issue');
  assert.match(texto, /un issue por repo/);
  assert.match(texto, /Si `get_project` falla[^\n]*Nunca uses `Repo: no aplica` como respaldo de un error/);
});

test('linear-transicionar-estado indica la rama y el repo en MODO INICIO', () => {
  const texto = leer('linear-transicionar-estado');
  assert.match(texto, /\*\*Rama y repo:\*\*[^\n]*`gitBranchName`[^\n]*`Repo:`/);
  assert.match(texto, /Si `get_issue` o `get_project` fallan, omite la rama y el repo y reporta el error/);
});

test('linear-transicionar-estado no recomienda palabras que cierran el issue en el PR', () => {
  const texto = leer('linear-transicionar-estado');
  assert.match(texto, /Nunca `Closes`, `Fixes`, `Resolves` ni `Implements`/);
});
