#!/usr/bin/env node
// Instala el hook pre-commit de git del plugin trabajo-en-paralelo en el repo donde se abre la sesión (o donde se
// reclama). Es la cuarta capa del límite de escritura: rechaza el commit de archivos fuera de las zonas del CLAIM.md,
// incluidos los escritos por Bash. Es idempotente: se puede correr en cada sesión.
//
// - Copia lib.js y verificar-commit.js a <git-common-dir>/polaria-paralelo/bin/, así el hook no depende de la ruta del
//   plugin (que cambia con cada versión) y queda actualizado en cada sesión.
// - Escribe <hooks>/pre-commit, que ejecuta esa copia. Nunca pisa un pre-commit ajeno ni escribe dentro del repo
//   versionado (core.hooksPath de husky u otro): en esos casos solo avisa.
// - El hook es inerte en una rama sin CLAIM.md, y nunca bloquea por una falla propia.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MARCA_HOOK = 'polaria-trabajo-en-paralelo';
const LINEA_DEL_HOOK = 'node "$(git rev-parse --git-common-dir)/polaria-paralelo/bin/verificar-commit.js" "$@"';
const CONTENIDO_PRE_COMMIT = [
  '#!/bin/sh',
  `# ${MARCA_HOOK}: instalado por el plugin trabajo-en-paralelo de Polaria. No editar a mano.`,
  '# Rechaza un commit con archivos fuera de las zonas del CLAIM.md. Saltarlo con --no-verify incumple el protocolo.',
  'command -v node >/dev/null 2>&1 || exit 0',
  `exec ${LINEA_DEL_HOOK}`,
  '',
].join('\n');

// Devuelve { estado, aviso }: estado es 'instalado', 'ya-instalado', 'ajeno', 'hooks-path' o 'sin-repo'.
function instalarPreCommit(directorio) {
  const git = (...argumentos) =>
    execFileSync('git', argumentos, { cwd: directorio, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let comun;
  let carpetaDeHooks;
  try {
    comun = path.resolve(directorio, git('rev-parse', '--git-common-dir'));
    carpetaDeHooks = path.resolve(directorio, git('rev-parse', '--git-path', 'hooks'));
  } catch {
    return { estado: 'sin-repo', aviso: null };
  }

  // Los scripts se copian aunque el hook no se pueda instalar: así se pueden enlazar a mano.
  const bin = path.join(comun, 'polaria-paralelo', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  for (const script of ['lib.js', 'verificar-commit.js']) fs.copyFileSync(path.join(__dirname, script), path.join(bin, script));
  // Los scripts son CommonJS: sin esto heredan el "type": "module" del package.json del repo y fallan.
  fs.writeFileSync(path.join(bin, 'package.json'), '{ "type": "commonjs" }\n');
  fs.writeFileSync(path.join(bin, 'paralelo-ruta.txt'), path.join(__dirname, 'paralelo.js'));

  if (path.relative(comun, carpetaDeHooks).startsWith('..')) {
    return {
      estado: 'hooks-path',
      aviso: `este repo usa core.hooksPath (${carpetaDeHooks}), así que el pre-commit de trabajo en paralelo NO quedó instalado. Agrega a tu pre-commit la línea: ${LINEA_DEL_HOOK}`,
    };
  }
  const destino = path.join(carpetaDeHooks, 'pre-commit');
  let actual = null;
  try {
    actual = fs.readFileSync(destino, 'utf8');
  } catch {
    // No existe: se crea abajo.
  }
  if (actual !== null && !actual.includes(MARCA_HOOK)) {
    return {
      estado: 'ajeno',
      aviso: `ya existe un pre-commit propio en ${destino}, así que el de trabajo en paralelo NO quedó instalado. Agrega a ese archivo la línea: ${LINEA_DEL_HOOK}`,
    };
  }
  if (actual === CONTENIDO_PRE_COMMIT) return { estado: 'ya-instalado', aviso: null };
  fs.mkdirSync(carpetaDeHooks, { recursive: true });
  fs.writeFileSync(destino, CONTENIDO_PRE_COMMIT, { mode: 0o755 });
  fs.chmodSync(destino, 0o755);
  return { estado: 'instalado', aviso: null };
}

module.exports = { instalarPreCommit, MARCA_HOOK };

if (require.main === module) {
  const resultado = instalarPreCommit(process.cwd());
  console.log(resultado.aviso ? `AVISO: ${resultado.aviso}` : `pre-commit: ${resultado.estado}`);
}
