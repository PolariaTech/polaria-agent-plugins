// Regla de POL-403: el CLAIM.md solo cubre archivos que existen en la rama principal remota (origin/main).
// Se mira la última copia local de esa rama (los hooks no pueden hacer git fetch en cada edición), nunca la rama ni
// el árbol de trabajo. La usan los hooks, el pre-commit y paralelo.js (reclamar, autorizar, solapes, liberar).

const { execFileSync } = require('child_process');

const normalizar = (ruta) => String(ruta).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

function git(directorio, argumentos) {
  return execFileSync('git', argumentos, {
    cwd: directorio,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 20000,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

// Rama principal remota (origin/HEAD, origin/main u origin/master); null si no hay ninguna.
function ramaBase(directorio) {
  for (const candidata of [
    () => git(directorio, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']),
    () => (git(directorio, ['rev-parse', '--verify', '-q', 'origin/main']), 'origin/main'),
    () => (git(directorio, ['rev-parse', '--verify', '-q', 'origin/master']), 'origin/master'),
  ]) {
    try {
      return candidata();
    } catch {
      // Se prueba la siguiente.
    }
  }
  return null;
}

// Devuelve el subconjunto de `rutas` que existe en origin/main. Si no se puede comprobar (sin rama principal remota o
// git falla) devuelve TODAS: se exige el reclamo como antes, la opción que más protege.
function rutasEnMain(directorio, rutas) {
  const lista = [...new Set((rutas || []).map(normalizar).filter(Boolean))];
  if (!lista.length) return [];
  try {
    const base = ramaBase(directorio);
    if (!base) return lista;
    const existentes = new Set(
      git(directorio, ['-c', 'core.quotepath=false', 'ls-tree', '-r', '--name-only', base, '--', ...lista])
        .split(/\r?\n/)
        .filter(Boolean)
        .map(normalizar)
    );
    return lista.filter((r) => existentes.has(r));
  } catch {
    return lista;
  }
}

function existeEnMain(directorio, ruta) {
  return rutasEnMain(directorio, [ruta]).length > 0;
}

module.exports = { ramaBase, rutasEnMain, existeEnMain };
