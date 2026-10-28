// Pruebas de POL-263: la lógica pura del runner de Nivel 2 (scripts/nivel2-runner.js), sin navegador.
// Se corren con: node --test "plugins/validacion-formularios/tests/*.test.js"

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RUNNER = path.join(__dirname, '..', 'skills', 'validacion-formularios-polaria', 'scripts', 'nivel2-runner.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'modal-simple.json');
const SIN_TABLA_4 = path.join(__dirname, 'fixtures', 'sin-tabla-4.json');
const PRODUCCION = 'https://wms.polaria.tech';
const CONTRASENA = 'Clave-123';

const leer = (archivo) => JSON.parse(fs.readFileSync(archivo, 'utf8'));
const clonar = (valor) => JSON.parse(JSON.stringify(valor));
const localizadorTestid = (testid) => ({ testid, rol: null, nombre: null, texto_original: `testid=${testid}` });

// El runner es un módulo ES con extensión .js: se importa desde su texto para no depender de la
// detección de módulos de la versión de Node.
async function cargarRunner() {
  const fuente = fs.readFileSync(RUNNER, 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);
}

const idsDeCasos = (casos) => casos.map((caso) => `${caso.case_id}:${caso.field_id}`);
const casoDe = (casos, caseId, fieldId = null) => casos.find((caso) => caso.case_id === caseId && caso.field_id === fieldId);

// --- generarCasos ----------------------------------------------------------------------------

test('generarCasos: el formulario con modal produce 10 casos en orden estable', async () => {
  const { generarCasos } = await cargarRunner();
  const casos = generarCasos(leer(FIXTURE));
  assert.deepStrictEqual(idsDeCasos(casos), [
    'C1:null', 'C1:observaciones', 'C2:codigo', 'C2:observaciones', 'C3:nombre', 'C4:null', 'C5:null', 'C6:null', 'C7:null', 'C8:null',
  ]);
  assert.deepStrictEqual(casos.filter((caso) => !caso.applies).map((caso) => caso.case_id), ['C7', 'C8']);
  assert.deepStrictEqual(casoDe(casos, 'C1').inputs.orden.map((campo) => campo.campo_id), ['nombre', 'ciudad', 'capacidad_m3']);
  for (const caso of [casoDe(casos, 'C1'), casoDe(casos, 'C2', 'codigo'), casoDe(casos, 'C3', 'nombre'), casoDe(casos, 'C4'), casoDe(casos, 'C5'), casoDe(casos, 'C6')]) {
    assert.strictEqual(caso.reason, null, `${caso.case_id} ${caso.field_id}`);
  }
});

test('generarCasos: el orden relativo y el deshabilitado condicional no son ejecutables y dicen por qué', async () => {
  const { generarCasos } = await cargarRunner();
  const casos = generarCasos(leer(FIXTURE));
  assert.strictEqual(casoDe(casos, 'C1', 'observaciones').reason, 'orden relativo (no ejecutable)');
  assert.match(casoDe(casos, 'C2', 'observaciones').reason, /deshabilitado condicional/);
});

test('generarCasos: sin Tabla 4 no genera ningún caso', async () => {
  const { generarCasos } = await cargarRunner();
  assert.deepStrictEqual(generarCasos(leer(SIN_TABLA_4)), []);
});

test('generarCasos: un dato faltante en la Tabla 4 deja el caso con su motivo y no inventa el dato', async () => {
  const { generarCasos } = await cargarRunner();

  const sinCancelar = clonar(leer(FIXTURE));
  sinCancelar.prueba_nivel_2.botones.cancelar = null;
  const casosSinCancelar = generarCasos(sinCancelar);
  assert.match(casoDe(casosSinCancelar, 'C6').reason, /botón cancelar/);
  assert.strictEqual(casoDe(casosSinCancelar, 'C5').reason, null);

  const sinModal = clonar(leer(FIXTURE));
  sinModal.prueba_nivel_2.acceso.pasos_abrir = sinModal.prueba_nivel_2.acceso.pasos_abrir.filter((paso) => paso.accion !== 'esperar');
  const casosSinModal = generarCasos(sinModal);
  for (const caseId of ['C4', 'C5', 'C6']) assert.match(casoDe(casosSinModal, caseId).reason, /esperar dialog/, caseId);

  const sinLocalizador = clonar(leer(FIXTURE));
  sinLocalizador.prueba_nivel_2.campos.find((campo) => campo.campo_id === 'ciudad').localizador = { testid: null, rol: null, nombre: null, texto_original: '—' };
  assert.match(casoDe(generarCasos(sinLocalizador), 'C1').reason, /localizador del campo ciudad/);
});

test('generarCasos: C7 y C8 aplican según el origen del pre-llenado y piden sus datos', async () => {
  const { generarCasos } = await cargarRunner();
  const schema = clonar(leer(FIXTURE));
  schema.tabla_3_prellenado = [{ campo: 'nombre', origen: { valor: 'extraccion_ia' } }, { campo: 'ciudad', origen: { valor: 'ambas' } }];

  const sinConfirmar = generarCasos(schema);
  assert.strictEqual(casoDe(sinConfirmar, 'C7').applies, true);
  assert.strictEqual(casoDe(sinConfirmar, 'C8').applies, true);
  assert.match(casoDe(sinConfirmar, 'C7').reason, /botón advertencia_confirmar/);

  schema.prueba_nivel_2.botones.advertencia_confirmar = localizadorTestid('btn-confirmar');
  const conConfirmar = generarCasos(schema);
  assert.strictEqual(casoDe(conConfirmar, 'C7').reason, null);
  assert.match(casoDe(conConfirmar, 'C8').reason, /registro que debe existir/);
});

// --- funciones puras -------------------------------------------------------------------------

test('apuntaAProduccion: rechaza la URL de producción en cualquier forma y rechaza si no hay URL de producción', async () => {
  const { apuntaAProduccion } = await cargarRunner();
  assert.strictEqual(apuntaAProduccion(PRODUCCION, PRODUCCION), true);
  assert.strictEqual(apuntaAProduccion(`${PRODUCCION}/inventario/bodegas`, PRODUCCION), true);
  assert.strictEqual(apuntaAProduccion('HTTPS://WMS.POLARIA.TECH/', PRODUCCION), true);
  assert.strictEqual(apuntaAProduccion('http://localhost:3001', PRODUCCION), false);
  assert.strictEqual(apuntaAProduccion('https://staging.polaria.tech', PRODUCCION), false);
  assert.strictEqual(apuntaAProduccion('http://localhost:3001', ''), true);
  assert.strictEqual(apuntaAProduccion('http://localhost:3001', undefined), true);
});

test('censurar: reemplaza el secreto en todo el valor, también en su forma escapada, y respeta lo corto', async () => {
  const { censurar } = await cargarRunner();
  const secreto = 'Cla"ve-123';
  const valor = { mensaje: `falló con ${secreto}`, anidado: [{ json: JSON.stringify({ clave: secreto }) }], numero: 7, nulo: null };
  const limpio = censurar(valor, [secreto]);
  assert.ok(!JSON.stringify(limpio).includes('ve-123'), JSON.stringify(limpio));
  assert.match(limpio.mensaje, /\[redactado\]/);
  assert.strictEqual(limpio.numero, 7);
  assert.strictEqual(limpio.nulo, null);
  assert.strictEqual(censurar('ab y ab', ['ab']), 'ab y ab');
  assert.strictEqual(censurar('sin secretos', []), 'sin secretos');
});

test('calcularResumen: passes solo con al menos un pass y ningún fail; un error de ambiente no es ni pass ni fail', async () => {
  const { calcularResumen } = await cargarRunner();
  const resultado = (result) => ({ result });
  assert.strictEqual(calcularResumen([resultado('pass'), resultado('not_executable')], null), 'passes');
  assert.strictEqual(calcularResumen([resultado('pass'), resultado('fail')], null), 'fails');
  assert.strictEqual(calcularResumen([resultado('not_executable')], null), 'could_not_validate');
  assert.strictEqual(calcularResumen([], null), 'could_not_validate');
  assert.strictEqual(calcularResumen([resultado('pass')], { stage: 'login', message: 'x' }), 'could_not_validate');
});

test('momentoEsApertura y nombreSecretoRol normalizan acentos, mayúsculas y espacios', async () => {
  const { momentoEsApertura, nombreSecretoRol } = await cargarRunner();
  assert.strictEqual(momentoEsApertura('Al abrir el modal'), true);
  assert.strictEqual(momentoEsApertura('al abrir'), true);
  assert.strictEqual(momentoEsApertura('al enfocar el campo'), false);
  assert.strictEqual(nombreSecretoRol('Administrador de cuenta', 'NIVEL2_USUARIO'), 'NIVEL2_USUARIO_ADMINISTRADOR_DE_CUENTA');
  assert.strictEqual(nombreSecretoRol(' Operación  móvil ', 'NIVEL2_CONTRASENA'), 'NIVEL2_CONTRASENA_OPERACION_MOVIL');
});

// --- ejecutarConAdaptador (con un adaptador simulado) ----------------------------------------

function entrada(extra = {}) {
  return {
    environment: 'local',
    base_url: 'http://localhost:3001',
    production_url: PRODUCCION,
    schema: leer(FIXTURE),
    schema_source: 'working_copy',
    credentials: { username: 'ana@prueba.test', password: CONTRASENA },
    ...extra,
  };
}

function adaptadorSimulado(sobrescribe = {}) {
  const llamadas = [];
  return {
    llamadas,
    iniciarSesion: async () => { llamadas.push('iniciarSesion'); },
    abrir: async () => { llamadas.push('abrir'); },
    ...sobrescribe,
  };
}

test('ejecutarConAdaptador: un environment inválido o una URL de producción cortan antes de tocar el navegador', async () => {
  const { ejecutarConAdaptador } = await cargarRunner();
  const casos = [
    [entrada({ environment: 'produccion' }), 'entrada'],
    [entrada({ base_url: `${PRODUCCION}/inventario` }), 'produccion'],
    [entrada({ production_url: undefined }), 'produccion'],
    [entrada({ schema: leer(SIN_TABLA_4) }), 'schema'],
  ];
  for (const [input, etapa] of casos) {
    const adaptador = adaptadorSimulado();
    const reporte = await ejecutarConAdaptador(adaptador, input, null);
    assert.strictEqual(reporte.summary, 'could_not_validate', etapa);
    assert.strictEqual(reporte.environment_error.stage, etapa);
    assert.deepStrictEqual(adaptador.llamadas, [], `${etapa}: no debe tocar el navegador`);
    assert.deepStrictEqual(reporte.cases, []);
  }
});

test('ejecutarConAdaptador: un login fallido se reporta como error de ambiente y no filtra la contraseña', async () => {
  const { ejecutarConAdaptador } = await cargarRunner();
  const adaptador = adaptadorSimulado({ iniciarSesion: async () => { throw new Error(`credenciales rechazadas para ${CONTRASENA}`); } });
  const reporte = await ejecutarConAdaptador(adaptador, entrada(), null);
  assert.strictEqual(reporte.summary, 'could_not_validate');
  assert.strictEqual(reporte.environment_error.stage, 'login');
  assert.ok(!JSON.stringify(reporte).includes(CONTRASENA), JSON.stringify(reporte));
  assert.match(reporte.environment_error.message, /\[redactado\]/);
  assert.deepStrictEqual(adaptador.llamadas, []);
});

test('ejecutarConAdaptador: si el formulario no abre, la etapa sale del error y no se ejecuta ningún caso', async () => {
  const { ejecutarConAdaptador, ErrorDeAmbiente } = await cargarRunner();
  const conEtapa = adaptadorSimulado({ abrir: async () => { throw new ErrorDeAmbiente('acceso', 'la ruta no existe'); } });
  const reporteConEtapa = await ejecutarConAdaptador(conEtapa, entrada(), null);
  assert.strictEqual(reporteConEtapa.environment_error.stage, 'acceso');
  assert.match(reporteConEtapa.environment_error.message, /no se pudo abrir el formulario: la ruta no existe/);

  const generico = adaptadorSimulado({ abrir: async () => { throw new Error('se cayó'); } });
  assert.strictEqual((await ejecutarConAdaptador(generico, entrada(), null)).environment_error.stage, 'abrir');
  assert.deepStrictEqual(reporteConEtapa.cases, []);
});

test('ejecutarConAdaptador: sin casos aplicables abre el formulario y no se puede validar', async () => {
  const { ejecutarConAdaptador, RUNNER_VERSION } = await cargarRunner();
  const schema = clonar(leer(FIXTURE));
  schema.tabla_2_interaccion = [];
  schema.datos_formulario.vive_en_modal.valor = 'no';
  const adaptador = adaptadorSimulado();
  const reporte = await ejecutarConAdaptador(adaptador, entrada({ schema }), null);
  assert.deepStrictEqual(adaptador.llamadas, ['iniciarSesion', 'abrir']);
  assert.deepStrictEqual(reporte.cases, []);
  assert.strictEqual(reporte.summary, 'could_not_validate');
  assert.strictEqual(reporte.environment_error, null);
  assert.strictEqual(reporte.form_id, 'sintetico_modal_simple');
  assert.strictEqual(reporte.runner_version, RUNNER_VERSION);
  assert.strictEqual(reporte.schema_source, 'working_copy');
  assert.strictEqual(reporte.base_url, 'http://localhost:3001');
});

test('ejecutarConAdaptador: un caso con motivo sale not_executable con ese motivo y no cuenta como pass ni fail', async () => {
  const { ejecutarConAdaptador } = await cargarRunner();
  const schema = clonar(leer(FIXTURE));
  schema.datos_formulario.vive_en_modal.valor = 'no';
  schema.tabla_2_interaccion = schema.tabla_2_interaccion.filter((campo) => campo.campo_id === 'observaciones');
  const reporte = await ejecutarConAdaptador(adaptadorSimulado(), entrada({ schema }), null);
  assert.deepStrictEqual(reporte.cases.map((caso) => `${caso.case_id}:${caso.field_id}:${caso.result}`), ['C1:observaciones:not_executable', 'C2:observaciones:not_executable']);
  assert.match(reporte.cases[1].reason, /deshabilitado condicional/);
  assert.strictEqual(reporte.summary, 'could_not_validate');
});
