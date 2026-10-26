#!/usr/bin/env node
// Hook de push del plugin trabajo-en-paralelo. Antes de un `git push` hecho por el asistente, revisa la rama
// contra las ramas remotas de los demás issues y contra sus reclamos (scripts/solapes.js) y muestra los solapes.
//
// Claude Code (PreToolUse sobre Bash, hooks.json): recibe { tool_input: { command }, cwd }.
// Cursor (beforeShellExecution, cursor-hooks.json): recibe { command, cwd }; responde { permission, ... }.
// Modo: aviso por defecto (el push sigue). Con POLARIA_PARALELO_MODO=bloquear, un conflicto real bloquea el push
// hasta coordinarlo. Convive con el hook del gate de calidad: este solo informa, el gate es el que exige veredicto.
// Ante cualquier error sale en silencio: este hook nunca debe impedir un push por una falla propia.

const lib = require('../scripts/lib');
const { analizar, formatear, hayHallazgos } = require('../scripts/solapes');

// `git push` como comando (al inicio o tras ; && || | ( o salto de línea, con variables de entorno opcionales delante):
// no la frase "git push" dentro de un echo, un mensaje de commit o un argumento.
const ES_PUSH = /(?:^|[;&|(\n])\s*(?:\w+=\S*\s+)*git(?:\s+-[Cc]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+push\b/;
const SOLO_BORRA_RAMA = /\bpush\b[^;&|\n]*(--delete\b|\s-d\b)/;

lib.leerEvento((evento) => {
  try {
    const cursor = lib.esCursor() || !evento.tool_input;
    const comando = (cursor ? evento.command : evento.tool_input && evento.tool_input.command) || '';
    const permitir = () => (cursor ? lib.salir(0, { permission: 'allow' }) : lib.salir(0));
    if (!ES_PUSH.test(comando) || SOLO_BORRA_RAMA.test(comando)) return permitir();

    const resultado = analizar(lib.directorioDelEvento(evento), { fetch: true });
    if (!hayHallazgos(resultado)) return permitir();

    const informe = formatear(resultado);
    const cierre = resultado.conflictos.length
      ? 'Antes de publicar, avísale al dev y propón coordinar con el dueño de esa rama (rebase sobre su rama cuando la mergee, o repartir los archivos).'
      : 'El push puede seguir, pero avísale al dev de estos solapes para que los coordine pronto.';
    const mensaje = `Trabajo en paralelo — revisión previa al push de ${resultado.rama || 'la rama actual'}:\n${informe}\n${cierre}`;

    if (lib.modoBloquear() && resultado.conflictos.length) {
      if (cursor) return lib.salir(2, { permission: 'deny', user_message: mensaje, agent_message: mensaje });
      process.stderr.write(`${mensaje}\n`);
      return lib.salir(2);
    }
    if (cursor) return lib.salir(0, { permission: 'allow', user_message: mensaje, agent_message: mensaje });
    return lib.salir(0, { systemMessage: mensaje, hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: mensaje } });
  } catch {
    return lib.salir(0);
  }
});
