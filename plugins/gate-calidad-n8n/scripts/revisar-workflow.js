#!/usr/bin/env node
// Script del plugin gate-calidad-n8n: revisa de forma determinista los criterios mecánicos del
// Gate de Calidad N8N sobre el JSON descargado de un workflow (menú del workflow → Download).
// No reemplaza al subagente revisor-workflow-n8n: marca REVISAR donde hace falta juicio y le
// entrega los hallazgos que necesita para decidir.
//
// Uso:
//   node revisar-workflow.js antes   --json <archivo> [--repo <ruta>] [--error-handler-id <id>] [--descripcion <texto>]
//   node revisar-workflow.js despues --json <workflows/archivo.json> --version-publicada <versionId> [--repo <ruta>]
//
// Estados: PASS, FAIL, REVISAR (lo decide el subagente) y N/A. Sale siempre con 0 salvo error de uso.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const NOMBRE_ERROR_HANDLER = 'Polaria - Error Handler';
const ALERTAS_VALIDAS = ['polo.alertas@polaria.tech', 'polo@polaria.tech'];

const TIPOS_SQL = ['postgres', 'mySql', 'microsoftSql', 'crateDb', 'questDb', 'timescaleDb', 'snowflake'].map((t) => `n8n-nodes-base.${t}`);
// Auditoría de seguridad de n8n (categorías nodes y filesystem), sin Code ni HTTP Request:
// en Cloud son de uso normal y los cubren los criterios 12, 15 y 22.
const TIPOS_RIESGO = ['executeCommand', 'ssh', 'ftp', 'readPdf', 'readBinaryFile', 'readBinaryFiles', 'readWriteFile', 'spreadsheetFile', 'writeBinaryFile', 'localFileTrigger'].map((t) => `n8n-nodes-base.${t}`);
const TIPOS_VALIDADORES = ['if', 'switch', 'code', 'function', 'functionItem'].map((t) => `n8n-nodes-base.${t}`);
const TRIGGERS_SIN_EVENTO = ['scheduleTrigger', 'manualTrigger', 'errorTrigger', 'executeWorkflowTrigger', 'cron', 'interval', 'start'].map((t) => `n8n-nodes-base.${t}`);
const NOMBRES_POR_DEFECTO = ['http request', 'edit fields', 'edit fields (set)', 'set', 'if', 'code', 'switch', 'merge', 'filter', 'function', 'ai agent', 'basic llm chain', 'openai chat model', 'openai', 'window buffer memory', 'simple memory', 'postgres chat memory', 'structured output parser', 'webhook', 'schedule trigger', "when clicking 'execute workflow'", 'when clicking ‘execute workflow’', "when clicking 'test workflow'", 'when executed by another workflow', 'execute workflow', 'execute workflow trigger', 'error trigger', 'no operation, do nothing', 'wait', 'loop over items', 'split in batches', 'remove duplicates', 'stop and error', 'respond to webhook', 'postgres', 'supabase', 'gmail', 'google drive', 'google sheets', 'slack', 'linear', 'whatsapp', 'whatsapp trigger', 'aggregate', 'split out', 'sort', 'limit', 'date & time', 'crypto', 'html', 'markdown', 'xml'];
// Los nombres por defecto recientes de n8n empiezan con un verbo en inglés ("Send a message",
// "Get many rows"); N2 exige el verbo en infinitivo y en español.
const VERBO_INGLES_POR_DEFECTO = /^(send|get|create|update|delete|execute|insert|upsert|search|add|remove|list|download|upload|append|move|copy|reply|mark|find)\b/i;
const PATRONES_SECRETO = [
  /sk-ant-[A-Za-z0-9_-]{20,}/, /sk-(proj-)?[A-Za-z0-9_-]{20,}/, /sk_(live|test)_[A-Za-z0-9]{10,}/, /xox[abprs]-[A-Za-z0-9-]{10,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/, /AKIA[0-9A-Z]{16}/, /AIza[0-9A-Za-z_-]{35}/, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
];
const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TELEFONO = /\+?\d[\d\s-]{8,}\d/g;
const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const PREFIJO_TIPO = /^(str|int|num|bool|arr|obj|dict|list)_/;

function salirConUso(mensaje) {
  process.stderr.write(`${mensaje}\nUso: node revisar-workflow.js <antes|despues> --json <archivo> [--repo <ruta>] [--error-handler-id <id>] [--descripcion <texto>] [--version-publicada <versionId>]\n`);
  process.exit(1);
}

function leerArgumentos() {
  const [modo, ...resto] = process.argv.slice(2);
  if (modo !== 'antes' && modo !== 'despues') salirConUso('Falta el modo: antes o despues.');
  const opciones = { modo };
  for (let i = 0; i < resto.length; i += 2) {
    if (!resto[i].startsWith('--') || resto[i + 1] === undefined) salirConUso(`Argumento inválido: ${resto[i]}`);
    opciones[resto[i].slice(2)] = resto[i + 1];
  }
  if (!opciones.json) salirConUso('Falta --json.');
  opciones.repo = path.resolve(opciones.repo || process.cwd());
  return opciones;
}

function leerWorkflow(archivo) {
  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch (error) {
    salirConUso(`No se pudo leer ${archivo} como JSON: ${error.message}`);
  }
  if (datos.workflow && datos.workflow.nodes) salirConUso(`${archivo} es una respuesta del MCP de n8n, que no trae el pin data. Usa el JSON del menú del workflow → Download.`);
  const workflow = datos;
  if (!Array.isArray(workflow.nodes)) salirConUso(`${archivo} no parece un workflow de n8n (no tiene "nodes").`);
  return workflow;
}

const normalizar = (texto) => texto.toLowerCase().replace(/[^a-z0-9]/g, '');
const sinAcentos = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (texto) => sinAcentos(texto).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const nombreDeProduccion = (nombre) => nombre.replace(/ - DEV$/, '');
const tipoCorto = (nodo) => nodo.type.split('.').pop();
const esTrigger = (nodo) => /trigger$/i.test(nodo.type) || nodo.type === 'n8n-nodes-base.webhook' || TRIGGERS_SIN_EVENTO.includes(nodo.type);
const esTriggerDeEvento = (nodo) => esTrigger(nodo) && !TRIGGERS_SIN_EVENTO.includes(nodo.type);
const tieneNota = (nodo) => typeof nodo.notes === 'string' && nodo.notes.trim().length > 0;
const lista = (nombres) => nombres.map((n) => `\`${n}\``).join(', ');

function textosDe(valor, acumulado = []) {
  if (typeof valor === 'string') acumulado.push(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => textosDe(v, acumulado));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => textosDe(v, acumulado));
  return acumulado;
}

function referenciasANodos(valor) {
  const nombres = new Set();
  for (const texto of textosDe(valor)) {
    for (const coincidencia of texto.matchAll(/\$\(\s*['"`]([^'"`]+)['"`]\s*\)|\$node\[\s*['"]([^'"]+)['"]\s*\]/g)) {
      nombres.add(coincidencia[1] || coincidencia[2]);
    }
  }
  return [...nombres];
}

function construirGrafo(workflow) {
  const entrantes = new Map(); // nodo → [{ desde, tipo }]
  const salientes = new Map(); // nodo → { tipo: [[destinos]] }
  for (const [desde, porTipo] of Object.entries(workflow.connections || {})) {
    salientes.set(desde, porTipo);
    for (const [tipo, salidas] of Object.entries(porTipo)) {
      for (const salida of salidas || []) {
        for (const destino of salida || []) {
          if (!entrantes.has(destino.node)) entrantes.set(destino.node, []);
          entrantes.get(destino.node).push({ desde, tipo });
        }
      }
    }
  }
  return { entrantes, salientes };
}

function camposCreados(nodo) {
  const p = nodo.parameters || {};
  const campos = [];
  if (nodo.type === 'n8n-nodes-base.set') {
    for (const a of (p.assignments && p.assignments.assignments) || []) campos.push(a.name);
    for (const a of (p.fields && p.fields.values) || []) campos.push(a.name);
    for (const grupo of Object.values(p.values || {})) if (Array.isArray(grupo)) grupo.forEach((a) => campos.push(a.name));
  }
  if (/outputParserStructured$/.test(nodo.type)) {
    const recorrer = (objeto) => {
      if (!objeto || typeof objeto !== 'object') return;
      for (const [clave, valor] of Object.entries(objeto)) {
        if (!Array.isArray(objeto)) campos.push(clave);
        recorrer(valor);
      }
    };
    try {
      if (p.jsonSchemaExample) recorrer(JSON.parse(p.jsonSchemaExample));
      if (p.inputSchema) {
        const esquema = JSON.parse(p.inputSchema);
        const propiedades = (s) => {
          if (!s || typeof s !== 'object') return;
          for (const [clave, valor] of Object.entries(s.properties || {})) { campos.push(clave); propiedades(valor); propiedades(valor.items); }
        };
        propiedades(esquema);
      }
    } catch { /* Un schema que no es JSON lo reporta el propio n8n. */ }
  }
  return campos.filter((c) => typeof c === 'string' && c.length > 0 && !c.startsWith('='));
}

function salidasEsperadas(nodo) {
  const p = nodo.parameters || {};
  if (nodo.type === 'n8n-nodes-base.if') return 2;
  if (nodo.type === 'n8n-nodes-base.switch') {
    if (p.mode === 'expression') return Number(p.numberOutputs) || 4;
    const reglas = (p.rules && (p.rules.values || p.rules.rules)) || [];
    return reglas.length + (p.options && p.options.fallbackOutput === 'extra' ? 1 : 0);
  }
  return 0;
}

function hayCiclo(nodos, salientes) {
  const estado = new Map();
  const visitar = (nombre) => {
    if (estado.get(nombre) === 1) return true;
    if (estado.get(nombre) === 2) return false;
    estado.set(nombre, 1);
    for (const salida of (salientes.get(nombre) && salientes.get(nombre).main) || []) {
      for (const destino of salida || []) if (visitar(destino.node)) return true;
    }
    estado.set(nombre, 2);
    return false;
  };
  return nodos.some((n) => visitar(n.name));
}

function buscarEnDocs(repo, texto) {
  const docs = path.join(repo, 'docs');
  if (!fs.existsSync(docs)) return false;
  const pendientes = [docs];
  while (pendientes.length) {
    const actual = pendientes.pop();
    for (const entrada of fs.readdirSync(actual, { withFileTypes: true })) {
      const ruta = path.join(actual, entrada.name);
      if (entrada.isDirectory()) pendientes.push(ruta);
      else if (entrada.name.endsWith('.md') && fs.readFileSync(ruta, 'utf8').includes(texto)) return true;
    }
  }
  return false;
}

function ultimaEntradaChangelog(repo) {
  const ruta = path.join(repo, 'CHANGELOG.md');
  if (!fs.existsSync(ruta)) return null;
  const lineas = fs.readFileSync(ruta, 'utf8').split(/\r?\n/);
  const inicio = lineas.findIndex((l) => /^##\s/.test(l));
  if (inicio === -1) return lineas.slice(0, 40).join('\n');
  const fin = lineas.findIndex((l, i) => i > inicio && /^##\s/.test(l));
  return lineas.slice(inicio, fin === -1 ? inicio + 40 : fin).join('\n');
}

function revisarAntes(workflow, opciones) {
  const r = {};
  const hallazgos = [];
  const nodos = workflow.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote');
  const porNombre = new Map(nodos.map((n) => [n.name, n]));
  const { entrantes, salientes } = construirGrafo(workflow);
  const nombre = workflow.name || '';
  const esErrorHandler = nombreDeProduccion(nombre) === NOMBRE_ERROR_HANDLER;
  const esSubWorkflow = nodos.some((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  const triggersDeEvento = nodos.filter(esTriggerDeEvento);
  const descripcion = opciones.descripcion !== undefined ? opciones.descripcion : workflow.description || '';
  const tags = (workflow.tags || []).map((t) => (typeof t === 'string' ? t : t.name));

  // 1. Nombre
  {
    const base = nombreDeProduccion(nombre);
    const fallas = [];
    const esUtil = /^UTIL - \S/.test(base);
    if (!esErrorHandler && !esUtil && base.split(' - ').filter((s) => s.trim()).length !== 3) fallas.push('no tiene el formato `[Dominio] - [Acción] - [Destino]` (3 partes separadas por " - ")');
    if (/\sy\s/i.test(base)) fallas.push('contiene "y" (dos responsabilidades)');
    if (/\bv\d+(\.\d+)*\b|\b\d+\.\d+(\.\d+)?\b/i.test(base)) fallas.push('contiene una versión');
    r[1] = fallas.length ? ['FAIL', `\`${nombre}\`: ${fallas.join('; ')}.`] : ['PASS', `\`${nombre}\`.`];
  }

  // 2. Tags
  {
    const entorno = tags.filter((t) => ['producción', 'produccion', 'desarrollo'].includes(t.toLowerCase()));
    const proyecto = tags.filter((t) => !entorno.includes(t));
    const fallas = [];
    if (!entorno.length) fallas.push('falta el tag de entorno (`producción` o `desarrollo`)');
    if (!proyecto.length) fallas.push('falta el tag de proyecto');
    if (/ - DEV$/.test(nombre) && entorno.length && !entorno.some((t) => t.toLowerCase() === 'desarrollo')) fallas.push('la copia DEV no lleva el tag `desarrollo`');
    r[2] = fallas.length ? ['FAIL', `Tags: ${tags.length ? lista(tags) : 'ninguno'}; ${fallas.join('; ')}.`] : ['PASS', `Tags: ${lista(tags)}.`];
  }

  // 3. Nodos
  {
    const fallas = [];
    const porDefecto = nodos.filter((n) => {
      const sinNumero = n.name.replace(/\s*\d+$/, '');
      return NOMBRES_POR_DEFECTO.includes(sinNumero.toLowerCase()) || normalizar(sinNumero) === normalizar(tipoCorto(n)) || /^(node|nodo)\s*\d*$/i.test(n.name) || VERBO_INGLES_POR_DEFECTO.test(n.name);
    });
    if (porDefecto.length) fallas.push(`nombre por defecto: ${lista(porDefecto.map((n) => n.name))}`);
    const subNodoPorCanalPrincipal = nodos.filter((n) => /lmChat|lmOpenAi|memory|outputParser|embeddings/i.test(n.type) && salientes.get(n.name) && salientes.get(n.name).main);
    if (subNodoPorCanalPrincipal.length) fallas.push(`sub-nodo conectado por el canal principal: ${lista(subNodoPorCanalPrincipal.map((n) => n.name))}`);
    for (const [desde, porTipo] of salientes) {
      for (const tipo of ['ai_languageModel', 'ai_memory', 'ai_outputParser']) {
        for (const salida of porTipo[tipo] || []) {
          for (const destino of salida || []) {
            const agente = destino.node;
            const agenteSinPrefijo = agente.replace(/^Agente\s+/i, '');
            if (!desde.includes(agente) && !desde.includes(agenteSinPrefijo)) fallas.push(`\`${desde}\` no lleva el nombre de su agente \`${agente}\``);
          }
        }
      }
    }
    const agentes = nodos.filter((n) => /langchain\.(agent|chainLlm|chainSummarization|informationExtractor|textClassifier|sentimentAnalysis)$/.test(n.type));
    for (const agente of agentes) {
      const previos = (entrantes.get(agente.name) || []).filter((e) => e.tipo === 'main').map((e) => e.desde);
      const lejanos = referenciasANodos(agente.parameters).filter((ref) => !previos.includes(ref));
      if (lejanos.length) fallas.push(`\`${agente.name}\` lee nodos que no son su preparador: ${lista(lejanos)}`);
      const previosNoSet = previos.filter((p) => porNombre.get(p) && porNombre.get(p).type !== 'n8n-nodes-base.set');
      if (previosNoSet.length) hallazgos.push(`Criterio 3: el nodo anterior a \`${agente.name}\` no es un Edit Fields: ${lista(previosNoSet)}.`);
    }
    r[3] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : agentes.length ? ['REVISAR', 'Revisión mecánica sin fallas; confirmar el preparador de cada agente (ver hallazgos).'] : ['PASS', 'Sin nombres por defecto ni sub-nodos mal conectados.'];
  }

  // 4. Campos
  {
    const malos = [];
    const codigos = nodos.filter((n) => n.type === 'n8n-nodes-base.code' || n.type === 'n8n-nodes-base.function');
    for (const nodo of nodos) {
      for (const campo of camposCreados(nodo)) {
        const partes = campo.split('.');
        if (partes.some((p) => !SNAKE_CASE.test(p) || PREFIJO_TIPO.test(p))) malos.push(`\`${campo}\` (${nodo.name})`);
      }
    }
    const todos = nodos.flatMap((n) => camposCreados(n));
    if (todos.length) hallazgos.push(`Criterio 4: campos creados en Edit Fields y parsers: ${lista([...new Set(todos)])}.`);
    if (codigos.length) hallazgos.push(`Criterio 4: revisar los campos que devuelven los nodos Code: ${lista(codigos.map((n) => n.name))}.`);
    r[4] = malos.length ? ['FAIL', `No están en \`snake_case\` o llevan prefijo de tipo: ${malos.join(', ')}.`] : todos.length || codigos.length ? ['REVISAR', 'Formato correcto; falta confirmar que estén en inglés (ver hallazgos).'] : ['PASS', 'El workflow no crea campos.'];
  }

  // 5. Estructura de entrada
  if (!triggersDeEvento.length) r[5] = ['N/A', 'Sin trigger de evento.'];
  else {
    const nombresTrigger = triggersDeEvento.map((t) => t.name);
    const lectores = nodos.filter((n) => referenciasANodos(n.parameters).some((ref) => nombresTrigger.includes(ref)));
    hallazgos.push(`Criterio 5: trigger(s) de evento ${lista(nombresTrigger)}; nodos que leen el trigger por nombre: ${lectores.length ? lista(lectores.map((n) => n.name)) : 'ninguno'}.`);
    r[5] = ['REVISAR', 'Confirmar que existe Preparar Payload y que nada más lee el payload crudo (ver hallazgos).'];
  }

  // 6. Referencias de sesión
  r[6] = ['REVISAR', 'Criterio de juicio: variantes de nodo de sesión.'];

  // 7. Idempotencia
  if (!triggersDeEvento.length) r[7] = ['N/A', 'Sin trigger de evento.'];
  else {
    const fallas = [];
    const dedup = nodos.filter((n) => n.type === 'n8n-nodes-base.removeDuplicates');
    if (!dedup.some((n) => (n.parameters || {}).operation === 'removeItemsSeenInPreviousExecutions')) fallas.push('no hay Remove Duplicates con "Remove Items Processed in Previous Executions"');
    for (const nodo of nodos.filter((n) => TIPOS_SQL.includes(n.type))) {
      const p = nodo.parameters || {};
      if (p.operation === 'insert') fallas.push(`\`${nodo.name}\` usa la operación Insert en vez de Upsert`);
      if (p.operation === 'executeQuery' && /\binsert\s+into\b/i.test(p.query || '') && !/on\s+conflict|on\s+duplicate\s+key/i.test(p.query || '')) fallas.push(`\`${nodo.name}\` hace INSERT sin ON CONFLICT`);
    }
    const supabaseCrear = nodos.filter((n) => n.type === 'n8n-nodes-base.supabase' && (n.parameters || {}).operation === 'create');
    if (supabaseCrear.length) hallazgos.push(`Criterio 7: nodos Supabase con "Create" (INSERT): ${lista(supabaseCrear.map((n) => n.name))}.`);
    r[7] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : ['REVISAR', 'Revisión mecánica sin fallas; confirmar que se verifica la existencia antes de crear en sistemas externos.'];
  }

  // 8. Error Workflow
  if (esErrorHandler) r[8] = ['N/A', 'Es el propio Error Handler.'];
  else if (!opciones['error-handler-id']) r[8] = ['REVISAR', `Falta el ID de \`${NOMBRE_ERROR_HANDLER}\` para comparar con \`settings.errorWorkflow\` (${(workflow.settings || {}).errorWorkflow || 'vacío'}).`];
  else {
    const actual = (workflow.settings || {}).errorWorkflow;
    r[8] = actual === opciones['error-handler-id'] ? ['PASS', `Apunta a \`${NOMBRE_ERROR_HANDLER}\`.`] : ['FAIL', `\`settings.errorWorkflow\` es \`${actual || 'vacío'}\`, no el ID de \`${NOMBRE_ERROR_HANDLER}\` (\`${opciones['error-handler-id']}\`).`];
  }

  // 9. Error Handler
  if (!esErrorHandler) r[9] = ['N/A', 'No es el Error Handler.'];
  else {
    const fallas = [];
    const porConfirmar = [];
    const envios = nodos.filter((n) => !esTrigger(n) && (n.parameters || {}).sendTo !== undefined);
    if (!envios.length) fallas.push('no se encontró el nodo que envía la notificación');
    for (const nodo of envios) {
      const destinos = String(nodo.parameters.sendTo).split(/[,;]/).map((d) => d.trim().toLowerCase()).filter(Boolean);
      const invalidos = destinos.filter((d) => !ALERTAS_VALIDAS.includes(d));
      if (invalidos.length) fallas.push(`\`${nodo.name}\` envía a ${lista(invalidos)}`);
      for (const credencial of Object.values(nodo.credentials || {})) {
        if (/@/.test(credencial.name || '') && !/^polo(\.|@)/i.test(credencial.name)) fallas.push(`\`${nodo.name}\` usa la credencial personal \`${credencial.name}\``);
        else if (!/polo/i.test(credencial.name || '')) porConfirmar.push(credencial.name);
      }
      const mensaje = textosDe(nodo.parameters).join('\n');
      const datos = { 'nombre del workflow': /workflow\.name/, 'nodo que falló': /lastNodeExecuted|error\.node/, 'mensaje de error': /error\.message/, 'URL de la ejecución': /execution\.url/, hora: /\$now|\$today|execution\.startedAt/ };
      const faltan = Object.entries(datos).filter(([, patron]) => !patron.test(mensaje)).map(([dato]) => dato);
      if (faltan.length) fallas.push(`a la notificación le falta: ${faltan.join(', ')}`);
    }
    if (porConfirmar.length) hallazgos.push(`Criterio 9: credenciales de envío que no llevan el nombre de la cuenta polo: ${lista(porConfirmar)}.`);
    r[9] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : porConfirmar.length ? ['REVISAR', 'Destino y datos de N7 correctos; confirmar que la credencial es de la cuenta polo (ver hallazgos).'] : ['PASS', 'Destino, credencial y datos de N7.'];
  }

  // 10. Salidas de error y ramas
  {
    const fallas = [];
    for (const nodo of nodos) {
      const main = (salientes.get(nodo.name) || {}).main || [];
      if (nodo.onError === 'continueErrorOutput') {
        const indiceError = salidasEsperadas(nodo) || 1; // n8n agrega la salida de error después de las normales.
        if (!main[indiceError] || !main[indiceError].length) fallas.push(`\`${nodo.name}\`: salida de error sin conectar`);
      }
      const esperadas = salidasEsperadas(nodo);
      for (let i = 0; i < esperadas; i++) {
        if ((!main[i] || !main[i].length) && !tieneNota(nodo)) fallas.push(`\`${nodo.name}\`: salida ${i} sin conectar y sin nota que lo explique`);
      }
    }
    r[10] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : ['PASS', 'Salidas de error y ramas conectadas.'];
  }

  // 11. Webhooks
  {
    const fallas = [];
    const porConfirmar = [];
    for (const nodo of nodos.filter((n) => n.type === 'n8n-nodes-base.webhook')) {
      const autenticacion = (nodo.parameters || {}).authentication;
      if (autenticacion && autenticacion !== 'none') continue;
      const siguientes = (((salientes.get(nodo.name) || {}).main || [])[0] || []).map((d) => porNombre.get(d.node)).filter(Boolean);
      if (siguientes.some((s) => TIPOS_VALIDADORES.includes(s.type))) porConfirmar.push(nodo.name);
      else fallas.push(nodo.name);
    }
    if (porConfirmar.length) hallazgos.push(`Criterio 11: webhook sin autenticación seguido de un nodo que podría verificar la firma: ${lista(porConfirmar)}.`);
    r[11] = fallas.length ? ['FAIL', `Webhook sin autenticación ni verificación de firma: ${lista(fallas)}.`] : porConfirmar.length ? ['REVISAR', 'Confirmar que el nodo siguiente verifica la firma del origen (ver hallazgos).'] : ['PASS', 'Webhooks con autenticación o sin webhooks.'];
  }

  // 12. Secretos y datos personales
  {
    const fallas = [];
    for (const nodo of nodos) {
      const textos = textosDe([nodo.parameters, nodo.notes]);
      if (textos.some((t) => PATRONES_SECRETO.some((p) => p.test(t)))) fallas.push(`\`${nodo.name}\` contiene un texto con forma de clave o token`);
      const cabeceras = ((nodo.parameters || {}).headerParameters || {}).parameters || [];
      for (const c of cabeceras) {
        if (/auth|key|token|secret/i.test(c.name || '') && c.value && !String(c.value).startsWith('=')) fallas.push(`\`${nodo.name}\` pone \`${c.name}\` fijo en una cabecera`);
      }
    }
    const pin = JSON.stringify(workflow.pinData || {});
    if (PATRONES_SECRETO.some((p) => p.test(pin))) fallas.push('el pin data contiene un texto con forma de clave o token');
    const visibles = [descripcion, ...nodos.map((n) => n.notes || '')].join('\n');
    const personales = [...new Set([...(visibles.match(CORREO) || []), ...(visibles.match(TELEFONO) || [])])];
    if (personales.length) hallazgos.push(`Criterio 12: correos o teléfonos en notas o descripción: ${lista(personales)}.`);
    r[12] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : personales.length ? ['REVISAR', 'Sin secretos; confirmar si los datos de contacto encontrados son personales (ver hallazgos).'] : ['PASS', 'Sin secretos ni datos de contacto en notas o descripción.'];
  }

  // 13. Pin data
  {
    const conPin = Object.keys(workflow.pinData || {});
    r[13] = conPin.length ? ['REVISAR', `Nodos con pin data: ${lista(conPin)}; confirmar que los datos son inventados.`] : ['PASS', 'Sin pin data en el JSON.'];
  }

  // 14. Pruebas
  {
    const entrada = ultimaEntradaChangelog(opciones.repo);
    if (entrada === null) r[14] = ['FAIL', `No existe \`CHANGELOG.md\` en ${opciones.repo}.`];
    else {
      hallazgos.push(`Criterio 14: última entrada de CHANGELOG.md:\n\n\`\`\`\n${entrada}\n\`\`\``);
      r[14] = ['REVISAR', 'Confirmar que la última entrada lista el camino feliz y un caso de error (ver hallazgos).'];
    }
  }

  // 15. Salidas de LLM
  {
    const llm = nodos.filter((n) => /langchain\.(agent|chainLlm|openAi|lmChat)|n8n-nodes-base\.openAi/.test(n.type) && !(salientes.get(n.name) || {}).ai_languageModel);
    r[15] = llm.length ? ['REVISAR', `Nodos con salida de LLM: ${lista(llm.map((n) => n.name))}.`] : ['N/A', 'Sin nodos de LLM.'];
  }

  // 16. Loops
  r[16] = hayCiclo(nodos, salientes) ? ['REVISAR', 'Hay al menos un ciclo en las conexiones; confirmar su condición de corte.'] : ['PASS', 'Sin ciclos en las conexiones.'];

  // 17. Documentación
  {
    const fallas = [];
    const requeridos = esSubWorkflow || esErrorHandler ? ['Trigger:', 'Output:', 'Proyecto:'] : ['Trigger:', 'Output:', 'Proyecto:', 'Ejecuciones/mes estimadas:'];
    if (!descripcion.trim()) fallas.push('el workflow no tiene descripción');
    else {
      const faltan = requeridos.filter((campo) => !descripcion.includes(campo));
      if (faltan.length) fallas.push(`a la descripción le falta ${lista(faltan)}`);
    }
    const produccion = nombreDeProduccion(nombre);
    if (!buscarEnDocs(opciones.repo, produccion)) fallas.push(`ningún \`.md\` de \`docs/\` menciona \`${produccion}\``);
    if (esSubWorkflow) hallazgos.push('Criterio 17: es un sub-workflow; confirmar que la descripción dice qué recibe y qué devuelve.');
    r[17] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : esSubWorkflow ? ['REVISAR', 'Campos presentes; confirmar qué recibe y qué devuelve.'] : ['PASS', 'Descripción completa y documento en `docs/`.'];
  }

  // 18. Consumo
  {
    const schedules = nodos.filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger');
    if (schedules.length) hallazgos.push(`Criterio 18: reglas de Schedule: ${schedules.map((n) => `\`${n.name}\` ${JSON.stringify((n.parameters || {}).rule || {})}`).join('; ')}.`);
    r[18] = schedules.length ? ['REVISAR', 'Confirmar que la descripción justifica la frecuencia del Schedule.'] : ['N/A', 'Sin Schedule.'];
  }

  // 19. Nodos de riesgo
  {
    const riesgo = nodos.filter((n) => TIPOS_RIESGO.includes(n.type) || !/^(n8n-nodes-base\.|@n8n\/)/.test(n.type));
    const sinNota = riesgo.filter((n) => !tieneNota(n));
    r[19] = sinNota.length ? ['FAIL', `Nodo de riesgo o de comunidad sin nota que lo justifique: ${lista(sinNota.map((n) => `${n.name} (${n.type})`))}.`] : riesgo.length ? ['PASS', `Nodos de riesgo con nota: ${lista(riesgo.map((n) => n.name))}.`] : ['PASS', 'Sin nodos de riesgo ni de comunidad.'];
  }

  // 20. SQL con expresiones
  {
    const conExpresion = nodos.filter((n) => TIPOS_SQL.includes(n.type) && (n.parameters || {}).operation === 'executeQuery' && /\{\{/.test((n.parameters || {}).query || ''));
    r[20] = conExpresion.length ? ['FAIL', `Query con expresiones \`{{ }}\` en vez de Query Parameters: ${lista(conExpresion.map((n) => n.name))}.`] : ['PASS', 'Sin queries con expresiones.'];
  }

  // 21. Nodos sueltos
  {
    const huerfanos = nodos.filter((n) => !esTrigger(n) && !entrantes.has(n.name) && !Object.keys(salientes.get(n.name) || {}).some((t) => t.startsWith('ai_')));
    const deshabilitados = nodos.filter((n) => n.disabled);
    const fallas = [];
    if (huerfanos.length) fallas.push(`sin conexión de entrada: ${lista(huerfanos.map((n) => n.name))}`);
    if (deshabilitados.length) fallas.push(`deshabilitados: ${lista(deshabilitados.map((n) => n.name))}`);
    r[21] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : ['PASS', 'Sin nodos huérfanos ni deshabilitados.'];
  }

  // 22. Reintentos HTTP
  {
    const fallas = [];
    const porConfirmar = [];
    for (const nodo of nodos.filter((n) => n.type === 'n8n-nodes-base.httpRequest')) {
      if (nodo.retryOnFail && (nodo.maxTries === undefined || nodo.maxTries <= 3)) continue;
      if (nodo.retryOnFail) fallas.push(`\`${nodo.name}\` reintenta más de 3 veces`);
      else if (tieneNota(nodo)) porConfirmar.push(nodo.name);
      else fallas.push(`\`${nodo.name}\` sin Retry On Fail ni nota que explique por qué`);
    }
    if (porConfirmar.length) hallazgos.push(`Criterio 22: HTTP Request sin Retry On Fail pero con nota: ${lista(porConfirmar)}.`);
    r[22] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : porConfirmar.length ? ['REVISAR', 'Confirmar que la nota justifica no reintentar (ver hallazgos).'] : ['PASS', 'HTTP Request con reintentos o sin HTTP Request.'];
  }

  return { resultados: r, hallazgos };
}

function revisarDespues(workflow, opciones) {
  const r = {};
  const fallas = [];
  const archivo = path.resolve(opciones.json);
  const esperado = `${slug(nombreDeProduccion(workflow.name || ''))}.json`;
  if (path.basename(path.dirname(archivo)) !== 'workflows') fallas.push(`el archivo no está en \`workflows/\` (${archivo})`);
  if (path.basename(archivo) !== esperado) fallas.push(`el archivo se llama \`${path.basename(archivo)}\` y debería llamarse \`${esperado}\``);
  const publicada = opciones['version-publicada'];
  if (!publicada) fallas.push('falta `--version-publicada` (el `activeVersionId` que muestra n8n)');
  else {
    if (workflow.versionId !== publicada) fallas.push(`el \`versionId\` del archivo (\`${workflow.versionId}\`) no es el publicado (\`${publicada}\`)`);
    let commits = '';
    try {
      commits = execFileSync('git', ['log', '--all', '--oneline', `--grep=${publicada}`], { cwd: opciones.repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { /* Fuera de un repo git: queda sin commit. */ }
    if (!commits) fallas.push(`ningún commit cita \`${publicada}\``);
    const changelog = path.join(opciones.repo, 'CHANGELOG.md');
    if (!fs.existsSync(changelog) || !fs.readFileSync(changelog, 'utf8').includes(publicada)) fallas.push(`\`CHANGELOG.md\` no cita \`${publicada}\``);
  }
  r[23] = fallas.length ? ['FAIL', `${fallas.join('; ')}.`] : ['PASS', `\`${esperado}\` con el \`versionId\` publicado, citado en el commit y en \`CHANGELOG.md\`.`];
  return { resultados: r, hallazgos: [] };
}

const NOMBRES_CRITERIOS = {
  1: 'Nombre del workflow', 2: 'Tags', 3: 'Nodos', 4: 'Campos', 5: 'Estructura de entrada', 6: 'Referencias de sesión', 7: 'Idempotencia',
  8: 'Error Workflow', 9: 'Error Handler', 10: 'Salidas de error y ramas', 11: 'Webhooks', 12: 'Secretos y datos personales', 13: 'Pin data',
  14: 'Pruebas', 15: 'Salidas de LLM', 16: 'Loops', 17: 'Documentación', 18: 'Consumo (perfil Starter)', 19: 'Nodos de riesgo',
  20: 'SQL con expresiones', 21: 'Nodos sueltos', 22: 'Reintentos HTTP', 23: 'Git',
};

function imprimir(workflow, { resultados, hallazgos }, modo) {
  const salida = [`## Revisión mecánica — \`${workflow.name}\` (${modo === 'antes' ? 'antes de publicar' : 'después de publicar'})`, '', `versionId del JSON: \`${workflow.versionId || 'sin versionId'}\``, '', '| # | Criterio | Estado | Evidencia |', '|---|---|---|---|'];
  for (const [numero, [estado, evidencia]] of Object.entries(resultados)) salida.push(`| ${numero} | ${NOMBRES_CRITERIOS[numero]} | ${estado} | ${evidencia.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
  const cuenta = (estado) => Object.values(resultados).filter(([e]) => e === estado).length;
  salida.push('', `Resumen: ${cuenta('FAIL')} FAIL · ${cuenta('REVISAR')} REVISAR · ${cuenta('PASS')} PASS · ${cuenta('N/A')} N/A`);
  if (hallazgos.length) salida.push('', '### Hallazgos para el revisor', '', ...hallazgos.map((h) => `- ${h}`));
  process.stdout.write(`${salida.join('\n')}\n`);
}

const opciones = leerArgumentos();
const workflow = leerWorkflow(opciones.json);
imprimir(workflow, opciones.modo === 'antes' ? revisarAntes(workflow, opciones) : revisarDespues(workflow, opciones), opciones.modo);
