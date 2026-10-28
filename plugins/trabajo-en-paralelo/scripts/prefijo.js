// Prefijo del nombre de la rama (dani/, lucho/, mauro/). Sale del nombre del dev en git (git config user.name) o, si ese
// nombre no se reconoce, del nombre del usuario en Linear. NUNCA del usuario del sistema operativo del PC: así quedó una
// rama de Lucho como "daniel/req-172-...". Si ningún nombre se reconoce no se inventa un prefijo: se devuelve null.

const lib = require('./lib');
const alias = require('./prefijos.json');

// Minúsculas, sin tildes y solo letras y números separados por espacios.
function normalizarNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// "Daniel De Jesus Galvis Zambrano" -> "dani"; un nombre fuera de la tabla -> null.
function prefijoDeNombre(nombre) {
  const primera = normalizarNombre(nombre).split(' ')[0];
  return primera && Object.prototype.hasOwnProperty.call(alias, primera) ? alias[primera] : null;
}

function nombreEnGit(directorio) {
  try {
    return lib.git(directorio, ['config', '--get', 'user.name']);
  } catch {
    return '';
  }
}

// { prefijo, fuente, nombre } o { prefijo: null, motivo }.
function resolverPrefijo(directorio, nombreEnLinear) {
  const intentados = [];
  for (const [fuente, nombre] of [['git', nombreEnGit(directorio)], ['Linear', nombreEnLinear || '']]) {
    if (!nombre) continue;
    const prefijo = prefijoDeNombre(nombre);
    if (prefijo) return { prefijo, fuente, nombre };
    intentados.push(`${fuente}: "${nombre}"`);
  }
  const motivo = intentados.length
    ? `No reconozco ningún nombre (${intentados.join('; ')}). Pregúntale al dev qué prefijo usa (${[...new Set(Object.entries(alias).filter(([k]) => k[0] !== '_').map(([, v]) => v))].join(', ')}) o agrega su nombre en scripts/prefijos.json.`
    : 'No hay nombre en git (git config user.name) ni me pasaron el de Linear (--linear "Nombre"). Pregúntale al dev qué prefijo usa; no uses el usuario del PC.';
  return { prefijo: null, motivo };
}

module.exports = { normalizarNombre, prefijoDeNombre, resolverPrefijo };
