#!/usr/bin/env node
// Mide el tamaño de los archivos de código del diff para el criterio 9 del Gate de Calidad Técnica.
// Lo ejecuta la skill gate-calidad-tecnica-pre-merge-polaria en su Paso 1, desde la raíz del repo:
//   node "<raíz del plugin>/hooks/medir-tamano.js" <rama principal>
// La medición la decide este script y no la IA: el revisor solo copia su salida en el criterio 9.
// Solo lee git (git diff, git show, git merge-base); no escribe nada.
//
// Regla (R1 y R5 de POL-399): un archivo de código no puede pasar de 300 líneas, sin contar líneas en blanco
// ni comentarios. El código que ya incumplía antes del cambio (trinquete) puede quedar igual o mejorar, pero
// no crecer. Un archivo nuevo o que cruza el límite es FAIL; uno heredado que crece es FAIL; uno heredado que
// no crece es ADVERTENCIA (no bloquea). Un eslint-suppressions.json que suma incumplimientos respecto de la
// rama principal, o que no es un JSON válido, es FAIL: es la forma de esconder código nuevo bajo el trinquete.
// Si el archivo no existía en la rama principal (el baseline inicial) no hay con qué comparar: es ADVERTENCIA.
// Las líneas por función y la complejidad cognitiva (R2 y R3) las mide ESLint, no este script.
//
// Salida: primera línea TAMANO: SIN_FAIL o TAMANO: CON_FAIL, y una línea por hallazgo:
//   FAIL <regla> <archivo> <medido> > <límite> (<motivo>)
//   ADVERTENCIA <regla> <archivo> <medido> > <límite> (<motivo>)

const { execFileSync } = require('child_process');
const path = require('path');

const LIMITE_LINEAS = 300;
const LIMITE_DURO = 1000; // S104 de SonarJS: por encima de esto, un archivo que crece es FAIL sin excepción.
const EXTENSIONES = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);
const CARPETAS_AJENAS = /(^|\/)(node_modules|dist|build|coverage|\.next|\.specify|\.claude|\.cursor)\//;

function esCodigoMedible(ruta) {
  const extension = path.extname(ruta).toLowerCase();
  if (!EXTENSIONES.has(extension)) return false;
  if (CARPETAS_AJENAS.test(ruta)) return false;
  return !/\.d\.[cm]?ts$/i.test(ruta) && !/\.min\.[cm]?js$/i.test(ruta);
}

// Cuenta las líneas con código: ni en blanco ni solo comentario (igual que skipBlankLines y skipComments de
// max-lines). Una línea con código y un comentario al final cuenta. Es una lectura de caracteres, no un
// parser: reconoce // , /* */ y comillas simples, dobles y de plantilla.
// El estado ({ enBloque, comilla, hayCodigo }) pasa de una línea a la siguiente: un comentario de bloque o una
// plantilla pueden abarcar varias. Cada función devuelve el índice por el que sigue la lectura de la línea.
function leerDentroDeBloque(linea, i, estado) {
  if (linea[i] === '*' && linea[i + 1] === '/') {
    estado.enBloque = false;
    return i + 1;
  }
  return i;
}

function leerDentroDeComilla(linea, i, estado) {
  estado.hayCodigo = true;
  if (linea[i] === '\\') return i + 1;
  if (linea[i] === estado.comilla) estado.comilla = null;
  return i;
}

function leerCaracter(linea, i, estado) {
  const caracter = linea[i];
  if (caracter === '/' && linea[i + 1] === '/') return linea.length; // El resto de la línea es comentario.
  if (caracter === '/' && linea[i + 1] === '*') {
    estado.enBloque = true;
    return i + 1;
  }
  if (caracter === '"' || caracter === "'" || caracter === '`') {
    estado.comilla = caracter;
    estado.hayCodigo = true;
  } else if (!/\s/.test(caracter)) {
    estado.hayCodigo = true;
  }
  return i;
}

function lineaTieneCodigo(linea, estado) {
  estado.hayCodigo = false;
  for (let i = 0; i < linea.length; i += 1) {
    if (estado.enBloque) i = leerDentroDeBloque(linea, i, estado);
    else if (estado.comilla) i = leerDentroDeComilla(linea, i, estado);
    else i = leerCaracter(linea, i, estado);
  }
  // Una comilla simple o doble sin cerrar no pasa de línea; la de plantilla sí.
  if (estado.comilla && estado.comilla !== '`') estado.comilla = null;
  return estado.hayCodigo;
}

function contarLineasDeCodigo(texto) {
  const estado = { enBloque: false, comilla: null, hayCodigo: false };
  return texto.split(/\r?\n/).filter((linea) => lineaTieneCodigo(linea, estado)).length;
}

// archivo: { ruta, antes, despues }. "antes" es el contenido en la rama principal (null si el archivo es
// nuevo) y "despues" el de HEAD. Devuelve el hallazgo del archivo o null si cumple.
function evaluarArchivo({ ruta, antes, despues }) {
  const medido = contarLineasDeCodigo(despues);
  const previo = antes === null ? null : contarLineasDeCodigo(antes);
  const detalle = `${medido} > ${LIMITE_LINEAS}`;

  if (previo === null) {
    return medido > LIMITE_LINEAS
      ? { tipo: 'FAIL', regla: 'max-lines', ruta, texto: `${detalle} (archivo nuevo)` }
      : null;
  }
  if (previo <= LIMITE_LINEAS) {
    return medido > LIMITE_LINEAS
      ? { tipo: 'FAIL', regla: 'max-lines', ruta, texto: `${detalle} (pasó de ${previo} a ${medido} y cruza el límite)` }
      : null;
  }
  if (medido > previo) {
    const duro = medido > LIMITE_DURO ? `; supera ${LIMITE_DURO}, sin excepción (S104)` : '';
    return {
      tipo: 'FAIL',
      regla: 'max-lines',
      ruta,
      texto: `${detalle} (archivo heredado que crece: ${previo} → ${medido}${duro})`,
    };
  }
  if (medido > LIMITE_LINEAS) {
    const cambio = medido < previo ? `bajó de ${previo} a ${medido}` : `sigue en ${medido}`;
    return {
      tipo: 'ADVERTENCIA',
      regla: 'max-lines',
      ruta,
      texto: `${detalle} (archivo heredado, ${cambio}; no crece)`,
    };
  }
  return null; // Estaba excedido y ya cumple.
}

// Compara dos eslint-suppressions.json ({ "<archivo>": { "<regla>": { "count": N } } }). Devuelve un hallazgo
// FAIL por cada archivo y regla cuyo conteo sube o que aparece de nuevo: eso es código nuevo escondido.
function compararSuppressions(ruta, antes, despues) {
  const hallazgos = [];
  const previas = antes || {};
  for (const [archivo, reglas] of Object.entries(despues || {})) {
    for (const [regla, datos] of Object.entries(reglas || {})) {
      const nuevo = Number(datos && datos.count) || 0;
      const viejo = Number(previas[archivo] && previas[archivo][regla] && previas[archivo][regla].count) || 0;
      if (nuevo > viejo) {
        hallazgos.push({
          tipo: 'FAIL',
          regla,
          ruta: archivo,
          texto: `${nuevo} > ${viejo} (${ruta} suma incumplimientos respecto de la rama principal: código nuevo no puede suprimirse)`,
        });
      }
    }
  }
  return hallazgos;
}

function evaluarCambio({ archivos, suppressions }) {
  const hallazgos = [];
  for (const archivo of archivos) {
    const hallazgo = evaluarArchivo(archivo);
    if (hallazgo) hallazgos.push(hallazgo);
  }
  for (const suppression of suppressions) hallazgos.push(...evaluarSuppressions(suppression));
  return hallazgos;
}

function totalIncumplimientos(suppressions) {
  return Object.values(suppressions || {})
    .flatMap((reglas) => Object.values(reglas || {}))
    .reduce((suma, datos) => suma + (Number(datos && datos.count) || 0), 0);
}

// suppression: { ruta, antes, despues, nuevo, ilegible }. "nuevo" es que el archivo no existía en la rama
// principal (baseline inicial) e "ilegible" que el de HEAD no es un JSON válido.
function evaluarSuppressions({ ruta, antes, despues, nuevo, ilegible }) {
  if (ilegible) {
    return [{ tipo: 'FAIL', regla: 'eslint-suppressions', ruta, texto: '(JSON inválido en HEAD: no se puede verificar el trinquete)' }];
  }
  if (nuevo) {
    // No hay con qué comparar: el baseline inicial lo congela el dev y aquí solo se avisa para que alguien lo revise.
    const total = totalIncumplimientos(despues);
    return [{ tipo: 'ADVERTENCIA', regla: 'eslint-suppressions', ruta, texto: `(baseline inicial: ${total} incumplimientos congelados; no se compara con la rama principal, revísalo)` }];
  }
  return compararSuppressions(ruta, antes, despues);
}

function formatear(hallazgos) {
  const hayFail = hallazgos.some((hallazgo) => hallazgo.tipo === 'FAIL');
  const lineas = hallazgos.map((hallazgo) => `${hallazgo.tipo} ${hallazgo.regla} ${hallazgo.ruta} ${hallazgo.texto}`);
  return [hayFail ? 'TAMANO: CON_FAIL' : 'TAMANO: SIN_FAIL', ...lineas].join('\n') + '\n';
}

function git(argumentos) {
  return execFileSync('git', argumentos, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function leerEn(revision, ruta) {
  try {
    return git(['show', `${revision}:${ruta}`]);
  } catch {
    return null; // El archivo no existe en esa revisión.
  }
}

// Lee del diff los archivos que existen en HEAD: [{ estado, ruta }]. -z soporta espacios y acentos.
function leerCambios(principal) {
  const campos = git(['diff', '--name-status', '--no-renames', '-z', `${principal}...HEAD`]).split('\0').filter(Boolean);
  const cambios = [];
  for (let i = 0; i + 1 < campos.length; i += 2) cambios.push({ estado: campos[i][0], ruta: campos[i + 1] });
  return cambios.filter((cambio) => cambio.estado !== 'D');
}

function parsearJson(texto) {
  if (texto === null) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

function main() {
  const principal = process.argv[2];
  if (!principal) {
    process.stderr.write('Uso: medir-tamano.js <rama principal>\n');
    process.exit(1);
  }
  let cambios;
  let base;
  try {
    base = git(['merge-base', principal, 'HEAD']).trim();
    cambios = leerCambios(principal);
  } catch (error) {
    process.stderr.write(`No se pudo leer el diff contra ${principal}: ${String(error.stderr || error.message).trim()}\n`);
    process.exit(1);
  }
  const archivos = [];
  const suppressions = [];
  for (const { ruta } of cambios) {
    if (path.basename(ruta) === 'eslint-suppressions.json') {
      const textoAntes = leerEn(base, ruta);
      const textoDespues = leerEn('HEAD', ruta);
      const despues = parsearJson(textoDespues);
      suppressions.push({
        ruta,
        antes: parsearJson(textoAntes),
        despues,
        nuevo: textoAntes === null,
        ilegible: textoDespues !== null && despues === null,
      });
    } else if (esCodigoMedible(ruta)) {
      const despues = leerEn('HEAD', ruta);
      if (despues !== null) archivos.push({ ruta, antes: leerEn(base, ruta), despues });
    }
  }
  process.stdout.write(formatear(evaluarCambio({ archivos, suppressions })));
}

if (require.main === module) main();

module.exports = {
  LIMITE_LINEAS,
  LIMITE_DURO,
  contarLineasDeCodigo,
  esCodigoMedible,
  evaluarArchivo,
  compararSuppressions,
  evaluarCambio,
  formatear,
};
