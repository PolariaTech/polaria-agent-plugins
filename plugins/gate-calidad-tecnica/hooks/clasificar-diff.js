#!/usr/bin/env node
// Clasifica el diff del cambio como SIN_CODIGO_PROPIO o CON_CODIGO_PROPIO para el Gate de Calidad Técnica.
// Lo ejecuta la skill gate-calidad-tecnica-pre-merge-polaria en su Paso 1, desde la raíz del repo:
//   node "<raíz del plugin>/hooks/clasificar-diff.js" <rama principal>
// La clasificación la decide este script y no la IA: así un diff con código no puede pasar por solo documentación.
// Solo lee git (git diff --name-only <principal>...HEAD); no escribe nada.
//
// SIN_CODIGO_PROPIO: todos los archivos del diff son documentación (.md) o código de terceros generado
// por herramientas (carpeta .specify/ y .md dentro de specs/, ambas de spec-kit). Cualquier otro archivo,
// incluido uno borrado o renombrado, hace que el cambio sea CON_CODIGO_PROPIO.
// Salida: primera línea con la clasificación; si es CON_CODIGO_PROPIO, una línea por archivo de código propio.

const { execFileSync } = require('child_process');

function esDocumentacion(ruta) {
  return /\.md$/i.test(ruta);
}

function esCodigoDeTerceros(ruta) {
  return ruta.startsWith('.specify/') || (ruta.startsWith('specs/') && esDocumentacion(ruta));
}

// Recibe las rutas del diff (relativas a la raíz del repo, con "/") y devuelve las que son código propio.
function archivosConCodigoPropio(rutas) {
  return rutas.filter((ruta) => !esDocumentacion(ruta) && !esCodigoDeTerceros(ruta));
}

function clasificar(rutas) {
  const codigoPropio = archivosConCodigoPropio(rutas);
  return codigoPropio.length === 0 && rutas.length > 0
    ? { clasificacion: 'SIN_CODIGO_PROPIO', archivos: [] }
    : { clasificacion: 'CON_CODIGO_PROPIO', archivos: codigoPropio };
}

function main() {
  const principal = process.argv[2];
  if (!principal) {
    process.stderr.write('Uso: clasificar-diff.js <rama principal>\n');
    process.exit(1);
  }
  let salida;
  try {
    // -z separa por NUL: soporta nombres con espacios y evita que git escape los acentos; --no-renames lista origen y destino.
    salida = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', `${principal}...HEAD`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    process.stderr.write(`No se pudo leer el diff contra ${principal}: ${String(error.stderr || error.message).trim()}\n`);
    process.exit(1);
  }
  const resultado = clasificar(salida.split('\0').filter(Boolean));
  process.stdout.write([resultado.clasificacion, ...resultado.archivos].join('\n') + '\n');
}

if (require.main === module) main();

module.exports = { clasificar, archivosConCodigoPropio };
