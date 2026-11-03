// Busca la prueba de un archivo de código JS/TS que la IA acaba de escribir, para el criterio 6 del Gate de
// Calidad Técnica. Lo usa avisar-criterios-al-escribir.js.
// Solo comprueba que el archivo de prueba EXISTA; que cubra el cambio lo revisa el revisor del gate.
//
// Una prueba cuenta si, para src/precio.ts, existe alguno de estos archivos:
//   - en la misma carpeta: precio.test.<ext> o precio.spec.<ext>;
//   - en una carpeta __tests__ de esa carpeta: precio.<ext>, precio.test.<ext> o precio.spec.<ext>;
//   - en tests/, test/, spec/ o __tests__/ de la raíz del proyecto, a cualquier profundidad hasta 6 niveles:
//     precio.<ext>, precio.test.<ext> o precio.spec.<ext>.
// Solo avisa en un proyecto con package.json que define un script "test" real: sin pruebas configuradas no hay
// dónde escribirlas y el aviso sería ruido. No avisa para archivos que no se prueban solos (configuración, tipos,
// index, constantes, stories, mocks, migraciones) ni para las propias pruebas.

const fs = require('fs');
const path = require('path');

const EXTENSIONES = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);
const CARPETAS_DE_PRUEBAS_EN_RAIZ = ['tests', 'test', 'spec', '__tests__'];
const CARPETAS_QUE_NO_SE_PRUEBAN = new Set([
  '__tests__', '__mocks__', 'tests', 'test', 'spec', 'config', 'types', 'migrations', '.storybook', 'node_modules',
  'dist', 'build', 'coverage', '.next', '.specify', '.claude', '.cursor', '.git',
]);
const NOMBRES_QUE_NO_SE_PRUEBAN = /^(index|types|constants|setup|jest\.setup|vitest\.setup)\.[cm]?[jt]sx?$/i;
const SUFIJOS_QUE_NO_SE_PRUEBAN = /\.(d|config|types|stories|mock|mocks|test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/i;
const PROFUNDIDAD_MAXIMA = 6;
const SCRIPT_TEST_POR_DEFECTO = /no test specified/i;

function escapar(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function seProbaSolo(archivo) {
  const nombre = path.basename(archivo);
  if (!EXTENSIONES.has(path.extname(nombre).toLowerCase())) return false;
  if (NOMBRES_QUE_NO_SE_PRUEBAN.test(nombre) || SUFIJOS_QUE_NO_SE_PRUEBAN.test(nombre)) return false;
  const carpetas = path.dirname(archivo).split(path.sep);
  return !carpetas.some((carpeta) => CARPETAS_QUE_NO_SE_PRUEBAN.has(carpeta.toLowerCase()));
}

// Carpeta con el package.json más cercano, si define un script "test" real; null si no hay.
function raizConPruebas(archivo) {
  let carpeta = path.dirname(archivo);
  for (;;) {
    const manifiesto = path.join(carpeta, 'package.json');
    if (fs.existsSync(manifiesto)) {
      try {
        const script = (JSON.parse(fs.readFileSync(manifiesto, 'utf8').replace(/^﻿/, '')).scripts || {}).test;
        return typeof script === 'string' && script.trim() && !SCRIPT_TEST_POR_DEFECTO.test(script) ? carpeta : null;
      } catch {
        return null; // package.json ilegible: no se decide nada.
      }
    }
    const padre = path.dirname(carpeta);
    if (padre === carpeta) return null;
    carpeta = padre;
  }
}

function leerCarpeta(carpeta) {
  try {
    return fs.readdirSync(carpeta, { withFileTypes: true });
  } catch {
    return [];
  }
}

function hayArchivo(carpeta, patron, profundidad) {
  for (const entrada of leerCarpeta(carpeta)) {
    if (entrada.isFile() && patron.test(entrada.name)) return true;
    if (entrada.isDirectory() && entrada.name !== 'node_modules' && profundidad < PROFUNDIDAD_MAXIMA) {
      if (hayArchivo(path.join(carpeta, entrada.name), patron, profundidad + 1)) return true;
    }
  }
  return false;
}

// Devuelve { criterio: 6, linea: null, texto } si el archivo debería tener prueba y no se encuentra; si no, null.
function avisoDePruebaFaltante(archivo) {
  if (!seProbaSolo(archivo)) return null;
  const raiz = raizConPruebas(archivo);
  if (!raiz) return null;

  const nombre = path.basename(archivo);
  const base = escapar(nombre.slice(0, nombre.length - path.extname(nombre).length));
  const extension = '\\.[cm]?[jt]sx?$';
  const conSufijo = new RegExp(`^${base}\\.(test|spec)${extension}`, 'i');
  const conOSinSufijo = new RegExp(`^${base}(\\.(test|spec))?${extension}`, 'i');

  if (leerCarpeta(path.dirname(archivo)).some((entrada) => entrada.isFile() && conSufijo.test(entrada.name))) return null;
  if (hayArchivo(path.join(path.dirname(archivo), '__tests__'), conOSinSufijo, PROFUNDIDAD_MAXIMA)) return null;
  for (const carpeta of CARPETAS_DE_PRUEBAS_EN_RAIZ) {
    if (hayArchivo(path.join(raiz, carpeta), conOSinSufijo, 0)) return null;
  }
  return {
    criterio: 6,
    linea: null,
    texto: `no encontré una prueba de ${nombre} (busqué ${nombre.replace(/\.[^.]+$/, '')}.test.* o .spec.* junto al archivo y en __tests__/, tests/, test/ y spec/); escríbela en este mismo cambio, o dile al dev dónde está si la cubre otro archivo`,
  };
}

module.exports = { avisoDePruebaFaltante, seProbaSolo };
