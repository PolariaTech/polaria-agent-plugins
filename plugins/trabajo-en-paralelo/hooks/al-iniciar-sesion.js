#!/usr/bin/env node
// Hook de inicio de sesión (Claude Code: SessionStart; Cursor: sessionStart) del plugin trabajo-en-paralelo.
// Le dice al asistente, sin que nadie lo pida, en qué estado está el trabajo en paralelo de este repo:
// si la rama actual tiene reclamo, si la caché de reclamos está al día y qué zonas tienen reclamadas los demás.
// Nunca bloquea ni rompe la sesión: ante cualquier error sale en silencio.

const lib = require('../scripts/lib');

function mensajeParaElAsistente(directorio) {
  const repo = lib.infoDelRepo(directorio);
  if (!repo) return null;
  const issue = lib.issueDeRama(repo.rama);
  const cache = lib.leerCache(repo);
  const ajenos = lib.reclamosAjenos(cache, issue);
  const lineas = [];

  if (issue) {
    if (!lib.reclamoPropio(cache, issue)) {
      lineas.push(`Trabajo en paralelo: la rama ${repo.rama} es de ${issue} y no tiene reclamo vigente en la caché local. Si vas a modificar código aquí, usa la skill trabajo-en-paralelo-polaria (modo reclamar) antes de editar.`);
    }
    if (!cache || lib.cacheVencida(cache)) {
      lineas.push('La caché de reclamos no existe o tiene más de 4 h: usa la skill trabajo-en-paralelo-polaria (modo sincronizar) para traer los reclamos actuales de Linear.');
    }
  } else if (!ajenos.length) {
    return null; // Rama sin issue y sin reclamos de otros: nada que decir.
  }

  if (ajenos.length) {
    lineas.push(`Reclamos activos de otros issues (no edites estas zonas sin coordinarlo; el hook avisa si lo haces):`);
    ajenos.slice(0, 8).forEach((r) => {
      const zonas = r.zonas.map((z) => z.ruta + (z.funcion ? `#${z.funcion}` : '')).join(', ');
      lineas.push(`- ${r.issue}${r.responsable ? ` (${r.responsable})` : ''}: ${zonas}`);
    });
    if (ajenos.length > 8) lineas.push(`- y ${ajenos.length - 8} más (node scripts/paralelo.js estado).`);
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
