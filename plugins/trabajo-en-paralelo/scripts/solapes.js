// Detecta solapes del trabajo local contra el de los demás. Lo usan el CLI (paralelo.js solapes) y el
// hook que corre antes de un git push. Mira tres cosas, de más a menos concreta:
//   1. Conflicto real: git merge-tree simula en memoria el merge contra cada rama remota de otro issue.
//   2. Mismo archivo: ambos cambiaron el mismo archivo desde la base, aunque hoy no choquen.
//   3. Zona reclamada: un archivo propio cae dentro de lo que otro issue reclamó en Linear (caché).
// Y una cuarta, sobre el trabajo propio: archivos modificados fuera de lo que el reclamo propio declaró.

const { execFileSync } = require('child_process');
const lib = require('./lib');

const MAXIMO_DE_RAMAS = 30;

function ramaBase(directorio) {
  for (const candidata of [
    () => lib.git(directorio, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']),
    () => (lib.git(directorio, ['rev-parse', '--verify', '-q', 'origin/main']), 'origin/main'),
    () => (lib.git(directorio, ['rev-parse', '--verify', '-q', 'origin/master']), 'origin/master'),
  ]) {
    try {
      return candidata();
    } catch {
      // Se prueba la siguiente.
    }
  }
  return null;
}

function lineas(texto) {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function archivosPropios(directorio, base) {
  const propios = new Set();
  let puntoComun = null;
  try {
    puntoComun = lib.git(directorio, ['merge-base', base, 'HEAD']);
    lineas(lib.git(directorio, ['diff', '--name-only', `${puntoComun}..HEAD`])).forEach((a) => propios.add(a));
  } catch {
    // Sin base común (repo recién creado): solo cuentan los cambios sin commit.
  }
  try {
    lineas(lib.git(directorio, ['diff', '--name-only', 'HEAD'])).forEach((a) => propios.add(a));
    lineas(lib.git(directorio, ['ls-files', '--others', '--exclude-standard'])).forEach((a) => propios.add(a));
  } catch {
    // HEAD sin commits: no hay nada más que listar.
  }
  return { archivos: [...propios].map(lib.normalizarRuta), tieneCommitsPropios: Boolean(puntoComun) && puntoComun !== lib.git(directorio, ['rev-parse', 'HEAD']) };
}

// merge-tree --write-tree sale con 1 si hay conflicto; devuelve los archivos en conflicto.
function simularMerge(directorio, otraRama) {
  try {
    execFileSync('git', ['merge-tree', '--write-tree', '--name-only', '--no-messages', 'HEAD', otraRama], {
      cwd: directorio,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
    });
    return { conflicto: false, archivos: [] };
  } catch (error) {
    if (error.status === 1) {
      const salida = String(error.stdout || '');
      const [, ...resto] = lineas(salida); // La primera línea es el id del árbol resultante.
      return { conflicto: true, archivos: resto.map(lib.normalizarRuta) };
    }
    return { conflicto: false, archivos: [], noSePudo: true };
  }
}

function ramasDeOtros(directorio, base, repo, issuePropio) {
  let salida = '';
  try {
    salida = lib.git(directorio, ['branch', '-r', '--no-merged', base, '--format=%(refname:short)']);
  } catch {
    return [];
  }
  return lineas(salida)
    .filter((rama) => rama !== base && !/\/HEAD$/.test(rama) && rama !== 'origin')
    .filter((rama) => rama !== `origin/${repo.rama}`)
    .filter((rama) => {
      const issue = lib.issueDeRama(rama.replace(/^origin\//, ''));
      return issue && issue !== issuePropio;
    })
    .slice(0, MAXIMO_DE_RAMAS);
}

function analizar(directorio, opciones = {}) {
  const repo = lib.infoDelRepo(directorio);
  if (!repo) return null;
  const issuePropio = lib.issueDeRama(repo.rama);
  const base = ramaBase(directorio);
  const resultado = { issue: issuePropio, rama: repo.rama, base, conflictos: [], mismoArchivo: [], zonasAjenas: [], fueraDelReclamo: [], archivosPropios: [], avisos: [] };
  if (!base) {
    resultado.avisos.push('No encontré la rama principal (origin/HEAD, origin/main ni origin/master): no se compararon ramas.');
    return resultado;
  }
  if (opciones.fetch) {
    try {
      lib.git(directorio, ['fetch', '--prune', '--quiet', 'origin'], { timeoutMs: 20000 });
    } catch {
      resultado.avisos.push('No pude hacer git fetch: las ramas de los demás pueden estar desactualizadas.');
    }
  }

  const propios = archivosPropios(directorio, base);
  resultado.archivosPropios = propios.archivos;

  for (const otra of ramasDeOtros(directorio, base, repo, issuePropio)) {
    let archivosDeOtra = [];
    try {
      const puntoComun = lib.git(directorio, ['merge-base', base, otra]);
      archivosDeOtra = lineas(lib.git(directorio, ['diff', '--name-only', `${puntoComun}..${otra}`])).map(lib.normalizarRuta);
    } catch {
      continue;
    }
    const compartidos = propios.archivos.filter((a) => archivosDeOtra.includes(a));
    const simulacion = propios.tieneCommitsPropios ? simularMerge(directorio, otra) : { conflicto: false, archivos: [] };
    if (simulacion.noSePudo && !resultado.avisos.some((a) => a.includes('merge-tree'))) {
      resultado.avisos.push('git merge-tree no pudo simular el merge (hace falta Git 2.38 o superior): solo se comparan los archivos cambiados, no las líneas.');
    }
    if (simulacion.conflicto) {
      resultado.conflictos.push({ rama: otra, archivos: simulacion.archivos.length ? simulacion.archivos : compartidos });
    } else if (compartidos.length) {
      resultado.mismoArchivo.push({ rama: otra, archivos: compartidos });
    }
  }

  const cache = lib.leerCache(repo);
  for (const reclamo of lib.reclamosAjenos(cache, issuePropio)) {
    const zonas = [...reclamo.zonas, ...(reclamo.compartidos || [])];
    const archivos = propios.archivos.filter((a) => zonas.some((z) => lib.zonaCubre(z, a)));
    if (archivos.length) resultado.zonasAjenas.push({ issue: reclamo.issue, responsable: reclamo.responsable, rama: reclamo.rama, archivos });
  }
  const propio = lib.reclamoPropio(cache, issuePropio);
  if (propio) {
    const declaradas = [...propio.zonas, ...(propio.compartidos || [])];
    resultado.fueraDelReclamo = propios.archivos.filter((a) => !declaradas.some((z) => lib.zonaCubre(z, a)));
  } else if (issuePropio && propios.archivos.length) {
    resultado.avisos.push(`No hay reclamo vigente de ${issuePropio} en la caché local: corre la skill trabajo-en-paralelo-polaria (modo reclamar).`);
  }
  if (cache && lib.cacheVencida(cache)) {
    resultado.avisos.push(`La caché de reclamos tiene ${Math.round(lib.edadDeCacheEnHoras(cache))} h: corre la skill trabajo-en-paralelo-polaria (modo sincronizar).`);
  }
  return resultado;
}

function hayHallazgos(r) {
  return Boolean(r && (r.conflictos.length || r.mismoArchivo.length || r.zonasAjenas.length || r.fueraDelReclamo.length));
}

function listar(archivos, maximo = 8) {
  const visibles = archivos.slice(0, maximo).map((a) => `\`${a}\``).join(', ');
  return archivos.length > maximo ? `${visibles} y ${archivos.length - maximo} más` : visibles;
}

function formatear(r) {
  if (!r) return 'No estoy dentro de un repo git.';
  const salida = [];
  if (r.conflictos.length) {
    salida.push('CONFLICTO REAL si se mezclan hoy (git merge-tree):');
    r.conflictos.forEach((c) => salida.push(`  - ${c.rama}: ${listar(c.archivos)}`));
  }
  if (r.mismoArchivo.length) {
    salida.push('MISMO ARCHIVO cambiado en otra rama (hoy no chocan, pero van a chocar si siguen editando):');
    r.mismoArchivo.forEach((c) => salida.push(`  - ${c.rama}: ${listar(c.archivos)}`));
  }
  if (r.zonasAjenas.length) {
    salida.push('ARCHIVOS DENTRO DE UNA ZONA RECLAMADA POR OTRO ISSUE:');
    r.zonasAjenas.forEach((c) => salida.push(`  - ${c.issue}${c.responsable ? ` (${c.responsable})` : ''}: ${listar(c.archivos)}`));
  }
  if (r.fueraDelReclamo.length) {
    salida.push(`ARCHIVOS PROPIOS FUERA DE LO QUE ${r.issue} RECLAMÓ (hay que ampliar o corregir el reclamo en Linear):`);
    salida.push(`  - ${listar(r.fueraDelReclamo)}`);
  }
  r.avisos.forEach((a) => salida.push(`AVISO: ${a}`));
  if (!salida.length) salida.push(`Sin solapes: ${r.archivosPropios.length} archivo(s) propio(s) contra la base ${r.base}.`);
  return salida.join('\n');
}

module.exports = { analizar, formatear, hayHallazgos, ramaBase };
