// Criterios 10 (lint y dependencias) y 11 (un solo frente) del Gate de Calidad Técnica: la parte que decide un script,
// no la IA. Lo usan correr-verificaciones.js (el gate) y avisar-criterios-al-escribir.js (el aviso al editar).
//   - contarTickets: cuántos tickets distintos (POL-N o REQ-N) trae la rama.
//   - vulnerabilidadesAltas / compararAudit: qué vulnerabilidades altas o críticas trae `npm audit` y cuáles son nuevas
//     respecto de la rama principal.
// Todo es de solo lectura: `npm audit` no corre con `fix` y las carpetas temporales se borran.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Un PR (una rama) toca como máximo este número de tickets: una funcionalidad o un arreglo a la vez.
const MAX_TICKETS_POR_PR = 3;
// 'sin-empeorar': FAIL solo por vulnerabilidades altas o críticas que la rama principal no tiene.
// 'cero': FAIL por cualquier alta o crítica. Se cambia a 'cero' cuando se cierre POL-434.
const MODO_AUDIT = 'sin-empeorar';
const RANGO_DE_SEVERIDAD = { high: 3, critical: 4 };
const MINUTOS_MAXIMO_AUDIT = 3;

// ---------- Criterio 11: tickets ----------

// Recibe textos (nombre de la rama y mensajes de commit) y devuelve los IDs distintos, en orden de aparición.
function contarTickets(textos) {
  const vistos = new Set();
  for (const texto of textos) {
    for (const coincidencia of String(texto).matchAll(/\b(POL|REQ)-(\d+)\b/gi)) vistos.add(`${coincidencia[1].toUpperCase()}-${coincidencia[2]}`);
  }
  return [...vistos];
}

function ticketsDeLaRama(raiz, principal) {
  const git = (...argumentos) => spawnSync('git', argumentos, { cwd: raiz, encoding: 'utf8' });
  const rama = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
  const mensajes = git('log', '--no-merges', '--reverse', '--format=%s%n%b', `${principal}..HEAD`).stdout;
  return contarTickets([rama, mensajes]);
}

function resultadoDeTickets(tickets) {
  if (!tickets.length) return { nombre: 'TICKETS', estado: 'NO_APLICA', comando: null, codigo: null, segundos: 0, salida: 'La rama y sus commits no citan ningún ticket (POL-N o REQ-N).' };
  const estado = tickets.length > MAX_TICKETS_POR_PR ? 'FAIL' : 'OK';
  const salida =
    estado === 'FAIL'
      ? `${tickets.length} tickets en esta rama: ${tickets.join(', ')}. El máximo es ${MAX_TICKETS_POR_PR} a la vez y de una misma funcionalidad. Te sugiero dejar en este PR ${tickets.slice(0, MAX_TICKETS_POR_PR).join(', ')} y llevar el resto a otro PR; tú decides cuáles, pero no pueden ser más de ${MAX_TICKETS_POR_PR}.`
      : `${tickets.length} ticket(s): ${tickets.join(', ')} (máximo ${MAX_TICKETS_POR_PR}).`;
  return { nombre: 'TICKETS', estado, comando: null, codigo: null, segundos: 0, salida };
}

// ---------- Criterio 10b: npm audit ----------

// Recibe la salida JSON de `npm audit --json` y devuelve un Map nombre -> severidad (solo altas y críticas).
function vulnerabilidadesAltas(auditoria) {
  const mapa = new Map();
  const vulnerabilidades = (auditoria && auditoria.vulnerabilities) || {};
  for (const [nombre, datos] of Object.entries(vulnerabilidades)) {
    if (datos && RANGO_DE_SEVERIDAD[datos.severity]) mapa.set(nombre, datos.severity);
  }
  return mapa;
}

// Nombres de paquetes que el diff de package.json o del lock toca (líneas + o - con "nombre": ").
function paquetesDelDiff(textoDeDiff) {
  const nombres = new Set();
  for (const linea of String(textoDeDiff).split(/\r?\n/)) {
    const coincidencia = /^[+-]\s*"((?:node_modules\/)?(?:@[^/"]+\/)?[^/"]+)"\s*:/.exec(linea);
    if (coincidencia) nombres.add(coincidencia[1].replace(/^node_modules\//, ''));
  }
  return nombres;
}

// `rama` y `principal` son Map de vulnerabilidadesAltas (principal puede ser null si no se pudo medir).
// Devuelve { estado, nuevas, existentes, sugerencias }: nuevas es lo que hace FAIL; existentes, advertencia;
// sugerencias, las existentes que están en un paquete que el diff ya toca ("aprovecha para actualizarlo").
function compararAudit(rama, principal, { modo = MODO_AUDIT, paquetesTocados = new Set() } = {}) {
  const nuevas = [];
  const existentes = [];
  for (const [nombre, severidad] of rama) {
    const antes = principal && principal.get(nombre);
    const esNueva = modo === 'cero' || !antes || RANGO_DE_SEVERIDAD[severidad] > RANGO_DE_SEVERIDAD[antes];
    (esNueva ? nuevas : existentes).push({ nombre, severidad });
  }
  const sugerencias = existentes.filter((v) => paquetesTocados.has(v.nombre));
  return { estado: nuevas.length ? 'FAIL' : 'OK', nuevas, existentes, sugerencias };
}

function lineasDeAudit(comparacion) {
  const texto = (v) => `${v.nombre} (${v.severidad})`;
  const lineas = [];
  if (comparacion.nuevas.length) lineas.push(`NUEVAS altas o críticas que la rama principal no tiene: ${comparacion.nuevas.map(texto).join(', ')}.`);
  else lineas.push('Sin vulnerabilidades altas o críticas nuevas respecto de la rama principal.');
  if (comparacion.existentes.length) lineas.push(`ADVERTENCIA (ya existían, no bloquean): ${comparacion.existentes.map(texto).join(', ')}.`);
  if (comparacion.sugerencias.length) lineas.push(`SUGERENCIA: este diff ya toca ${comparacion.sugerencias.map((v) => v.nombre).join(', ')}; aprovecha para actualizar esas dependencias.`);
  return lineas;
}

// Corre `npm audit` en una carpeta y devuelve el JSON, o null si npm falló o no entregó JSON (sin red, por ejemplo).
function correrNpmAudit(carpeta) {
  const resultado = spawnSync('npm', ['audit', '--omit=dev', '--json', '--package-lock-only'], {
    cwd: carpeta,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: MINUTOS_MAXIMO_AUDIT * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024,
  });
  try {
    const json = JSON.parse(resultado.stdout);
    return json && json.error ? null : json; // npm audit sale con código 1 cuando hay vulnerabilidades: el JSON sirve igual.
  } catch {
    return null;
  }
}

// Copia a una carpeta temporal el package.json y el lock de la rama principal. Devuelve la carpeta, o null si main no los tiene.
function carpetaDeLaPrincipal(raiz, principal) {
  const leer = (archivo) => spawnSync('git', ['show', `${principal}:${archivo}`], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const paquete = leer('package.json');
  const lock = leer('package-lock.json');
  if (paquete.status !== 0 || lock.status !== 0) return null;
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-audit-main-'));
  fs.writeFileSync(path.join(carpeta, 'package.json'), paquete.stdout);
  fs.writeFileSync(path.join(carpeta, 'package-lock.json'), lock.stdout);
  return carpeta;
}

// Bloque AUDIT del gate. `ejecutarAudit` se puede cambiar en las pruebas para no usar la red.
function resultadoDeAudit(raiz, principal, { ejecutarAudit = correrNpmAudit } = {}) {
  const inicio = Date.now();
  const comando = 'npm audit --omit=dev --json --package-lock-only';
  const bloque = (estado, salida) => ({ nombre: 'AUDIT', estado, comando: estado === 'NO_APLICA' ? null : comando, codigo: null, segundos: Math.round((Date.now() - inicio) / 100) / 10, salida });
  if (!fs.existsSync(path.join(raiz, 'package-lock.json'))) return bloque('NO_APLICA', 'El repo no tiene package-lock.json: no hay dependencias de npm que auditar.');
  const deLaRama = ejecutarAudit(raiz);
  if (!deLaRama) return bloque('NO_DETERMINADO', 'npm audit no respondió (sin red o error de npm): el revisor lo declara en la evidencia; no es FAIL por sí solo.');
  let carpetaPrincipal = null;
  try {
    carpetaPrincipal = carpetaDeLaPrincipal(raiz, principal);
    const dePrincipal = carpetaPrincipal ? ejecutarAudit(carpetaPrincipal) : null;
    const diff = spawnSync('git', ['diff', `${principal}...HEAD`, '--', 'package.json', 'package-lock.json'], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout;
    const principalMedida = dePrincipal ? vulnerabilidadesAltas(dePrincipal) : null;
    const comparacion = compararAudit(vulnerabilidadesAltas(deLaRama), principalMedida, { paquetesTocados: paquetesDelDiff(diff) });
    const aviso = principalMedida ? [] : ['AVISO: no pude medir la rama principal (sin package-lock.json o sin red): todas las altas o críticas cuentan como nuevas.'];
    return bloque(comparacion.estado, [...aviso, ...lineasDeAudit(comparacion)].join('\n'));
  } finally {
    if (carpetaPrincipal) fs.rmSync(carpetaPrincipal, { recursive: true, force: true });
  }
}

module.exports = {
  MAX_TICKETS_POR_PR,
  MODO_AUDIT,
  contarTickets,
  ticketsDeLaRama,
  resultadoDeTickets,
  vulnerabilidadesAltas,
  paquetesDelDiff,
  compararAudit,
  lineasDeAudit,
  correrNpmAudit,
  resultadoDeAudit,
};
