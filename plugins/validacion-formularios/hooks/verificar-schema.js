#!/usr/bin/env node
// Hook del plugin validacion-formularios, compartido por Claude Code y Cursor.
// Después de que la IA escribe un `schemas/schema_*.md`, avisa si quedó texto de plantilla
// entre corchetes (ej. `[Sí/No]`) copiado de PLANTILLA_SCHEMA_DE_CAMPOS: la regla de "cero
// relleno" del Paso 1 de PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md.
//
// Los textos de plantilla se leen de la propia plantilla, así que se actualizan solos si
// cambia. Un dato marcado `PENDIENTE` no es texto de plantilla (Excepción 2) y no se avisa.
//
// Claude Code (PostToolUse sobre Write|Edit|MultiEdit, hooks.json): recibe
//   { hook_event_name: "PostToolUse", tool_input: { file_path }, cwd };
//   salida 0 = nada que decir, salida 2 = el mensaje de stderr vuelve a Claude.
// Cursor (postToolUse sobre Write, cursor-hooks.json): recibe
//   { hook_event_name: "postToolUse", tool_input, cwd | workspace_roots };
//   no puede bloquear: responde por stdout { additional_context } para avisar al agente.

const fs = require('fs');
const path = require('path');

const NOMBRE_PLANTILLA = 'PLANTILLA_SCHEMA_DE_CAMPOS_v1.1.md';
const RUTAS_PLANTILLA = [
  // Dentro del plugin publicado.
  path.join(__dirname, '..', 'skills', 'validacion-formularios-polaria', 'references', NOMBRE_PLANTILLA),
  // Copia canónica en el repo de metodología.
  path.join(__dirname, '..', '..', '..', 'SCHEMAS_FORMULARIOS', NOMBRE_PLANTILLA),
];
// Si no se encuentra la plantilla, se buscan al menos los textos de plantilla más comunes.
const TEXTOS_PLANTILLA_MINIMOS = ['[Sí/No]', '[nombre_del_campo]', '[DD/MM/AAAA]', '[Mensaje exacto]', '[Front, Back, BD]'];

const ES_SCHEMA = /(^|[\\/])schemas[\\/]schema_[^\\/]+\.md$/i;

let esCursor = false;

function nadaQueDecir() {
  if (esCursor) process.stdout.write('{}');
  process.exit(0);
}

function avisar(mensaje) {
  if (esCursor) {
    process.stdout.write(JSON.stringify({ additional_context: mensaje }));
    process.exit(0);
  }
  process.stderr.write(`${mensaje}\n`);
  process.exit(2);
}

const normalizar = (texto) => texto.replace(/\s+/g, ' ').trim();

function textosDePlantilla() {
  for (const ruta of RUTAS_PLANTILLA) {
    let plantilla;
    try {
      plantilla = fs.readFileSync(ruta, 'utf8');
    } catch {
      continue;
    }
    // Solo la parte que se copia al entregable; lo anterior son instrucciones y glosario.
    const inicio = plantilla.indexOf('## Estructura a copiar en el entregable');
    const estructura = inicio >= 0 ? plantilla.slice(inicio) : plantilla;
    // `[texto]` que no es un enlace markdown `[texto](url)`.
    const encontrados = estructura.match(/\[[^\]]+\](?!\()/g) || [];
    return [...new Set(encontrados.map(normalizar))];
  }
  return TEXTOS_PLANTILLA_MINIMOS;
}

let entrada = '';
process.stdin.on('data', (fragmento) => (entrada += fragmento));
process.stdin.on('end', () => {
  let archivo;
  try {
    const evento = JSON.parse(entrada.replace(/^\uFEFF/, ''));
    esCursor = evento.hook_event_name === 'postToolUse';
    const parametros = evento.tool_input || {};
    const ruta = parametros.file_path || parametros.path || parametros.target_file || evento.file_path || '';
    const directorio =
      evento.cwd || (evento.workspace_roots && evento.workspace_roots[0]) || process.env.CURSOR_PROJECT_DIR || process.cwd();
    archivo = ruta ? path.resolve(directorio, ruta) : '';
  } catch {
    nadaQueDecir(); // Evento ilegible: no es responsabilidad de este hook decidir.
  }

  if (!archivo || !ES_SCHEMA.test(archivo)) nadaQueDecir();

  let contenido;
  try {
    contenido = normalizar(fs.readFileSync(archivo, 'utf8'));
  } catch {
    nadaQueDecir(); // El archivo no existe (ej. se borró): nada que verificar.
  }

  const pendientes = textosDePlantilla().filter((texto) => contenido.includes(texto));
  if (pendientes.length === 0) nadaQueDecir();

  avisar(
    `Validación de Formularios: ${path.basename(archivo)} todavía tiene texto de plantilla sin reemplazar: ` +
      `${pendientes.slice(0, 8).join(', ')}${pendientes.length > 8 ? ` (y ${pendientes.length - 8} más)` : ''}. ` +
      'Pregúntale al dev cada uno de esos datos (nunca los completes tú) o márcalo PENDIENTE si no puede darlo ahora. ' +
      'No escribas código de validación hasta que el schema esté completo (Paso 1 de PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md).'
  );
});
