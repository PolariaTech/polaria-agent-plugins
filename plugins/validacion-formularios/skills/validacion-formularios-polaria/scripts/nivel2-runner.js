// Runner de Nivel 2: genera y ejecuta los casos C1 a C8 de un formulario a partir de su schema
// (formato 1.0) y devuelve un `verification_report` determinista. Es la pieza que comparten la
// verificación local (skill) y la validación en staging (n8n). Contrato y decisiones en el repo
// PolariaTech/validacion-formularios: specs/001-validacion-nivel-2/contracts/runner-nivel2.md y
// docs/adr/0002-motor-de-navegador.md. Los códigos FR-NNN y SC-NNN de los comentarios son los requisitos
// y criterios de éxito de specs/001-validacion-nivel-2/spec.md de ese repo.
//
// Uso en navegador: quien llama (la skill o n8n) arma el código con `armarCodigo(fuente, input)`, que
// incrusta `const input = {...}` y envía una función `async (page) => {...}` a `browser_run_code_unsafe`.
// Solo lo que está entre RUNNER_INICIO y RUNNER_FIN viaja al navegador: no puede usar import, export ni
// require. Lo que está fuera (exports y armarCodigo) sirve a las pruebas y a quien arma el código.
//
// Reglas que este archivo hace cumplir (FR-002 a FR-008):
// - Solo usa datos del schema; lo que falta deja el caso en `not_executable` con su motivo.
// - Nunca confirma un guardado: durante el intento de guardar de C7 y C8 bloquea toda petición que
//   modifique datos, también la que dispararía el clic en el botón de confirmar de la advertencia.
//   El único cierre del formulario que ejecuta es "descartar" en el diálogo de descarte.
// - Rechaza toda `base_url` que empiece con `production_url`.
// - Nunca incluye `credentials` en la salida.

// <<RUNNER_INICIO>>
const RUNNER_VERSION = '1.0.0';
const TIMEOUT_POR_DEFECTO_MS = 10000;
const ESPERA_ADVERTENCIA_MS = 1500;
const METODOS_QUE_LEEN = ['GET', 'HEAD', 'OPTIONS'];

// ---------------------------------------------------------------------------------------------
// Funciones puras (se prueban sin navegador)

function normalizarTexto(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function normalizarUrl(url) {
  return String(url ?? '').trim().toLowerCase().replace(/\/+$/, '');
}

// FR-008: toda base_url que empiece con la URL de producción se rechaza. Sin production_url no se puede
// garantizar nada, así que también se rechaza.
function apuntaAProduccion(baseUrl, productionUrl) {
  const produccion = normalizarUrl(productionUrl);
  if (!produccion) return true;
  return normalizarUrl(baseUrl).startsWith(produccion);
}

function localizadorValido(loc) {
  return Boolean(loc && (loc.testid || (loc.rol && loc.nombre)));
}

// El testid va primero; si no hay, rol + nombre accesible.
function resolverLocalizador(loc) {
  if (!localizadorValido(loc)) return null;
  if (loc.testid) return { tipo: 'testid', testid: loc.testid };
  return { tipo: 'rol', rol: loc.rol, nombre: loc.nombre };
}

function describirLocalizador(loc) {
  if (!loc) return 'sin localizador';
  if (loc.texto_original) return loc.texto_original;
  return loc.testid ? `testid=${loc.testid}` : `${loc.rol} "${loc.nombre}"`;
}

// El proxy del MCP alojado reemplaza {{secreto:NIVEL2_USUARIO_<ROL>}} por el secreto del servicio: el
// <ROL> es el rol de la Tabla 4 en mayúsculas, sin acentos y con _ en lugar de espacios.
function nombreSecretoRol(rol, prefijo) {
  const sufijo = String(rol ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${prefijo}_${sufijo}`;
}

// El foco automático solo entra en C3 cuando ocurre al abrir el formulario o el modal.
function momentoEsApertura(momento) {
  return /^al abrir( (el|la|este|esta))?( (modal|formulario|dialogo|pantalla|pagina))?$/.test(normalizarTexto(momento));
}

function valorDePrueba(campo) {
  return campo && campo.valor_de_prueba !== null && campo.valor_de_prueba !== undefined && String(campo.valor_de_prueba) !== '';
}

// El modal es el diálogo que espera el último paso "esperar" de pasos_abrir.
function localizadorDelModal(acceso) {
  const pasos = (acceso && acceso.pasos_abrir) || [];
  const paso = [...pasos].reverse().find((pasoAbrir) => pasoAbrir.accion === 'esperar' && pasoAbrir.localizador && pasoAbrir.localizador.rol === 'dialog');
  return paso ? paso.localizador : null;
}

const plantilla = () => ({ applies: false, inputs: {}, reason: null });

// Genera el plan de casos del formulario a partir del schema (FR-001, FR-002). Cada elemento:
// `applies` dice si el caso corresponde al formulario según la columna "Aplica cuando" del catálogo, y
// `reason` (si no es null) dice por qué no se puede ejecutar con los datos del schema. Los casos por
// campo (C2, C3) y los campos que C1 deja fuera aparecen solo si existen. Orden estable: C1..C8 y, dentro
// de cada caso, el orden de la Tabla 2.
function generarCasos(schema) {
  const casos = [];
  const tabla2 = schema.tabla_2_interaccion || [];
  const tabla3 = schema.tabla_3_prellenado || [];
  const pruebaNivel2 = schema.prueba_nivel_2;
  if (!pruebaNivel2) return casos;
  const acceso = pruebaNivel2.acceso || {};
  const botones = pruebaNivel2.botones || {};
  const camposT4 = pruebaNivel2.campos || [];
  const localizadorDe = (campoId) => {
    const campo = camposT4.find((candidato) => candidato.campo_id === campoId);
    return campo && localizadorValido(campo.localizador) ? campo.localizador : null;
  };
  const faltaCampo = (campoId) => `dato faltante: localizador del campo ${campoId} (Tabla 4.2)`;
  const faltaBoton = (nombre) => `dato faltante: botón ${nombre} (Tabla 4.1)`;
  const modal = localizadorDelModal(acceso);
  const vive = ((schema.datos_formulario || {}).vive_en_modal || {}).valor === 'si';
  const conValor = camposT4.filter((campo) => valorDePrueba(campo) && localizadorValido(campo.localizador));

  // C1: orden de tabulación. Solo los campos con posición numérica; el resto se reporta aparte.
  const posicionados = tabla2.filter((campo) => campo.orden_tabulacion && campo.orden_tabulacion.tipo === 'posicion' && Number.isInteger(campo.orden_tabulacion.posicion)).sort((primero, segundo) => primero.orden_tabulacion.posicion - segundo.orden_tabulacion.posicion);
  const c1 = { ...plantilla(), case_id: 'C1', field_id: null, applies: posicionados.length >= 2 };
  if (c1.applies) {
    c1.inputs = { orden: posicionados.map((campo) => ({ campo_id: campo.campo_id, localizador: localizadorDe(campo.campo_id) })) };
    const sinLocalizador = posicionados.find((campo) => !localizadorDe(campo.campo_id));
    if (sinLocalizador) c1.reason = faltaCampo(sinLocalizador.campo_id);
  }
  casos.push(c1);
  for (const campo of tabla2.filter((candidato) => candidato.orden_tabulacion && candidato.orden_tabulacion.tipo === 'relativo')) {
    casos.push({ ...plantilla(), case_id: 'C1', field_id: campo.campo_id, applies: true, inputs: {}, reason: 'orden relativo (no ejecutable)' });
  }

  // C2: deshabilitados sin foco. El condicional no se verifica: reproducir el envío dejaría datos guardados.
  for (const campo of tabla2) {
    const valor = campo.deshabilitado && campo.deshabilitado.valor;
    if (valor !== 'si' && valor !== 'condicional') continue;
    const caso = { ...plantilla(), case_id: 'C2', field_id: campo.campo_id, applies: true, inputs: { localizador: localizadorDe(campo.campo_id) } };
    if (valor === 'condicional') caso.reason = `deshabilitado condicional (${(campo.deshabilitado.detalle || 'sin detalle')}): no ejecutable`;
    else if (!caso.inputs.localizador) caso.reason = faltaCampo(campo.campo_id);
    casos.push(caso);
  }

  // C3: foco automático. Solo cuando ocurre al abrir; cualquier otro momento no es ejecutable.
  for (const campo of tabla2.filter((candidato) => candidato.foco_automatico && candidato.foco_automatico.tiene)) {
    const caso = { ...plantilla(), case_id: 'C3', field_id: campo.campo_id, applies: true, inputs: { localizador: localizadorDe(campo.campo_id), momento: campo.foco_automatico.momento } };
    if (!campo.foco_automatico.momento) caso.reason = 'dato faltante: momento del foco automático (Tabla 2)';
    else if (!momentoEsApertura(campo.foco_automatico.momento)) caso.reason = `foco automático con un momento distinto a la apertura ("${campo.foco_automatico.momento}"): no ejecutable`;
    else if (!caso.inputs.localizador) caso.reason = faltaCampo(campo.campo_id);
    casos.push(caso);
  }

  // C4 a C6: modal con datos sin guardar.
  const hayDescarte = botones.descarte_seguir_editando && botones.descarte_confirmar;
  const datosModal = { modal, campos_con_valor: conValor.map((campo) => ({ campo_id: campo.campo_id, localizador: campo.localizador, valor: String(campo.valor_de_prueba) })) };
  const razonModal = () => {
    if (!modal) return 'dato faltante: paso "esperar dialog" en pasos_abrir (Tabla 4.1) para ubicar el modal';
    if (!conValor.length) return 'dato faltante: valor de prueba (ningún campo de la Tabla 4.2 lo tiene)';
    return null;
  };
  const c4 = { ...plantilla(), case_id: 'C4', field_id: null, applies: vive, inputs: datosModal };
  if (vive) c4.reason = razonModal();
  casos.push(c4);
  const c5 = { ...plantilla(), case_id: 'C5', field_id: null, applies: vive, inputs: { ...datosModal, descarte_seguir_editando: botones.descarte_seguir_editando || null, descarte_confirmar: botones.descarte_confirmar || null } };
  if (vive) c5.reason = razonModal() || (!botones.descarte_seguir_editando ? faltaBoton('descarte_seguir_editando') : !botones.descarte_confirmar ? faltaBoton('descarte_confirmar') : null);
  casos.push(c5);
  const c6 = { ...plantilla(), case_id: 'C6', field_id: null, applies: vive, inputs: { ...c5.inputs, cancelar: botones.cancelar || null } };
  if (vive) c6.reason = razonModal() || (!botones.cancelar ? faltaBoton('cancelar') : !hayDescarte ? faltaBoton(botones.descarte_seguir_editando ? 'descarte_confirmar' : 'descarte_seguir_editando') : null);
  casos.push(c6);

  // C7 y C8: advertencia no-saltable por pre-llenado.
  const origenes = tabla3.filter((fila) => fila.origen && fila.origen.valor).map((fila) => fila.origen.valor);
  const datosAdvertencia = { modal, guardar: botones.guardar || null, advertencia_confirmar: botones.advertencia_confirmar || null, cancelar: botones.cancelar || null, descarte_confirmar: botones.descarte_confirmar || null, campos_con_valor: datosModal.campos_con_valor };
  const razonAdvertencia = () => (!botones.guardar ? faltaBoton('guardar') : !botones.advertencia_confirmar ? faltaBoton('advertencia_confirmar') : null);
  const c7 = { ...plantilla(), case_id: 'C7', field_id: null, applies: origenes.includes('extraccion_ia'), inputs: datosAdvertencia };
  if (c7.applies) c7.reason = razonAdvertencia();
  casos.push(c7);
  const c8 = { ...plantilla(), case_id: 'C8', field_id: null, applies: origenes.includes('ambas'), inputs: { ...datosAdvertencia, registro_requerido: acceso.registro_requerido || null } };
  if (c8.applies) c8.reason = razonAdvertencia() || (!acceso.registro_requerido ? 'dato faltante: registro que debe existir (Tabla 4.1)' : null);
  casos.push(c8);
  return casos;
}

// FR-005: `passes` solo si todos los casos ejecutables pasan y hay al menos uno. Sin ningún caso
// ejecutable, o con un error de ambiente, no se pudo validar.
function calcularResumen(resultados, errorDeAmbiente) {
  if (errorDeAmbiente) return 'could_not_validate';
  const ejecutados = resultados.filter((resultadoCaso) => resultadoCaso.result === 'pass' || resultadoCaso.result === 'fail');
  if (ejecutados.some((resultadoCaso) => resultadoCaso.result === 'fail')) return 'fails';
  return ejecutados.length ? 'passes' : 'could_not_validate';
}

// Reemplaza en todo el valor los textos secretos (y su forma escapada en JSON) por [redactado].
function censurar(valor, secretos) {
  const textos = secretos.filter((secreto) => typeof secreto === 'string' && secreto.length >= 3);
  if (!textos.length) return valor;
  const formas = textos.flatMap((secreto) => [secreto, JSON.stringify(secreto).slice(1, -1)]);
  const limpiar = (elemento) => {
    if (typeof elemento === 'string') return formas.reduce((acc, forma) => acc.split(forma).join('[redactado]'), elemento);
    if (Array.isArray(elemento)) return elemento.map(limpiar);
    if (elemento && typeof elemento === 'object') return Object.fromEntries(Object.entries(elemento).map(([clave, valorAnidado]) => [clave, limpiar(valorAnidado)]));
    return elemento;
  };
  return limpiar(valor);
}

function resultado(caso, campos) {
  return { case_id: caso.case_id, field_id: caso.field_id, result: 'pass', expected: '', observed: null, reason: null, screenshot_png_base64: null, ...campos };
}

function noEjecutable(caso, expected, reason) {
  return resultado(caso, { result: 'not_executable', expected, observed: null, reason });
}

class ErrorDeAmbiente extends Error {
  constructor(stage, message) {
    super(message);
    this.stage = stage;
  }
}

class ErrorDeCaso extends Error {
  constructor(tipo, detalle) {
    super(detalle);
    this.tipo = tipo; // 'no_encontrado' | 'tiempo_agotado'
  }
}

// ---------------------------------------------------------------------------------------------
// Adaptador de Playwright. Todo el contacto con el navegador pasa por aquí: la lógica de los casos
// solo usa estos métodos, así que se prueba con un adaptador simulado.

function crearAdaptador(page, opciones, login) {
  const espera = (opciones && opciones.step_timeout_ms) || TIMEOUT_POR_DEFECTO_MS;
  // Lo que debería aparecer o desaparecer (confirmaciones, advertencias, cierre del modal) no espera todo el
  // tiempo del paso: si no ocurre en unos segundos, es el defecto que el caso busca.
  const esperaVerificacion = (opciones && opciones.expect_timeout_ms) || Math.min(espera, 3000);
  page.on('dialog', (dialogo) => dialogo.accept().catch(() => {})); // beforeunload: nunca deja la navegación colgada.
  const ubicar = (loc) => {
    const localizadorResuelto = resolverLocalizador(loc);
    if (!localizadorResuelto) throw new ErrorDeCaso('no_encontrado', `localizador inválido: ${describirLocalizador(loc)}`);
    return localizadorResuelto.tipo === 'testid' ? page.getByTestId(localizadorResuelto.testid) : page.getByRole(localizadorResuelto.rol, { name: localizadorResuelto.nombre, exact: true });
  };
  const encontrar = async (loc) => {
    const ubicado = ubicar(loc).first();
    try {
      await ubicado.waitFor({ state: 'attached', timeout: espera });
    } catch {
      throw new ErrorDeCaso('no_encontrado', `elemento no encontrado: ${describirLocalizador(loc)}`);
    }
    return ubicado;
  };
  const alAgotarse = (accion, detalle) => accion.catch((error) => {
    if (error instanceof ErrorDeCaso) throw error;
    throw new ErrorDeCaso(error && error.name === 'TimeoutError' ? 'tiempo_agotado' : 'no_encontrado', detalle);
  });
  return {
    async iniciarSesion(baseUrl, credenciales) {
      const configLogin = { ruta: '/login', ...(login || {}) };
      await page.goto(`${baseUrl}${configLogin.ruta}`, { timeout: espera, waitUntil: 'load' });
      await page.locator(configLogin.usuario || 'input[type="email"], #identificador').first().fill(credenciales.username, { timeout: espera });
      const continuar = page.getByRole('button', { name: configLogin.continuar || 'Continuar', exact: true });
      if (await continuar.count()) await continuar.first().click({ timeout: espera });
      await page.locator(configLogin.contrasena || 'input[type="password"]').first().fill(credenciales.password, { timeout: espera });
      await page.getByRole('button', { name: configLogin.enviar || 'Iniciar sesión', exact: true }).first().click({ timeout: espera });
      await page.waitForURL((url) => !url.pathname.startsWith(configLogin.ruta), { timeout: espera });
    },
    async abrir(baseUrl, acceso) {
      await page.goto(`${baseUrl}${acceso.ruta}`, { timeout: espera, waitUntil: 'load' });
      for (const paso of acceso.pasos_abrir || []) {
        const elemento = await encontrar(paso.localizador);
        if (paso.accion === 'clic') await elemento.click({ timeout: espera });
        else if (paso.accion === 'escribir') await elemento.fill(String(paso.valor ?? ''), { timeout: espera });
        else if (paso.accion === 'esperar') await elemento.waitFor({ state: 'visible', timeout: espera });
        else throw new ErrorDeCaso('no_encontrado', `acción desconocida en pasos_abrir: ${paso.accion}`);
      }
      await this.estabilizar();
    },
    // Espera a que la pantalla se estabilice: carga completa y dos cuadros de animación (FR de tiempo agotado).
    async estabilizar() {
      await alAgotarse(page.waitForLoadState('load', { timeout: espera }), 'tiempo agotado esperando que la pantalla se estabilice');
      await alAgotarse(page.evaluate(() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)))), 'tiempo agotado esperando que la pantalla se estabilice');
    },
    async existe(loc) {
      await encontrar(loc);
      return true;
    },
    async visible(loc) {
      return ubicar(loc).first().isVisible();
    },
    async esperarVisible(loc, ms) {
      try {
        await ubicar(loc).first().waitFor({ state: 'visible', timeout: ms ?? esperaVerificacion });
        return true;
      } catch {
        return false;
      }
    },
    async esperarOculto(loc, ms) {
      try {
        await ubicar(loc).first().waitFor({ state: 'hidden', timeout: ms ?? esperaVerificacion });
        return true;
      } catch {
        return false;
      }
    },
    async enfocar(loc) {
      await alAgotarse((await encontrar(loc)).focus({ timeout: espera }), `no se pudo enfocar ${describirLocalizador(loc)}`);
    },
    async presionar(tecla) {
      await page.keyboard.press(tecla);
    },
    async esperar(ms) {
      await page.waitForTimeout(ms);
    },
    // Devuelve el campo_id que tiene el foco entre los campos dados, o null si es otro elemento.
    async campoConFoco(campos) {
      const presentes = [];
      const manejadores = [];
      for (const campo of campos) {
        const ubicado = ubicar(campo.localizador).first();
        if (await ubicado.count()) {
          presentes.push(campo);
          manejadores.push(await ubicado.elementHandle());
        }
      }
      const indice = await page.evaluate((elementos) => elementos.findIndex((elemento) => elemento === document.activeElement), manejadores);
      return indice >= 0 ? presentes[indice].campo_id : null;
    },
    async llenar(loc, valor) {
      await alAgotarse((await encontrar(loc)).fill(valor, { timeout: espera }), `no se pudo escribir en ${describirLocalizador(loc)}`);
    },
    async valorDe(loc) {
      return alAgotarse((await encontrar(loc)).inputValue({ timeout: espera }), `no se pudo leer el valor de ${describirLocalizador(loc)}`);
    },
    async clic(loc) {
      await alAgotarse((await encontrar(loc)).click({ timeout: espera }), `no se pudo hacer clic en ${describirLocalizador(loc)}`);
    },
    // Clic en un punto fuera del diálogo (FR-007: no es un cierre explícito, es lo que se está probando).
    async clicAfuera(modal) {
      const caja = modal ? await (await encontrar(modal)).boundingBox() : null;
      const tamano = page.viewportSize() || { width: 1280, height: 720 };
      const candidatos = [[2, 2], [tamano.width - 2, 2], [2, tamano.height - 2], [tamano.width - 2, tamano.height - 2]];
      const punto = candidatos.find(([posX, posY]) => !caja || posX < caja.x || posX > caja.x + caja.width || posY < caja.y || posY > caja.y + caja.height);
      if (!punto) throw new ErrorDeCaso('no_encontrado', 'no hay un punto fuera del modal donde hacer clic');
      await page.mouse.click(punto[0], punto[1]);
      await this.estabilizar();
    },
    // Mientras dura, toda petición que no sea de lectura se aborta y se anota: así un intento de guardar
    // que la aplicación no frena nunca llega al servidor (FR-007, SC-007).
    async protegerContraGuardado() {
      const bloqueadas = [];
      const manejador = (ruta) => {
        const peticion = ruta.request();
        if (METODOS_QUE_LEEN.includes(peticion.method())) return ruta.fallback();
        bloqueadas.push(`${peticion.method()} ${peticion.url().replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0]}`);
        return ruta.abort('blockedbyclient');
      };
      await page.route('**/*', manejador);
      return { bloqueadas: () => [...bloqueadas], liberar: () => page.unroute('**/*', manejador) };
    },
    async captura() {
      try {
        return (await page.screenshot({ type: 'png' })).toString('base64');
      } catch {
        return null;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Ejecución de los casos

const sinGuion = (ids) => ids.join(' → ');

// Recorre el formulario con Tab desde el primer campo con posición y devuelve los campo_id enfocados,
// uno por pulsación (null = el foco quedó en un elemento que no es un campo conocido).
async function recorrerConTab(adaptador, camposT4, primero, pulsaciones) {
  const conocidos = camposT4.filter((campo) => localizadorValido(campo.localizador)).map((campo) => ({ campo_id: campo.campo_id, localizador: campo.localizador }));
  const visitados = [];
  if (primero) {
    await adaptador.enfocar(primero.localizador);
    visitados.push(await adaptador.campoConFoco(conocidos));
  }
  for (let i = 0; i < pulsaciones; i++) {
    await adaptador.presionar('Tab');
    visitados.push(await adaptador.campoConFoco(conocidos));
  }
  return visitados;
}

async function llenarDatos(adaptador, campos) {
  const base = {};
  for (const campo of campos) {
    await adaptador.llenar(campo.localizador, campo.valor);
    base[campo.campo_id] = await adaptador.valorDe(campo.localizador);
  }
  return base;
}

async function datosConservados(adaptador, campos, base) {
  const cambios = [];
  for (const campo of campos) if ((await adaptador.valorDe(campo.localizador)) !== base[campo.campo_id]) cambios.push(campo.campo_id);
  return cambios;
}

async function ejecutarCaso(adaptador, caso, contexto) {
  const { schema, input } = contexto;
  const campos = (schema.prueba_nivel_2.campos || []).filter((campo) => localizadorValido(campo.localizador));
  const acceso = schema.prueba_nivel_2.acceso;
  const reabrir = () => adaptador.abrir(input.base_url, acceso);
  const conValor = caso.inputs.campos_con_valor || [];
  const falla = async (expected, observed) => resultado(caso, { result: 'fail', expected, observed, screenshot_png_base64: input.options.capture_failures ? await adaptador.captura() : null });
  const pasa = (expected, observed) => resultado(caso, { result: 'pass', expected, observed });

  if (caso.case_id === 'C1') {
    const orden = caso.inputs.orden;
    const esperado = orden.map((campo) => campo.campo_id);
    await reabrir();
    for (const campo of orden) await adaptador.existe(campo.localizador);
    const visitados = await recorrerConTab(adaptador, campos, orden[0], esperado.length - 1);
    const desvio = esperado.findIndex((id, i) => visitados[i] !== id);
    const expected = `el foco recorre ${sinGuion(esperado)} con Tab`;
    if (desvio === -1) return pasa(expected, `el foco recorrió ${sinGuion(visitados)}`);
    return falla(expected, `primer desvío en la posición ${desvio + 1}: se esperaba "${esperado[desvio]}" y el foco quedó en ${visitados[desvio] ? `"${visitados[desvio]}"` : 'otro elemento'} (recorrido: ${visitados.map((visitado) => visitado ?? 'otro').join(' → ')})`);
  }

  if (caso.case_id === 'C2') {
    await reabrir();
    await adaptador.existe(caso.inputs.localizador);
    const posicionados = (schema.tabla_2_interaccion || []).filter((campo) => campo.orden_tabulacion && campo.orden_tabulacion.tipo === 'posicion' && Number.isInteger(campo.orden_tabulacion.posicion)).sort((primero, segundo) => primero.orden_tabulacion.posicion - segundo.orden_tabulacion.posicion);
    const primero = posicionados.map((campo) => campos.find((campoT4) => campoT4.campo_id === campo.campo_id)).find(Boolean);
    const visitados = await recorrerConTab(adaptador, campos, primero, campos.length + 1);
    const expected = `"${caso.field_id}" no recibe foco durante el recorrido con Tab`;
    if (!visitados.includes(caso.field_id)) return pasa(expected, `el recorrido pasó por ${sinGuion(visitados.map((visitado) => visitado ?? 'otro'))} sin enfocarlo`);
    return falla(expected, `el campo recibió foco en la pulsación ${visitados.indexOf(caso.field_id) + 1} del recorrido`);
  }

  if (caso.case_id === 'C3') {
    await reabrir();
    await adaptador.existe(caso.inputs.localizador);
    const conocidos = campos.map((campo) => ({ campo_id: campo.campo_id, localizador: campo.localizador }));
    const enfocado = await adaptador.campoConFoco(conocidos);
    const expected = `al abrir, el foco queda en "${caso.field_id}"`;
    if (enfocado === caso.field_id) return pasa(expected, `el foco quedó en "${enfocado}"`);
    return falla(expected, `el foco quedó en ${enfocado ? `"${enfocado}"` : 'otro elemento'}`);
  }

  if (caso.case_id === 'C4') {
    await reabrir();
    const base = await llenarDatos(adaptador, conValor);
    await adaptador.clicAfuera(caso.inputs.modal);
    const abierto = await adaptador.visible(caso.inputs.modal);
    const perdidos = abierto ? await datosConservados(adaptador, conValor, base) : [];
    const expected = 'un clic fuera del modal con datos escritos no lo cierra y los datos siguen ahí';
    if (abierto && !perdidos.length) return pasa(expected, 'el modal siguió abierto con los datos');
    return falla(expected, abierto ? `el modal siguió abierto pero cambió el valor de ${perdidos.join(', ')}` : 'el modal se cerró y los datos escritos se perdieron');
  }

  if (caso.case_id === 'C5' || caso.case_id === 'C6') {
    await reabrir();
    const base = await llenarDatos(adaptador, conValor);
    const { descarte_seguir_editando: seguir, descarte_confirmar: descartar, modal } = caso.inputs;
    const abrirConfirmacion = async () => {
      if (caso.case_id === 'C5') await adaptador.presionar('Escape');
      else await adaptador.clic(caso.inputs.cancelar);
      return adaptador.esperarVisible(seguir);
    };
    const accion = caso.case_id === 'C5' ? 'Esc' : 'Cancelar';
    if (!(await abrirConfirmacion())) return falla(`${accion} con datos escritos muestra la confirmación de descarte`, `no apareció la confirmación de descarte${(await adaptador.visible(modal)) ? '' : ' y el modal se cerró'}`);
    await adaptador.clic(seguir);
    const sigueAbierto = await adaptador.visible(modal);
    const perdidos = sigueAbierto ? await datosConservados(adaptador, conValor, base) : [];
    const expectedSeguir = `"seguir editando" conserva el modal abierto y los datos${caso.case_id === 'C6' ? ', y "descartar" lo cierra' : ''}`;
    if (!sigueAbierto || perdidos.length) return falla(`${accion} con datos muestra la confirmación; ${expectedSeguir}`, sigueAbierto ? `tras "seguir editando" cambió el valor de ${perdidos.join(', ')}` : 'tras "seguir editando" el modal se cerró');
    if (caso.case_id === 'C5') return pasa(`${accion} con datos muestra la confirmación; ${expectedSeguir}`, 'apareció la confirmación y "seguir editando" conservó el modal y los datos');
    if (!(await abrirConfirmacion())) return falla(`${accion} con datos muestra la confirmación; ${expectedSeguir}`, 'la segunda vez no apareció la confirmación de descarte');
    await adaptador.clic(descartar);
    const cerrado = await adaptador.esperarOculto(modal);
    if (cerrado) return pasa(`${accion} con datos muestra la confirmación; ${expectedSeguir}`, 'apareció la confirmación, "seguir editando" conservó los datos y "descartar" cerró el modal');
    return falla(`${accion} con datos muestra la confirmación; ${expectedSeguir}`, '"descartar" no cerró el modal');
  }

  // C7 y C8: advertencia no-saltable. Se intenta guardar con las escrituras bloqueadas.
  await reabrir();
  await llenarDatos(adaptador, conValor);
  const { guardar, advertencia_confirmar: confirmar, cancelar, descarte_confirmar: descartar } = caso.inputs;
  const notaC8 = caso.case_id === 'C8' ? ' (verificar que el registro de prueba tenga la discrepancia entre IA y BD)' : '';
  const expected = `al intentar guardar aparece una advertencia que no desaparece sola ni con clic afuera y solo se cierra con su botón${caso.case_id === 'C8' ? ', porque las dos fuentes del campo no coinciden' : ''}`;
  const { guardia } = contexto;
  const yaBloqueadas = guardia.bloqueadas().length;
  await adaptador.clic(guardar);
  if (!(await adaptador.esperarVisible(confirmar))) {
    const intentos = guardia.bloqueadas().slice(yaBloqueadas);
    return falla(expected, `no apareció la advertencia${intentos.length ? ` y la aplicación intentó guardar (petición bloqueada: ${intentos.join(', ')})` : ''}${notaC8}`);
  }
  await adaptador.esperar(input.options.warning_wait_ms ?? ESPERA_ADVERTENCIA_MS);
  if (!(await adaptador.visible(confirmar))) return falla(expected, 'la advertencia desapareció sola');
  await adaptador.clicAfuera(caso.inputs.modal);
  if (!(await adaptador.visible(confirmar))) return falla(expected, 'la advertencia se cerró con un clic afuera');
  await adaptador.clic(confirmar);
  if (!(await adaptador.esperarOculto(confirmar))) return falla(expected, 'el botón de confirmación no cerró la advertencia');
  // Descarta sin guardar: el único cierre del formulario permitido.
  if (cancelar && descartar) {
    try {
      await adaptador.clic(cancelar);
      if (await adaptador.esperarVisible(descartar, 2000)) await adaptador.clic(descartar);
    } catch {
      // Si no se puede descartar, el siguiente caso reabre el formulario y la navegación descarta lo escrito.
    }
  }
  return pasa(expected, 'la advertencia apareció, no se cerró sola ni con clic afuera y su botón la cerró');
}

function mensajeDeError(error) {
  return String((error && error.message) || error).split('\n')[0];
}

// Núcleo: ejecuta el plan de casos con un adaptador (el de Playwright o uno simulado) y arma el reporte.
async function ejecutarConAdaptador(adaptadorRecibido, input, fabricaDeAdaptador) {
  const inicio = Date.now();
  const schema = input.schema;
  const dato = schema.datos_formulario || {};
  const opciones = { step_timeout_ms: TIMEOUT_POR_DEFECTO_MS, capture_failures: true, ...(input.options || {}) };
  const entrada = { ...input, options: opciones };
  const reporte = {
    form_id: dato.id ?? null,
    form_name: dato.formulario ?? null,
    environment: input.environment ?? null,
    schema_source: input.schema_source ?? null,
    schema_hash: (schema.exportacion || {}).hash_origen ?? null,
    runner_version: RUNNER_VERSION,
    base_url: input.base_url ?? null,
    commit_sha: input.commit_sha ?? null,
    started_at: new Date(inicio).toISOString(),
    duration_ms: 0,
    summary: 'could_not_validate',
    environment_error: null,
    cases: [],
  };
  const terminar = (error) => {
    reporte.environment_error = error ? { stage: error.stage, message: error.message } : null;
    reporte.summary = calcularResumen(reporte.cases, reporte.environment_error);
    reporte.duration_ms = Date.now() - inicio;
    const credenciales = input.credentials ? [input.credentials.username, input.credentials.password] : [];
    return censurar(reporte, credenciales);
  };

  if (!['local', 'staging'].includes(input.environment)) return terminar({ stage: 'entrada', message: `environment inválido: ${input.environment}` });
  if (apuntaAProduccion(input.base_url, input.production_url)) return terminar({ stage: 'produccion', message: 'base_url apunta a producción o falta production_url: el runner solo corre en local o en staging' });
  if (!schema.prueba_nivel_2) return terminar({ stage: 'schema', message: 'sin Tabla 4: no hay datos para ejecutar la prueba automatizada' });

  const plan = generarCasos(schema).filter((caso) => caso.applies);
  const contexto = { schema, input: entrada };
  const adaptador = adaptadorRecibido || fabricaDeAdaptador(entrada);
  try {
    if (input.credentials) await adaptador.iniciarSesion(input.base_url, input.credentials);
  } catch (error) {
    return terminar({ stage: 'login', message: `no se pudo iniciar sesión: ${mensajeDeError(error)}` });
  }
  try {
    await adaptador.abrir(input.base_url, schema.prueba_nivel_2.acceso);
  } catch (error) {
    return terminar({ stage: error instanceof ErrorDeAmbiente ? error.stage : 'abrir', message: `no se pudo abrir el formulario: ${mensajeDeError(error)}` });
  }
  // La guardia cubre todo el recorrido, no solo C7 y C8: ningún caso puede guardar datos.
  contexto.guardia = await adaptador.protegerContraGuardado();
  try {
    for (const caso of plan) {
      if (caso.reason) {
        reporte.cases.push(noEjecutable(caso, 'el caso necesita datos del schema', caso.reason));
        continue;
      }
      try {
        reporte.cases.push(await ejecutarCaso(adaptador, caso, contexto));
      } catch (error) {
        const motivo = error instanceof ErrorDeCaso ? (error.tipo === 'tiempo_agotado' ? `tiempo agotado: ${error.message}` : error.message) : `error inesperado: ${mensajeDeError(error)}`;
        reporte.cases.push(noEjecutable(caso, 'el caso se ejecuta con los datos del schema', motivo));
      }
    }
  } finally {
    await contexto.guardia.liberar();
  }
  return terminar(null);
}

// Punto de entrada del navegador: recibe `page` e `input` (ya incrustado por armarCodigo).
async function ejecutarNivel2(page, input) {
  return ejecutarConAdaptador(null, input, (entrada) => crearAdaptador(page, entrada.options, entrada.login));
}
// <<RUNNER_FIN>>

// ---------------------------------------------------------------------------------------------
// Fuera del navegador: armado del código que se envía a browser_run_code_unsafe.

const MARCA_INICIO = '// <<RUNNER_INICIO>>';
const MARCA_FIN = '// <<RUNNER_FIN>>';

// Devuelve el cuerpo del runner (lo que viaja al navegador) a partir del texto de este archivo.
function cuerpoDelRunner(fuente) {
  const desde = fuente.indexOf(MARCA_INICIO);
  const hasta = fuente.indexOf(MARCA_FIN);
  if (desde < 0 || hasta < desde) throw new Error('la fuente del runner no tiene las marcas RUNNER_INICIO y RUNNER_FIN');
  return fuente.slice(desde + MARCA_INICIO.length, hasta).trim();
}

// Arma el código `async (page) => {...}` con `const input = {...}` incrustado. Con `credentials: null`, las
// credenciales son los marcadores sin comillas que sustituye el proxy del MCP alojado (ADR 0002 de ese repo); n8n nunca
// ve el secreto. Nada del schema se evalúa como código: solo viaja como JSON.
function armarCodigo(fuente, input) {
  const rol = (((input.schema || {}).prueba_nivel_2 || {}).acceso || {}).rol;
  const conMarcadores = input.credentials === null || input.credentials === undefined;
  const base = JSON.stringify({ ...input, credentials: '__CREDENCIALES__' });
  const credenciales = conMarcadores
    ? `{ "username": {{secreto:${nombreSecretoRol(rol, 'NIVEL2_USUARIO')}}}, "password": {{secreto:${nombreSecretoRol(rol, 'NIVEL2_CONTRASENA')}}} }`
    : JSON.stringify(input.credentials);
  return `async (page) => {\nconst input = ${base.replace('"__CREDENCIALES__"', () => credenciales)};\n${cuerpoDelRunner(fuente)}\nreturn await ejecutarNivel2(page, input);\n}`;
}

export {
  RUNNER_VERSION,
  apuntaAProduccion,
  armarCodigo,
  calcularResumen,
  censurar,
  cuerpoDelRunner,
  describirLocalizador,
  ejecutarConAdaptador,
  ejecutarNivel2,
  crearAdaptador,
  ErrorDeAmbiente,
  ErrorDeCaso,
  generarCasos,
  localizadorDelModal,
  momentoEsApertura,
  nombreSecretoRol,
  resolverLocalizador,
};
