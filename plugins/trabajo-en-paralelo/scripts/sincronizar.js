// Revisa, antes de trabajar, si hay cambios nuevos por descargar, para que nadie trabaje con código viejo.
// Lo usan el hook de inicio de sesión, `paralelo.js sincronizar` y `paralelo.js iniciar-rama`.
//
// Hace git fetch y compara la rama actual contra su remota (o contra la principal, si estás en ella). Solo descarga
// cuando es seguro: sin cambios sin guardar y con un avance limpio (--ff-only). En cualquier otro caso avisa y no toca
// la rama. Si el fetch falla (sin red, sin permisos) avisa y deja trabajar: nunca bloquea por un fallo de red.

const lib = require('./lib');
const { ramaBase } = require('./solapes');

const existe = (raiz, ref) => {
  try {
    lib.git(raiz, ['rev-parse', '--verify', '-q', ref]);
    return true;
  } catch {
    return false;
  }
};

const contar = (raiz, rango) => Number(lib.git(raiz, ['rev-list', '--count', rango]));
const commits = (n) => `${n} commit${n === 1 ? '' : 's'}`;

// Devuelve { comprobado, descargados, lineas }. No lanza: ante un error inesperado lo dice en una línea.
function sincronizar(repo, { timeoutMs = 20000 } = {}) {
  const lineas = [];
  try {
    lib.git(repo.raiz, ['fetch', '--prune', '--quiet', 'origin'], { timeoutMs });
  } catch {
    return {
      comprobado: false,
      descargados: 0,
      lineas: ['Trabajo en paralelo: no pude comprobar si hay cambios nuevos por descargar (git fetch falló: sin red o sin permisos). Puedes trabajar, pero tu copia podría estar desactualizada: avísale al dev.'],
    };
  }
  if (!repo.rama) return { comprobado: true, descargados: 0, lineas };

  try {
    const base = ramaBase(repo.raiz);
    const principal = base ? base.replace(/^origin\//, '') : null;
    const remotaPropia = `origin/${repo.rama}`;
    const objetivo = repo.rama === principal ? base : existe(repo.raiz, `refs/remotes/${remotaPropia}`) ? remotaPropia : null;
    let descargados = 0;

    if (objetivo) {
      const atras = contar(repo.raiz, `HEAD..${objetivo}`);
      const adelante = contar(repo.raiz, `${objetivo}..HEAD`);
      if (atras > 0) {
        const sucio = lib.git(repo.raiz, ['status', '--porcelain']);
        if (adelante > 0) {
          lineas.push(`Trabajo en paralelo: ${repo.rama} y ${objetivo} divergieron (${commits(atras)} por descargar y ${commits(adelante)} tuyos sin publicar). No descargué nada: decide con el dev si hace rebase o merge.`);
        } else if (sucio) {
          lineas.push(`Trabajo en paralelo: ${repo.rama} está atrás por ${commits(atras)} de ${objetivo} y tienes cambios sin guardar, así que no descargué nada. Guárdalos (commit) y corre "git pull --ff-only" antes de seguir.`);
        } else {
          try {
            lib.git(repo.raiz, ['merge', '--ff-only', '--quiet', objetivo], { timeoutMs: 60000 });
            descargados = atras;
            lineas.push(`Trabajo en paralelo: ${commits(atras)} ${atras === 1 ? 'descargado' : 'descargados'} de ${objetivo}. Tu copia ya está al día.`);
          } catch {
            lineas.push(`Trabajo en paralelo: ${repo.rama} está atrás por ${commits(atras)} de ${objetivo} y no pude descargarlos (git merge --ff-only falló). Avísale al dev.`);
          }
        }
      }
    }

    // En una rama de ticket, la principal puede haber avanzado: solo se avisa, integrarla (rebase o merge) lo decide el dev.
    if (base && repo.rama !== principal) {
      const atrasDeLaPrincipal = contar(repo.raiz, `HEAD..${base}`);
      if (atrasDeLaPrincipal > 0) {
        lineas.push(`Trabajo en paralelo: ${base} tiene ${commits(atrasDeLaPrincipal)} que ${repo.rama} no tiene. No los integré: antes de abrir el PR, pregúntale al dev si hace rebase o merge.`);
      }
    }
    return { comprobado: true, descargados, lineas };
  } catch (error) {
    return { comprobado: true, descargados: 0, lineas: [`Trabajo en paralelo: no pude comparar tu copia con la remota (${String(error.message).split('\n')[0]}).`] };
  }
}

module.exports = { sincronizar };
