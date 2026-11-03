#!/usr/bin/env node
// Hook del plugin gate-calidad-tecnica, compartido por Claude Code y Cursor.
// Después de que la IA escribe o edita un archivo de código, avisa de los criterios del Gate de Calidad
// Técnica que se pueden medir sin juicio, para corregirlos mientras se escribe y no en la revisión final:
//   - Criterio 3 (secretos): llaves, tokens, claves privadas y contraseñas escritas en el código.
//   - Criterio 4 (código de debug): console.log, debugger, print y "TODO borrar".
//   - Criterio 9 (tamaño y complejidad): más de 300 líneas de código en el archivo (medir-tamano.js) y, si el
//     repo tiene ESLint local con las reglas de la plantilla plantillas/eslint-limites/, funciones de más de
//     50 líneas o complejidad cognitiva mayor de 15.
// Solo avisa: nunca borra ni revierte nada. El veredicto lo da el revisor aislado del gate, no este hook.
// Los demás criterios (1, 2, 5, 6, 7, 8) piden juicio y los guía la skill escribir-codigo-conforme-al-gate.
//
// Claude Code (PostToolUse sobre Write|Edit|MultiEdit, hooks.json): recibe
//   { hook_event_name: "PostToolUse", tool_input: { file_path }, cwd };
//   salida 0 = nada que decir, salida 2 = el mensaje de stderr vuelve a Claude.
// Cursor (postToolUse sobre Write, cursor-hooks.json): recibe
//   { hook_event_name: "postToolUse", tool_input, cwd | workspace_roots };
//   no puede bloquear: responde por stdout { additional_context } para avisar al agente.
// El mensaje nunca incluye el valor del secreto, solo el número de línea y el tipo.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { LIMITE_LINEAS, contarLineasDeCodigo, esCodigoMedible } = require('./medir-tamano');

const EXTENSIONES_DE_CODIGO = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts',
  '.py', '.go', '.java', '.cs', '.php', '.rb',
]);
const CARPETAS_AJENAS = /(^|\/)(node_modules|dist|build|coverage|\.next|\.specify|\.claude|\.cursor|\.git)\//;
const MAXIMO_DE_AVISOS = 10;
const REGLAS_DE_ESLINT = new Set(['max-lines-per-function', 'sonarjs/cognitive-complexity']);

// Valores que son marcas de posición y no un secreto real.
const VALOR_DE_EJEMPLO = /^(x+|\*+|\.+|<.*>|\$\{.*\}|your[-_ ].*|changeme|change[-_]me|example.*|placeholder.*|dummy.*|test|secret|password|token)$/i;

const PATRONES_DE_SECRETO = [
  { tipo: 'llave de acceso de AWS', patron: /\bAKIA[0-9A-Z]{16}\b/ },
  { tipo: 'token de GitHub', patron: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { tipo: 'llave de API tipo sk-', patron: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { tipo: 'token de Slack', patron: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { tipo: 'clave privada', patron: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/ },
  { tipo: 'JWT', patron: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];
// Asignación de un literal a un nombre que suena a credencial: password = "abc12345".
const ASIGNACION_DE_SECRETO =
  /\b[\w.-]*(password|passwd|pwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|token)\w*["']?\s*[:=]\s*(["'`])([^"'`\s]{8,})\2/i;

const PATRONES_DE_DEBUG = [
  { tipo: 'console.log/debug/trace', patron: /\bconsole\.(log|debug|trace)\s*\(/ },
  { tipo: 'debugger', patron: /^\s*debugger\s*;?\s*$/ },
  { tipo: 'print de depuración', patron: /^\s*print\s*\(/, soloEn: new Set(['.py']) },
  { tipo: 'TODO de borrar', patron: /\b(TODO|FIXME|XXX)\b[^\n]{0,20}\b(borrar|eliminar|quitar|remove|delete)\b/i },
];

function buscarSecretos(lineas) {
  const hallazgos = [];
  lineas.forEach((linea, indice) => {
    const conocido = PATRONES_DE_SECRETO.find(({ patron }) => patron.test(linea));
    if (conocido) {
      hallazgos.push({ criterio: 3, linea: indice + 1, texto: `posible ${conocido.tipo} escrito en el código` });
      return;
    }
    const asignacion = ASIGNACION_DE_SECRETO.exec(linea);
    if (asignacion && !VALOR_DE_EJEMPLO.test(asignacion[3])) {
      hallazgos.push({ criterio: 3, linea: indice + 1, texto: 'posible credencial asignada como texto fijo' });
    }
  });
  return hallazgos;
}

function buscarDebug(lineas, extension) {
  const hallazgos = [];
  lineas.forEach((linea, indice) => {
    const encontrado = PATRONES_DE_DEBUG.find(
      ({ patron, soloEn }) => (!soloEn || soloEn.has(extension)) && patron.test(linea)
    );
    if (encontrado) hallazgos.push({ criterio: 4, linea: indice + 1, texto: `código de debug (${encontrado.tipo})` });
  });
  return hallazgos;
}

function medirTamano(ruta, contenido) {
  if (!esCodigoMedible(ruta)) return [];
  const medido = contarLineasDeCodigo(contenido);
  if (medido <= LIMITE_LINEAS) return [];
  return [{ criterio: 9, linea: null, texto: `el archivo tiene ${medido} líneas de código y el límite es ${LIMITE_LINEAS}: divídelo antes de seguir` }];
}

// Recibe la ruta (relativa, con "/") y el contenido; devuelve los avisos de los criterios 3, 4 y 9 por archivo.
function analizarArchivo(ruta, contenido) {
  const extension = path.extname(ruta).toLowerCase();
  if (!EXTENSIONES_DE_CODIGO.has(extension) || CARPETAS_AJENAS.test(ruta.replace(/\\/g, '/'))) return [];
  const lineas = contenido.replace(/^﻿/, '').split(/\r?\n/);
  return [...buscarSecretos(lineas), ...buscarDebug(lineas, extension), ...medirTamano(ruta, contenido)];
}

// ESLint local del repo, sin instalar nada: solo corre si existe node_modules/eslint junto al proyecto.
function buscarEslint(archivo) {
  let carpeta = path.dirname(archivo);
  for (;;) {
    const binario = path.join(carpeta, 'node_modules', 'eslint', 'bin', 'eslint.js');
    if (fs.existsSync(binario)) return { carpeta, binario };
    const padre = path.dirname(carpeta);
    if (padre === carpeta) return null;
    carpeta = padre;
  }
}

function avisosDeEslint(archivo) {
  if (!esCodigoMedible(archivo)) return [];
  const eslint = buscarEslint(archivo);
  if (!eslint) return [];
  let salida;
  try {
    salida = execFileSync(process.execPath, [eslint.binario, '--format', 'json', archivo], {
      cwd: eslint.carpeta,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    salida = error && error.stdout ? String(error.stdout) : ''; // ESLint sale con 1 cuando hay errores de lint.
  }
  try {
    const mensajes = (JSON.parse(salida)[0] || {}).messages || [];
    return mensajes
      .filter((mensaje) => REGLAS_DE_ESLINT.has(mensaje.ruleId))
      .map((mensaje) => ({ criterio: 9, linea: mensaje.line || null, texto: `${mensaje.ruleId}: ${mensaje.message}` }));
  } catch {
    return []; // ESLint no corrió o no entregó JSON: este hook no es quien decide eso.
  }
}

function formatear(archivo, hallazgos) {
  const lista = hallazgos
    .slice(0, MAXIMO_DE_AVISOS)
    .map((h) => `- Criterio ${h.criterio}${h.linea ? `, línea ${h.linea}` : ''}: ${h.texto}`);
  const resto = hallazgos.length > MAXIMO_DE_AVISOS ? [`- (y ${hallazgos.length - MAXIMO_DE_AVISOS} más)`] : [];
  return [
    `Gate de Calidad Técnica: ${path.basename(archivo)} no cumpliría estos criterios en la revisión final:`,
    ...lista,
    ...resto,
    'Corrígelo ahora en este archivo. Si es un secreto, no lo copies a ninguna parte: muévelo a una variable de entorno y avisa al dev para que lo rote.',
  ].join('\n');
}

let esCursor = false;

function nadaQueDecir() {
  if (esCursor) process.stdout.write('{}');
  process.exit(0);
}

function avisar(mensaje) {
  if (esCursor) {
    process.stdout.write(JSON.stringify({ additional_context: mensaje }));
    process.exit(0);
  }
  process.stderr.write(`${mensaje}\n`);
  process.exit(2);
}

function leerEvento(entrada) {
  const evento = JSON.parse(entrada.replace(/^﻿/, '')); // Cursor manda el stdin con BOM.
  esCursor = evento.hook_event_name === 'postToolUse';
  const parametros = evento.tool_input || {};
  const ruta = parametros.file_path || parametros.path || parametros.target_file || evento.file_path || '';
  const directorio =
    evento.cwd || (evento.workspace_roots && evento.workspace_roots[0]) || process.env.CURSOR_PROJECT_DIR || process.cwd();
  return ruta ? path.resolve(directorio, ruta) : '';
}

function main() {
  let entrada = '';
  process.stdin.on('data', (fragmento) => (entrada += fragmento));
  process.stdin.on('end', () => {
    let archivo;
    try {
      archivo = leerEvento(entrada);
    } catch {
      nadaQueDecir(); // Evento ilegible: no es responsabilidad de este hook decidir.
    }
    if (!archivo) nadaQueDecir();

    let contenido;
    try {
      contenido = fs.readFileSync(archivo, 'utf8');
    } catch {
      nadaQueDecir(); // El archivo no existe (ej. se borró): nada que verificar.
    }

    const hallazgos = [...analizarArchivo(archivo, contenido), ...avisosDeEslint(archivo)];
    if (hallazgos.length === 0) nadaQueDecir();
    avisar(formatear(archivo, hallazgos));
  });
}

if (require.main === module) main();

module.exports = { analizarArchivo, formatear };
