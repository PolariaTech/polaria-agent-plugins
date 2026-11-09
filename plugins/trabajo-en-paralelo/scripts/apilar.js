// POL-411: apilar la rama de un ticket sobre el PR abierto de otro para evitar conflictos.
// 1. informe: busca con gh los PR abiertos que tocan las zonas del ticket y ofrece apilar o esperar. Solo habla si hay un
//    PR que toca los mismos archivos; sin solape, sin gh o sin sesión no cambia nada del flujo (siempre código 0).
// 2. prepararPadre / registrarApilado: usados por "iniciar-rama --base <padre>". La rama nueva sale del padre, guarda su
//    nombre en la config de git (lo lee main-remoto.js: así la hija reclama los archivos que solo existen en el padre) y se
//    quita el CLAIM.md heredado del padre.

const { spawnSync } = require('child_process');
const lib = require('./lib');
const { zonaDeTexto } = require('./claims');

const WORKFLOW_REAPUNTADO = '.github/workflows/auto-rebase-stacked-prs.yml';

// POLARIA_PARALELO_GH apunta a un .js que hace de gh: solo lo usan las pruebas.
function correrGh(directorio, argumentos) {
  const simulado = process.env.POLARIA_PARALELO_GH;
  const r = spawnSync(simulado ? process.execPath : 'gh', simulado ? [simulado, ...argumentos] : argumentos, { cwd: directorio, encoding: 'utf8', timeout: 30000 });
  if (r.error || r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

// PR abiertos (de otros tickets) con los archivos de las zonas que tocan. Devuelve null si no se pudo consultar gh.
function prsQueTocan(directorio, zonas, issuePropio) {
  const prs = correrGh(directorio, ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,headRefName,baseRefName,files']);
  if (!Array.isArray(prs)) return null;
  const mias = zonas.map(zonaDeTexto).filter((z) => z.ruta);
  return prs
    .filter((pr) => !issuePropio || lib.issueDeRama(pr.headRefName) !== issuePropio)
    .map((pr) => ({ numero: pr.number, rama: pr.headRefName, base: pr.baseRefName, archivos: (pr.files || []).map((f) => lib.normalizarRuta(f.path)).filter((a) => mias.some((z) => lib.zonaCubre(z, a))) }))
    .filter((pr) => pr.archivos.length);
}

function tieneWorkflowDeReapuntado(directorio) {
  const base = lib.ramaBase(directorio);
  if (!base) return false;
  try {
    lib.git(directorio, ['cat-file', '-e', `${base}:${WORKFLOW_REAPUNTADO}`]);
    return true;
  } catch {
    return false;
  }
}

function informe(repo, zonas, issuePropio) {
  const prs = prsQueTocan(repo.raiz, zonas, issuePropio);
  if (prs === null) return 'AVISO: no pude consultar los PR abiertos (gh no está disponible o no hay sesión); sigue desde la rama principal.';
  if (!prs.length) return 'Sin PR abiertos que toquen tus archivos: sigue desde la rama principal.';
  const salida = prs.map((pr) => `PR ABIERTO #${pr.numero} (rama ${pr.rama}, base ${pr.base}) toca: ${pr.archivos.map((a) => `\`${a}\``).join(', ')}`);
  const reapunta = tieneWorkflowDeReapuntado(repo.raiz);
  salida.push(`Reapuntado automático al mergear el PR padre (${WORKFLOW_REAPUNTADO}): ${reapunta ? 'sí' : 'no'}.`);
  salida.push('Opciones:');
  salida.push(`  1. Apilar: paralelo.js iniciar-rama <rama> --base ${prs[0].rama} y, al crear el PR, gh pr create --base ${prs[0].rama}.${reapunta ? '' : ' NO recomendado: este repo no tiene el workflow de reapuntado.'}`);
  salida.push(`  2. Esperar el merge de ${prs.length > 1 ? 'esos PR' : `#${prs[0].numero}`} y seguir desde la rama principal${reapunta ? '' : ' (recomendado)'}.`);
  return salida.join('\n');
}

// Resuelve la rama padre de "--base". Devuelve { ref } con la referencia desde la que sale la rama nueva, o { error }.
function prepararPadre(raiz, padre, base) {
  if (!/^[\w./-]+$/.test(padre)) return { error: 'Uso: --base <rama-padre> (solo letras, números, ., _, - y /).' };
  if (`origin/${padre}` === base || padre === base) return { error: `--base ${padre} es la rama principal: no hay nada que apilar. Repite sin --base.` };
  for (const ref of [`refs/remotes/origin/${padre}`, `refs/heads/${padre}`]) {
    try {
      lib.git(raiz, ['rev-parse', '--verify', '-q', ref]);
      return { ref };
    } catch {
      // Se prueba la siguiente.
    }
  }
  return { error: `No encontré la rama padre ${padre} (ni en origin ni local). Revisa el nombre con gh pr list.` };
}

// Guarda el padre en la config de la rama y quita el CLAIM.md que heredó (el reclamo es de otro ticket).
function registrarApilado(repo, rama, padre) {
  const salida = [];
  lib.git(repo.raiz, ['config', `branch.${rama}.polaria-base`, padre]);
  salida.push(`Rama apilada sobre ${padre}: tus reclamos también cubren los archivos que solo existen en el PR padre.`);
  const heredado = spawnSync('git', ['ls-files', '--error-unmatch', lib.ARCHIVO_RECLAMO], { cwd: repo.raiz, encoding: 'utf8' });
  if (heredado.status !== 0) return salida;
  lib.registrarAutorizado(repo, lib.HASH_ELIMINADO);
  const git = (...argumentos) => spawnSync('git', argumentos, { cwd: repo.raiz, encoding: 'utf8' });
  const quitado = git('rm', '-q', '--', lib.ARCHIVO_RECLAMO);
  const commit = quitado.status === 0 ? git('commit', '-q', '-m', `claim: quita el CLAIM.md heredado de ${padre}`, '--', lib.ARCHIVO_RECLAMO) : quitado;
  salida.push(commit.status === 0 ? `Se quitó el CLAIM.md heredado de ${padre} (commit local).` : `AVISO: no pude quitar el CLAIM.md heredado: ${(commit.stderr || '').trim()}`);
  return salida;
}

module.exports = { informe, prsQueTocan, prepararPadre, registrarApilado };
