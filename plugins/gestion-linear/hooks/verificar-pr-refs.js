#!/usr/bin/env node
// Hook del plugin gestion-linear, compartido por Claude Code y Cursor.
// Bloquea `gh pr create` si la descripción del PR no declara de dónde viene el trabajo. Acepta tres caminos:
//   - Linear: `Refs POL-X` (o `Part of`, `Contributes to`, `Related to`).
//   - Sheet de requerimientos: `Refs REQ-NNN` (mismos verbos). El hook solo valida el formato, no que la fila exista.
//   - Manual, para trabajo sin requerimiento creado: `Sin ticket: <motivo>` con un motivo escrito (mínimo 8 caracteres).
// También bloquea si usa `Closes`, `Fixes`, `Resolves` o `Implements` con un POL-X:
// esas palabras cierran el issue al hacer merge y se saltan el MODO CIERRE de linear-transicionar-estado.
// Sin el vínculo, Linear solo engancha el PR por el nombre de la rama, y con varios issues en una rama enlaza solo el primero.
//
// Claude Code (PreToolUse, hooks.json, herramientas Bash y PowerShell): recibe { tool_name, tool_input: { command }, cwd };
//   salida 0 = deja pasar, salida 2 = bloquea y el mensaje de stderr vuelve a Claude.
// Cursor (beforeShellExecution, cursor-hooks.json): recibe { command, cwd };
//   responde por stdout { permission, user_message, agent_message } y además sale con 2 al bloquear.
// Si el evento no se puede leer, deja pasar: es una ayuda de proceso, no un control de seguridad.

const fs = require('fs');
const path = require('path');

const CREAR_PR = /\bgh(?:\.exe)?\s+pr\s+create\b/i;
const VINCULA = /\b(?:refs?|part of|contributes to|related to)\s+(?:POL|REQ)-\d+/i;
const SIN_TICKET = /\bsin ticket\s*:[ \t]*([^\r\n"']+)/i;
const MOTIVO_MINIMO = 8;
const CIERRA = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|implement(?:s|ed)?)\s+POL-\d+/i;
const ARCHIVO_DE_DESCRIPCION = /(?:--body-file|-F)[\s=]+(?:"([^"]+)"|'([^']+)'|(\S+))/;

let esCursor = false;

function permitir() {
  if (esCursor) process.stdout.write(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
}

function bloquear(mensaje) {
  if (esCursor) process.stdout.write(JSON.stringify({ permission: 'deny', user_message: mensaje, agent_message: mensaje }));
  process.stderr.write(`${mensaje}\n`);
  process.exit(2);
}

// El comando ya incluye --body y los heredoc; si la descripción viene de un archivo, se lee también.
function textoDelPr(comando, directorio) {
  const archivo = ARCHIVO_DE_DESCRIPCION.exec(comando);
  const ruta = archivo && (archivo[1] || archivo[2] || archivo[3]);
  if (!ruta || ruta === '-') return comando;
  try {
    return `${comando}\n${fs.readFileSync(path.resolve(directorio, ruta), 'utf8')}`;
  } catch {
    return comando;
  }
}

let entrada = '';
process.stdin.on('data', (fragmento) => (entrada += fragmento));
process.stdin.on('end', () => {
  let evento;
  try {
    evento = JSON.parse(entrada.replace(/^﻿/, ''));
  } catch {
    permitir();
  }
  if (!evento || typeof evento !== 'object') permitir(); // JSON válido pero que no es un evento (por ejemplo `null`).
  esCursor = evento.hook_event_name === 'beforeShellExecution';
  const comando = esCursor ? evento.command : evento.tool_input && evento.tool_input.command;
  if (typeof comando !== 'string' || !CREAR_PR.test(comando)) permitir();

  const raizCruda = Array.isArray(evento.workspace_roots) ? evento.workspace_roots[0] : undefined;
  const raiz = typeof raizCruda === 'string' ? raizCruda.replace(/^\/([a-zA-Z]:)/, '$1') : undefined;
  const directorio = evento.cwd || process.env.CURSOR_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || raiz || process.cwd();
  const texto = textoDelPr(comando, directorio);

  if (CIERRA.test(texto)) {
    bloquear('Gestión de Linear: la descripción del PR cierra el issue (`Closes`, `Fixes`, `Resolves` o `Implements` POL-X). Cámbialo por `Refs POL-X`: el issue se cierra solo con MODO CIERRE de linear-transicionar-estado, después del merge y con los criterios de aceptación citados.');
  }
  const sinTicket = SIN_TICKET.exec(texto);
  const motivoValido = sinTicket && sinTicket[1].trim().length >= MOTIVO_MINIMO;
  if (!VINCULA.test(texto) && !motivoValido) {
    bloquear('Gestión de Linear: la descripción del PR no dice de dónde viene el trabajo. Agrega una de estas líneas con --body o --body-file: `Refs POL-X` si hay issue en Linear (una por issue, por ejemplo `Refs POL-370, POL-318`), `Refs REQ-NNN` si el requerimiento está en el Sheet, o `Sin ticket: <motivo>` si no hay requerimiento creado (el motivo es obligatorio, mínimo 8 caracteres). Sin vínculo a Linear, este solo engancha el primer issue que aparece en el nombre de la rama.');
  }
  permitir();
});
