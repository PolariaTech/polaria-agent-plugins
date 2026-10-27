#!/usr/bin/env node
// Hook de edición del plugin trabajo-en-paralelo: el asistente NO puede escribir fuera de las zonas y compartidos del
// CLAIM.md de la rama, salvo que el usuario lo autorice. Rechaza siempre (no depende de POLARIA_PARALELO_MODO).
//
// Aplica solo si el repo del archivo tiene un CLAIM.md ACTIVO; en una rama sin reclamo no hace nada (solo avisa
// avisar-zona-ajena.js). Rechaza tres cosas:
//   1. Editar un archivo fuera de lo que reclama el CLAIM.md (capa 1).
//   2. Escribir el CLAIM.md a mano: solo lo escriben paralelo.js reclamar / autorizar / liberar (capa 2). Esto se
//      rechaza aunque la rama aún no tenga reclamo, para que nadie lo fabrique saltándose el cruce con otras ramas.
//   3. Editar los archivos del plugin, su caché y los hooks de git, que es como el asistente se saltaría el límite.
//
// Claude Code (PreToolUse sobre Edit|Write|MultiEdit|NotebookEdit): rechaza con código 2 y el motivo por stderr.
// Cursor (preToolUse): responde { permission: 'deny' }; postToolUse no hace nada.
// Ante cualquier error deja pasar: un hook de límite no debe romper la sesión por una falla propia.

const path = require('path');
const lib = require('../scripts/lib');

const RAIZ_PLUGIN = path.resolve(__dirname, '..');

function dentroDe(ruta, carpeta) {
  const relativa = path.relative(carpeta, ruta);
  return relativa === '' || (!relativa.startsWith('..') && !path.isAbsolute(relativa));
}

function comandoAutorizar(destino) {
  return `node "${path.join(RAIZ_PLUGIN, 'scripts', 'paralelo.js')}" autorizar ${destino}`;
}

// Devuelve el motivo del rechazo, o null si la edición puede seguir.
function evaluar(evento) {
  const destino = lib.resolverArchivoDeEdicion(evento);
  if (!destino) return null;
  const sesion = lib.infoDelRepo(lib.directorioDelEvento(evento));
  const repos = [destino.repo, sesion].filter(Boolean);

  if (destino.repo && destino.relativa === lib.ARCHIVO_RECLAMO) {
    return (
      'Trabajo en paralelo: el CLAIM.md no se edita a mano. Se crea con "paralelo.js reclamar", se amplía con ' +
      '"paralelo.js autorizar" (lo corre el usuario en su terminal) y se borra con "paralelo.js liberar". No busques otro camino para escribirlo.'
    );
  }

  const claim = destino.repo ? lib.leerClaimPropio(destino.repo.raiz) : null;
  const conReclamo = repos.filter((r) => {
    const propio = lib.leerClaimPropio(r.raiz);
    return propio && propio.estado === 'ACTIVO';
  });
  if (!conReclamo.length) return null;

  const protegidos = repos.flatMap((r) => [path.join(r.directorioComun, 'polaria-paralelo'), path.join(r.directorioComun, 'hooks')]);
  // El plugin instalado vive fuera del repo reclamado y se protege. Si se desarrolla dentro del propio repo reclamado
  // (aunque el plugin instalado esté dentro de algún otro clon de git), rigen las zonas del CLAIM.md como en cualquier archivo.
  const plugin = lib.rutaReal(RAIZ_PLUGIN);
  if (!conReclamo.some((r) => dentroDe(plugin, lib.rutaReal(r.raiz)))) protegidos.push(RAIZ_PLUGIN);
  if (protegidos.some((p) => dentroDe(destino.real, lib.rutaReal(p)))) {
    return 'Trabajo en paralelo: los archivos del plugin trabajo-en-paralelo, su caché y los hooks de git no se editan durante una tarea con CLAIM.md. No busques otro camino.';
  }

  if (!claim || claim.estado !== 'ACTIVO' || !destino.relativa) return null;
  if (lib.claimCubreArchivo(claim, destino.relativa)) return null;
  return (
    `Trabajo en paralelo: no puedes editar \`${destino.relativa}\`: está fuera de las zonas y compartidos del CLAIM.md de esta rama (${claim.issue || destino.repo.rama}). ` +
    'No busques otro camino para escribirlo (ni por la terminal ni tocando el CLAIM.md). Dile al usuario que ese archivo está fuera de lo reclamado y pregúntale si autoriza ampliarlo. ' +
    `Solo si acepta, él debe correr en su terminal: ${comandoAutorizar(destino.relativa)} . Hasta entonces, no edites ese archivo.`
  );
}

lib.leerEvento((evento) => {
  try {
    const cursor = lib.esCursor() || /^[a-z]/.test(evento.hook_event_name || '');
    const momento = String(evento.hook_event_name || '').toLowerCase();
    if (cursor && momento === 'posttooluse') return lib.salir(0);
    const motivo = evaluar(evento);
    if (!motivo) return cursor ? lib.salir(0, { permission: 'allow' }) : lib.salir(0);
    if (cursor) return lib.salir(2, { permission: 'deny', user_message: motivo, agent_message: motivo });
    process.stderr.write(`${motivo}\n`);
    return lib.salir(2);
  } catch {
    return lib.salir(0);
  }
});
