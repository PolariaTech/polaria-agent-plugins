#!/usr/bin/env node
// Nivel 1 de pruebas: corre todas las pruebas del repo con el ejecutor de Node (node:test), sin dependencias.
// Busca tests/*.test.js en la raíz y plugins/*/tests/*.test.js. Uso: node scripts/correr-pruebas.js [nombre-del-plugin ...]
// Se lista cada archivo en vez de pasar una carpeta o un patrón: el comportamiento de `node --test <carpeta>` cambió
// entre versiones de Node y aquí tiene que funcionar igual en Windows, Linux y el CI.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const pedidos = process.argv.slice(2);

function pruebasEn(carpeta) {
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta).filter((n) => n.endsWith('.test.js')).map((n) => path.join(carpeta, n));
}

const archivos = [];
if (!pedidos.length) archivos.push(...pruebasEn(path.join(RAIZ, 'tests')));
const plugins = fs.readdirSync(path.join(RAIZ, 'plugins'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
for (const plugin of plugins) {
  if (!pedidos.length || pedidos.includes(plugin)) archivos.push(...pruebasEn(path.join(RAIZ, 'plugins', plugin, 'tests')));
}

if (!archivos.length) {
  console.log('No hay archivos de prueba para ejecutar.');
  process.exit(0);
}
console.log(`Ejecutando ${archivos.length} archivo(s) de prueba con Node ${process.version}, Git ${(spawnSync('git', ['--version'], { encoding: 'utf8' }).stdout || '?').trim()}`);
const resultado = spawnSync(process.execPath, ['--test', ...archivos], { stdio: 'inherit', cwd: RAIZ });
process.exit(resultado.status === null ? 1 : resultado.status);
