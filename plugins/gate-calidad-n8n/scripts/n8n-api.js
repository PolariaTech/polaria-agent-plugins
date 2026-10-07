// Acceso de solo lectura a la API pública de n8n para el plugin gate-calidad-n8n.
// Lo usan descargar-workflow.js y el hook verificar-publicacion.js. La clave vive en la variable de
// entorno N8N_API_KEY de cada persona (nunca en el repo ni en el chat) y solo necesita el scope
// workflow:read. La URL de la instancia se puede cambiar con N8N_API_URL.

const URL_INSTANCIA = (process.env.N8N_API_URL || 'https://polariatech.app.n8n.cloud').replace(/\/+$/, '');
const TIEMPO_MAXIMO_MS = 15000;

const GUIA_CLAVE = `Gate de Calidad N8N: falta configurar la clave de la API de n8n (variable de entorno N8N_API_KEY).
Se configura una sola vez por persona:

1. En n8n (${URL_INSTANCIA}): Settings → n8n API → Create an API key.
   - Label: gate-calidad-n8n
   - Expiration: 90 días
   - Scopes: Custom, y marca solo workflow:read. Nada más.
   Copia la clave: n8n no la vuelve a mostrar.

2. Guárdala como variable de entorno de tu usuario, en una terminal APARTE (nunca en el chat del
   asistente ni con "! comando", porque quedaría en el historial de la conversación):
   - Windows (PowerShell):
       [Environment]::SetEnvironmentVariable('N8N_API_KEY', 'pega-aquí-la-clave', 'User')
   - macOS o Linux: abre ~/.zshrc (o ~/.bashrc) con un editor y agrega la línea
       export N8N_API_KEY='pega-aquí-la-clave'

3. Cierra y vuelve a abrir Claude Code o Cursor (los programas abiertos no ven la variable nueva).

4. Comprueba en una terminal nueva (muestra solo el largo, no la clave):
   - Windows: $env:N8N_API_KEY.Length
   - macOS o Linux: echo \${#N8N_API_KEY}
   Debe dar un número mayor que 0.

Nunca la pongas en el repo (.env, .claude/settings.local.json, archivos del plugin), en un issue de
Linear ni en el chat. Al vencer a los 90 días, crea una nueva y repite el paso 2.`;

class ErrorApi extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.codigo = codigo; // SIN_CLAVE | CLAVE_INVALIDA | SIN_PERMISO | NO_EXISTE | RED | RESPUESTA
  }
}

async function pedir(ruta) {
  const clave = (process.env.N8N_API_KEY || '').trim();
  if (!clave) throw new ErrorApi(GUIA_CLAVE, 'SIN_CLAVE');
  let respuesta;
  try {
    respuesta = await fetch(`${URL_INSTANCIA}/api/v1${ruta}`, {
      headers: { 'X-N8N-API-KEY': clave, accept: 'application/json' },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch (error) {
    throw new ErrorApi(`No se pudo conectar con la API de n8n en ${URL_INSTANCIA}: ${error.message}`, 'RED');
  }
  if (respuesta.status === 401) throw new ErrorApi(`La API de n8n rechazó la clave de N8N_API_KEY (vencida, revocada o mal copiada).\n\n${GUIA_CLAVE}`, 'CLAVE_INVALIDA');
  if (respuesta.status === 403) throw new ErrorApi('La clave de N8N_API_KEY no tiene el scope workflow:read. Crea una nueva con Scopes → Custom → workflow:read.', 'SIN_PERMISO');
  if (respuesta.status === 404) throw new ErrorApi(`La API de n8n no encontró ${ruta}.`, 'NO_EXISTE');
  if (!respuesta.ok) throw new ErrorApi(`La API de n8n respondió ${respuesta.status} a ${ruta}.`, 'RESPUESTA');
  try {
    return await respuesta.json();
  } catch {
    throw new ErrorApi(`La API de n8n no devolvió JSON para ${ruta}.`, 'RESPUESTA');
  }
}

// Workflow completo, con pin data, tal como lo guarda n8n.
async function obtenerWorkflow(workflowId) {
  return pedir(`/workflows/${encodeURIComponent(workflowId)}`);
}

// Comprueba que la clave existe y es válida. Un 403 en el listado prueba que la clave autenticó:
// solo le falta workflow:list, que el gate no necesita (descarga cada workflow por su ID).
async function verificarClave() {
  try {
    await pedir('/workflows?limit=1');
  } catch (error) {
    if (error.codigo !== 'SIN_PERMISO') throw error;
  }
}

module.exports = { URL_INSTANCIA, GUIA_CLAVE, ErrorApi, obtenerWorkflow, verificarClave };
