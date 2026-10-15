// Decide si un repo es de desarrollo de software (front, back o ambos), el único donde aplica el
// Gate de Calidad Técnica Pre-Merge. Lo usan instalar-pre-push.js y verificar-gate.js.
//
// Es de software si la raíz o una carpeta de primer nivel (ej. front/, back/) tiene un manifiesto de
// proyecto. Un repo de documentación, de plugins con scripts sueltos o de workflows n8n (solo
// workflows/) no lo tiene, así que el gate no se instala ni bloquea ahí.

const fs = require('fs');
const path = require('path');

const MANIFIESTOS = new Set([
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'composer.json',
  'Gemfile',
]);
const EXTENSIONES_MANIFIESTO = ['.csproj', '.sln'];
const CARPETAS_IGNORADAS = new Set(['node_modules']);

function leerCarpeta(carpeta) {
  try {
    return fs.readdirSync(carpeta, { withFileTypes: true });
  } catch {
    return [];
  }
}

function tieneManifiesto(entradas) {
  return entradas.some(
    (entrada) =>
      entrada.isFile() &&
      (MANIFIESTOS.has(entrada.name) || EXTENSIONES_MANIFIESTO.some((extension) => entrada.name.endsWith(extension)))
  );
}

function esRepoDeSoftware(raizDelRepo) {
  const entradas = leerCarpeta(raizDelRepo);
  if (tieneManifiesto(entradas)) return true;
  return entradas.some(
    (entrada) =>
      entrada.isDirectory() &&
      !entrada.name.startsWith('.') &&
      !CARPETAS_IGNORADAS.has(entrada.name) &&
      tieneManifiesto(leerCarpeta(path.join(raizDelRepo, entrada.name)))
  );
}

module.exports = { esRepoDeSoftware };
