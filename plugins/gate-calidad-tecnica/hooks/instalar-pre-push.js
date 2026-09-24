#!/usr/bin/env node
// Instala el hook pre-push de git del gate-calidad-tecnica en el repo donde se abre la sesión.
// Lo ejecuta el inicio de sesión (SessionStart en Claude Code, sessionStart en Cursor), y la skill
// a mano si falta. Es idempotente: se puede correr en cada sesión.
//
// - Copia verificar-gate.js y registrar-veredicto.js a <git-common-dir>/polaria-gate/, así el hook
//   y la skill no dependen de la ruta del plugin (que cambia con cada versión) y quedan
//   actualizados en cada sesión.
// - Escribe <hooks>/pre-push, que ejecuta esa copia. Nunca pisa un pre-push ajeno ni escribe
//   dentro del repo versionado (core.hooksPath de husky u otro): en esos casos solo avisa.
//
// Nunca bloquea la sesión: siempre sale con 0. Los avisos van por stdout en Claude Code (entran
// al contexto) y por stderr en Cursor (su stdout debe ser JSON).

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MARCA_HOOK = 'polaria-gate-calidad-tecnica';
const CONTENIDO_PRE_PUSH = [
  '#!/bin/sh',
  `# ${MARCA_HOOK}: instalado por el plugin gate-calidad-tecnica de Polaria. No editar a mano.`,
  '# Bloquea el push de un commit sin veredicto del gate. Saltarlo con --no-verify incumple el protocolo.',
  'exec node "$(git rev-parse --git-common-dir)/polaria-gate/verificar-gate.js" --git-pre-push "$@"',
  '',
].join('\n');

let esCursor = false;

// Cursor entrega workspace_roots como ruta de URI ("/d:/WORK/repo"), que Node no acepta en Windows.
function rutaDelSistema(ruta) {
  return /^\/[a-zA-Z]:/.test(ruta) ? ruta.slice(1) : ruta;
}

function terminar(aviso) {
  if (esCursor) {
    process.stdout.write('{}');
    if (aviso) process.stderr.write(`${aviso}\n`);
  } else if (aviso) {
    process.stdout.write(`${aviso}\n`);
  }
  process.exit(0);
}

function instalar(directorio) {
  const git = (...argumentos) =>
    execFileSync('git', argumentos, { cwd: directorio, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  let directorioComun;
  let directorioHooks;
  try {
    directorioComun = path.resolve(directorio, git('rev-parse', '--git-common-dir'));
    directorioHooks = path.resolve(directorio, git('rev-parse', '--git-path', 'hooks'));
  } catch {
    terminar(); // No es un repo git: no hay push que proteger.
  }

  // Los scripts se copian aunque el pre-push no se pueda instalar: la skill los usa igual.
  const carpetaGate = path.join(directorioComun, 'polaria-gate');
  fs.mkdirSync(carpetaGate, { recursive: true });
  for (const script of ['verificar-gate.js', 'registrar-veredicto.js']) {
    fs.copyFileSync(path.join(__dirname, script), path.join(carpetaGate, script));
  }

  if (path.relative(directorioComun, directorioHooks).startsWith('..')) {
    terminar(
      `Gate de Calidad Técnica: este repo usa core.hooksPath (${directorioHooks}), así que el hook pre-push del ` +
        'gate NO quedó instalado y un push desde la terminal no se bloquea. Agrega a tu pre-push la línea: ' +
        'node "$(git rev-parse --git-common-dir)/polaria-gate/verificar-gate.js" --git-pre-push "$@"'
    );
  }

  const prePush = path.join(directorioHooks, 'pre-push');
  let actual = null;
  try {
    actual = fs.readFileSync(prePush, 'utf8');
  } catch {
    // No existe: se crea abajo.
  }
  if (actual !== null && !actual.includes(MARCA_HOOK)) {
    terminar(
      `Gate de Calidad Técnica: ya existe un pre-push propio en ${prePush}, así que el del gate NO quedó ` +
        'instalado y un push desde la terminal no se bloquea. Agrega a ese archivo la línea: ' +
        'node "$(git rev-parse --git-common-dir)/polaria-gate/verificar-gate.js" --git-pre-push "$@"'
    );
  }
  if (actual !== CONTENIDO_PRE_PUSH) {
    fs.mkdirSync(directorioHooks, { recursive: true });
    fs.writeFileSync(prePush, CONTENIDO_PRE_PUSH, { mode: 0o755 });
    fs.chmodSync(prePush, 0o755);
  }
  terminar();
}

let entrada = '';
process.stdin.on('data', (fragmento) => (entrada += fragmento));
process.stdin.on('end', () => {
  let directorio = process.cwd();
  try {
    const evento = JSON.parse(entrada);
    esCursor = evento.hook_event_name === 'sessionStart';
    const raiz = evento.workspace_roots && evento.workspace_roots[0] && rutaDelSistema(evento.workspace_roots[0]);
    directorio = evento.cwd || process.env.CURSOR_PROJECT_DIR || raiz || directorio;
  } catch {
    // Ejecución manual (sin evento): se instala en el directorio actual.
  }
  try {
    instalar(directorio);
  } catch (error) {
    terminar(`Gate de Calidad Técnica: no se pudo instalar el hook pre-push (${error.message}).`);
  }
});
if (process.stdin.isTTY) process.stdin.emit('end');
