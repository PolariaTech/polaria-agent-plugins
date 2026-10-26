#!/usr/bin/env node
// Nivel 0 de pruebas: validación estática de todos los plugins del marketplace, sin ejecutar nada de ellos.
// Uso: node scripts/validar-plugins.js [nombre-del-plugin ...]   (sin argumentos valida todos)
// Sale con código 1 si hay algún ERROR; los AVISO no fallan el CI pero se muestran.
// Cubre lo que ya nos falló alguna vez: `source` con "./plugins/" que Cursor duplica, versiones que no coinciden
// entre manifiestos, hooks que apuntan a un script que no existe y skills que no se disparan por mala descripción.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const MAXIMO_LINEAS_SKILL = 500;
const MAXIMO_DESCRIPCION = 1536; // Límite de la descripción en el listado de skills (autoria-de-skills-anthropic).
const SEMVER = /^\d+\.\d+\.\d+$/;

const errores = [];
const avisos = [];
const error = (plugin, mensaje) => errores.push(`[${plugin}] ${mensaje}`);
const aviso = (plugin, mensaje) => avisos.push(`[${plugin}] ${mensaje}`);

function leerJson(ruta, plugin) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    error(plugin, `${path.relative(RAIZ, ruta)}: ${fs.existsSync(ruta) ? `JSON inválido (${e.message})` : 'no existe'}`);
    return null;
  }
}

function archivosJs(carpeta) {
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(carpeta, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : archivosJs(ruta);
    return /\.(c|m)?js$/.test(e.name) ? [ruta] : [];
  });
}

// Recorre un objeto buscando textos "command"/"args" que usan ${VARIABLE_PLUGIN_ROOT}/ruta y comprueba que la ruta exista.
function rutasDeHooks(valor, variable, salida = []) {
  if (typeof valor === 'string') {
    for (const m of valor.matchAll(new RegExp(`\\$\\{${variable}\\}/([^"\\s]+)`, 'g'))) salida.push(m[1]);
  } else if (Array.isArray(valor)) valor.forEach((v) => rutasDeHooks(v, variable, salida));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => rutasDeHooks(v, variable, salida));
  return salida;
}

function validarHooks(plugin, carpeta, archivo, variable) {
  const ruta = path.join(carpeta, archivo);
  if (!fs.existsSync(ruta)) return;
  const json = leerJson(ruta, plugin);
  if (!json) return;
  for (const relativa of rutasDeHooks(json, variable)) {
    if (!fs.existsSync(path.join(carpeta, relativa))) error(plugin, `${archivo} apunta a ${relativa}, que no existe`);
  }
}

function frontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto);
  if (!m) return null;
  const campos = {};
  let ultimo = null;
  for (const linea of m[1].split(/\r?\n/)) {
    const c = /^([A-Za-z_-]+):\s*(.*)$/.exec(linea);
    if (c) {
      ultimo = c[1];
      campos[ultimo] = c[2].replace(/^["']|["']$/g, '');
    } else if (ultimo) campos[ultimo] += ` ${linea.trim()}`;
  }
  return campos;
}

function validarSkills(plugin, carpeta) {
  const base = path.join(carpeta, 'skills');
  if (!fs.existsSync(base)) return;
  for (const entrada of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue;
    const archivo = path.join(base, entrada.name, 'SKILL.md');
    if (!fs.existsSync(archivo)) {
      error(plugin, `skills/${entrada.name} no tiene SKILL.md`);
      continue;
    }
    const texto = fs.readFileSync(archivo, 'utf8');
    const campos = frontmatter(texto);
    if (!campos) {
      error(plugin, `skills/${entrada.name}/SKILL.md no tiene frontmatter`);
      continue;
    }
    if (campos.name !== entrada.name) error(plugin, `skills/${entrada.name}: name "${campos.name}" no coincide con la carpeta`);
    if (!campos.description) error(plugin, `skills/${entrada.name}: falta description`);
    else if (campos.description.length > MAXIMO_DESCRIPCION) aviso(plugin, `skills/${entrada.name}: description de ${campos.description.length} caracteres (máximo útil ${MAXIMO_DESCRIPCION})`);
    const lineas = texto.split(/\r?\n/).length;
    if (lineas > MAXIMO_LINEAS_SKILL) error(plugin, `skills/${entrada.name}/SKILL.md tiene ${lineas} líneas (máximo ${MAXIMO_LINEAS_SKILL}; mueve contenido a references/)`);
  }
}

function validarPlugin(nombre, marketplaces) {
  const carpeta = path.join(RAIZ, 'plugins', nombre);
  const claude = leerJson(path.join(carpeta, '.claude-plugin', 'plugin.json'), nombre);
  const cursor = leerJson(path.join(carpeta, '.cursor-plugin', 'plugin.json'), nombre);

  for (const [editor, manifiesto] of [['claude', claude], ['cursor', cursor]]) {
    if (!manifiesto) continue;
    if (manifiesto.name !== nombre) error(nombre, `${editor}: name "${manifiesto.name}" no coincide con la carpeta`);
    if (!SEMVER.test(manifiesto.version || '')) error(nombre, `${editor}: version "${manifiesto.version}" no es semver`);
  }
  if (claude && cursor && claude.version !== cursor.version) error(nombre, `versión distinta entre manifiestos (claude ${claude.version}, cursor ${cursor.version})`);

  for (const [editor, marketplace] of Object.entries(marketplaces)) {
    const entrada = marketplace && marketplace.plugins.find((p) => p.name === nombre);
    if (!entrada) {
      error(nombre, `no está en el marketplace de ${editor}`);
      continue;
    }
    if (entrada.source !== nombre) error(nombre, `marketplace ${editor}: source "${entrada.source}" debe ser "${nombre}" (sin "./plugins/": Cursor duplica el segmento)`);
    if (claude && entrada.version !== claude.version) error(nombre, `marketplace ${editor}: version ${entrada.version} ≠ plugin.json ${claude.version}`);
  }

  if (cursor) {
    for (const clave of ['skills', 'agents']) {
      for (const ruta of [].concat(cursor[clave] || [])) if (!fs.existsSync(path.join(carpeta, ruta))) error(nombre, `cursor plugin.json: ${clave} apunta a ${ruta}, que no existe`);
    }
    if (typeof cursor.hooks === 'string' && !fs.existsSync(path.join(carpeta, cursor.hooks))) error(nombre, `cursor plugin.json: hooks apunta a ${cursor.hooks}, que no existe`);
  }

  validarHooks(nombre, carpeta, 'hooks/hooks.json', 'CLAUDE_PLUGIN_ROOT');
  validarHooks(nombre, carpeta, 'hooks/cursor-hooks.json', 'CURSOR_PLUGIN_ROOT');
  validarSkills(nombre, carpeta);

  for (const js of [...archivosJs(path.join(carpeta, 'hooks')), ...archivosJs(path.join(carpeta, 'scripts'))]) {
    const r = spawnSync(process.execPath, ['--check', js], { encoding: 'utf8' });
    if (r.status !== 0) error(nombre, `${path.relative(carpeta, js)}: error de sintaxis — ${(r.stderr || '').split('\n').find((l) => /Error/.test(l)) || 'ver node --check'}`);
  }

  const cambios = path.join(carpeta, 'CHANGELOG.md');
  if (fs.existsSync(cambios) && claude && !new RegExp(`^## \\[${claude.version.replace(/\./g, '\\.')}\\]`, 'm').test(fs.readFileSync(cambios, 'utf8'))) {
    aviso(nombre, `CHANGELOG.md no tiene la sección de la versión ${claude.version}`);
  }
}

const pedidos = process.argv.slice(2);
const todos = fs.readdirSync(path.join(RAIZ, 'plugins'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const marketplaces = {
  claude: leerJson(path.join(RAIZ, '.claude-plugin', 'marketplace.json'), 'marketplace'),
  cursor: leerJson(path.join(RAIZ, '.cursor-plugin', 'marketplace.json'), 'marketplace'),
};
for (const [editor, marketplace] of Object.entries(marketplaces)) {
  if (!marketplace) continue;
  for (const entrada of marketplace.plugins) {
    if (!todos.includes(entrada.name)) error('marketplace', `${editor}: "${entrada.name}" está listado pero no existe plugins/${entrada.name}/`);
  }
}
const aValidar = pedidos.length ? pedidos : todos;
for (const nombre of aValidar) {
  if (!todos.includes(nombre)) error(nombre, 'no existe plugins/' + nombre);
  else validarPlugin(nombre, marketplaces);
}

avisos.forEach((a) => console.log(`AVISO  ${a}`));
errores.forEach((e) => console.log(`ERROR  ${e}`));
console.log(`\n${aValidar.length} plugin(s) revisado(s): ${errores.length} error(es), ${avisos.length} aviso(s).`);
process.exit(errores.length ? 1 : 0);
