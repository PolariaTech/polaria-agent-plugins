#!/usr/bin/env node
// Hook de inicio de sesión (Claude Code: SessionStart; Cursor: sessionStart) del plugin trabajo-en-paralelo.
// Le dice al asistente, sin que nadie lo pida, en qué estado está el trabajo en paralelo de este repo: si la rama
// actual tiene CLAIM.md y cuáles son sus zonas, si la caché de reclamos está al día y qué zonas tienen reclamadas
// los demás. En una rama de ticket (o con CLAIM.md) también instala el pre-commit de git que cuida el límite de escritura.
// Nunca bloquea ni rompe la sesión: ante cualquier error sale en silencio.

const lib = require('../scripts/lib');
const { instalarPreCommit } = require('../scripts/instalar-pre-commit');

function describirZonas(zonas) {
  return zonas.map((z) => z.ruta + (z.funcion ? `#${z.funcion}` : '')).join(', ');
}

function mensajeParaElAsistente(directorio) {
  const repo = lib.infoDelRepo(directorio);
  if (!repo) return null;
  const issue = lib.issueDeRama(repo.rama);
  const claim = lib.leerClaimPropio(repo.raiz);
  const cache = lib.leerCache(repo);
  const ajenos = lib.reclamosAjenos(cache, issue);
  const inactivos = lib.reclamosInactivos(cache, issue);
  const lineas = [];

  if (issue || claim) {
    try {
      const instalacion = instalarPreCommit(repo.raiz);
      if (instalacion.aviso) lineas.push(`Trabajo en paralelo: ${instalacion.aviso}`);
    } catch {
      // Sin pre-commit el límite sigue protegido por los hooks de edición.
    }
  }

  if (claim && claim.estado === 'ACTIVO') {
    lineas.push(
      `Trabajo en paralelo: esta rama tiene reclamo (${claim.issue || issue || repo.rama}, confianza ${claim.confianza ?? '?'}%). Solo puedes editar dentro de sus zonas y compartidos: ${describirZonas([...claim.zonas, ...(claim.compartidos || [])])}. ` +
        'Fuera de eso el hook te rechaza: no busques otro camino; pídele al usuario que autorice y que él corra "paralelo.js autorizar <ruta>" en su terminal.'
    );
  } else if (issue) {
    lineas.push(`Trabajo en paralelo: la rama ${repo.rama} es de ${issue} y no tiene CLAIM.md. Si vas a modificar código aquí, usa la skill trabajo-en-paralelo-polaria (modo reclamar) antes de editar.`);
  }
  if ((issue || claim) && (!cache || lib.cacheVencida(cache))) {
    lineas.push('La caché de reclamos no existe o tiene más de 4 h: usa la skill trabajo-en-paralelo-polaria (modo sincronizar) para traer los CLAIM.md actuales de las ramas.');
  }

  if (!issue && !claim && !ajenos.length) return null; // Rama sin ticket y sin reclamos de otros: nada que decir.

  if (ajenos.length) {
    lineas.push('Reclamos activos de otros tickets (no edites estas zonas sin coordinarlo; el hook avisa si lo haces):');
    ajenos.slice(0, 8).forEach((r) => lineas.push(`- ${r.issue}${r.responsable ? ` (${r.responsable})` : ''}: ${describirZonas(r.zonas)}`));
    if (ajenos.length > 8) lineas.push(`- y ${ajenos.length - 8} más (node scripts/paralelo.js estado).`);
  }
  if (inactivos.length) {
    lineas.push(`Reclamos inactivos, ignorados (más de ${lib.DIAS_INACTIVIDAD} días sin commits en su rama): ${inactivos.map((r) => r.issue).join(', ')}.`);
  }
  return lineas.length ? lineas.join('\n') : null;
}

lib.leerEvento((evento) => {
  try {
    const mensaje = mensajeParaElAsistente(lib.directorioDelEvento(evento));
    if (!mensaje) return lib.salir(0);
    if (lib.esCursor()) return lib.salir(0, { additional_context: mensaje });
    return lib.salir(0, { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: mensaje } });
  } catch {
    return lib.salir(0);
  }
});
