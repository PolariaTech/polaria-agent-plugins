#!/usr/bin/env node
// Hook de edición del plugin trabajo-en-paralelo. Avisa cuando el asistente va a editar (o acaba de editar)
// un archivo que otro issue reclamó en Linear.
//
// Claude Code (PreToolUse sobre Edit|Write|MultiEdit, hooks.json): recibe { tool_input: { file_path }, cwd };
//   responde por stdout con additionalContext (el asistente lo ve junto al resultado) y systemMessage (lo ve el dev).
// Cursor: preToolUse solo actúa en modo bloquear; postToolUse (matcher Write) avisa con additional_context.
// Modo: aviso por defecto. Con la variable POLARIA_PARALELO_MODO=bloquear, Claude Code y Cursor rechazan la edición.
// Un mismo archivo y reclamo se avisan una sola vez cada 30 minutos para no repetir el mensaje en cada edición.
// Lee la caché que deja la skill (reclamos.json); no llama a Linear. Ante cualquier error sale en silencio.

const fs = require('fs');
const path = require('path');
const lib = require('../scripts/lib');

const MINUTOS_SIN_REPETIR = 30;

function directorioExistente(ruta) {
  let actual = path.dirname(ruta);
  while (actual && !fs.existsSync(actual)) {
    const padre = path.dirname(actual);
    if (padre === actual) return null;
    actual = padre;
  }
  return actual;
}

function yaAvisado(repo, clave) {
  const archivo = path.join(repo.directorioCache, 'avisados.json');
  let avisados = {};
  try {
    avisados = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch {
    // Primera vez.
  }
  const ahora = Date.now();
  if (avisados[clave] && ahora - avisados[clave] < MINUTOS_SIN_REPETIR * 60000) return true;
  avisados[clave] = ahora;
  for (const [k, v] of Object.entries(avisados)) if (ahora - v > 24 * 3600000) delete avisados[k];
  try {
    fs.mkdirSync(repo.directorioCache, { recursive: true });
    fs.writeFileSync(archivo, JSON.stringify(avisados));
  } catch {
    // Sin escritura no se deduplica; el aviso sale de todos modos.
  }
  return false;
}

function evaluar(evento) {
  const entrada = evento.tool_input || {};
  const archivo = entrada.file_path || entrada.path || entrada.target_file || evento.file_path;
  if (!archivo) return null;
  const rutaAbsoluta = path.isAbsolute(String(archivo).replace(/^\/([a-zA-Z]:)/, '$1'))
    ? String(archivo).replace(/^\/([a-zA-Z]:)/, '$1')
    : path.join(lib.directorioDelEvento(evento), archivo);
  const real = lib.rutaReal(rutaAbsoluta);
  const directorio = directorioExistente(real);
  const repo = directorio && lib.infoDelRepo(directorio);
  if (!repo) return null;
  const relativa = lib.rutaRelativaAlRepo(lib.rutaReal(repo.raiz), real);
  if (relativa.startsWith('..') || relativa.startsWith('.git/')) return null;

  const cache = lib.leerCache(repo);
  const issuePropio = lib.issueDeRama(repo.rama);
  const choques = lib.reclamosAjenos(cache, issuePropio).filter((r) =>
    [...r.zonas, ...(r.compartidos || [])].some((zona) => lib.zonaCubre(zona, relativa))
  );
  if (!choques.length) return null;

  const detalle = choques
    .map((r) => {
      const zona = r.zonas.find((z) => lib.zonaCubre(z, relativa)) || r.compartidos.find((z) => lib.zonaCubre(z, relativa));
      return `${r.issue}${r.responsable ? ` (${r.responsable})` : ''} reclamó \`${zona.ruta}${zona.funcion ? `#${zona.funcion}` : ''}\`${r.rama ? `, rama ${r.rama}` : ''}`;
    })
    .join('; ');
  const mensaje =
    `Trabajo en paralelo: \`${relativa}\` está en una zona reclamada por otro issue — ${detalle}. ` +
    `Antes de seguir, avísale al dev y propón coordinar con esa persona (cambio mínimo y aislado, o cambiar el orden de las tareas). ` +
    `Si el cambio es inevitable, hay que ampliar tu reclamo en Linear (skill trabajo-en-paralelo-polaria, modo reclamar) y dejar constancia del solape.`;
  return { mensaje, clave: `${relativa}|${choques.map((r) => r.issue).sort().join(',')}`, repo };
}

lib.leerEvento((evento) => {
  try {
    const cursor = lib.esCursor() || /^[a-z]/.test(evento.hook_event_name || '');
    const momento = String(evento.hook_event_name || '').toLowerCase(); // pretooluse | posttooluse
    const bloquear = lib.modoBloquear();
    // En Cursor, preToolUse solo sirve para bloquear y postToolUse solo para avisar.
    if (cursor && momento === 'pretooluse' && !bloquear) return lib.salir(0, { permission: 'allow' });
    if (cursor && momento === 'posttooluse' && bloquear) return lib.salir(0);

    const hallazgo = evaluar(evento);
    if (!hallazgo) return cursor && momento === 'pretooluse' ? lib.salir(0, { permission: 'allow' }) : lib.salir(0);
    if (!bloquear && yaAvisado(hallazgo.repo, hallazgo.clave)) return lib.salir(0);

    if (cursor) {
      if (momento === 'pretooluse') return lib.salir(2, { permission: 'deny', user_message: hallazgo.mensaje, agent_message: hallazgo.mensaje });
      return lib.salir(0, { additional_context: hallazgo.mensaje });
    }
    if (bloquear) {
      process.stderr.write(`${hallazgo.mensaje}\n`);
      return lib.salir(2);
    }
    return lib.salir(0, {
      systemMessage: hallazgo.mensaje,
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: hallazgo.mensaje },
    });
  } catch {
    return lib.salir(0);
  }
});
