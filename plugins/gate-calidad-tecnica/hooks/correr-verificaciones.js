#!/usr/bin/env node
// Corre EN PARALELO las verificaciones ejecutables del gate (pruebas, build de despliegue y ESLint del criterio 9)
// y entrega un solo bloque de texto para pegar en <contexto> del revisor. Lo ejecuta la skill
// gate-calidad-tecnica-pre-merge-polaria en su Paso 1, desde la raíz del repo:
//   node "<raíz del plugin>/hooks/correr-verificaciones.js" <rama principal> [--pruebas "<comando>"] [--build "<comando>" | --sin-build] [--minutos-maximo N]
// Sin LLM: el tiempo total pasa de la SUMA de las tres verificaciones a lo que tarde la más lenta.
// Es de solo lectura sobre el proyecto: solo ejecuta los comandos del propio repo (el build puede escribir en
// carpetas ignoradas por git, como .next/ o dist/) y nunca corre eslint con --fix, --suppress-all ni --prune-suppressions.
// Salida: texto. Un bloque "--- <NOMBRE>: <ESTADO>" por verificación (OK, FAIL, TIMEOUT, NO_DETERMINADO o NO_APLICA),
// seguido del final de su salida. El script termina con código 0 aunque una verificación falle: el resultado es dato
// para el revisor, no una decisión. Código 1 solo si faltan argumentos.

const { spawn, spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAXIMO_LINEAS_DE_SALIDA = 60;
const MAXIMO_CARACTERES_DE_SALIDA = 6000;
const MINUTOS_MAXIMO_POR_DEFECTO = 20;
const EXTENSIONES_DE_CODIGO = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

function leerJson(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
}

// Comando de pruebas del repo: el que pidió quien llama, o el script `test` de package.json, o `go test`.
// Devuelve null si no se puede determinar (el revisor lo resuelve con las reglas de su criterio 6).
function elegirComandoPruebas(raiz, comandoPedido) {
  if (comandoPedido) return comandoPedido;
  const paquete = leerJson(path.join(raiz, 'package.json'));
  if (paquete && paquete.scripts && paquete.scripts.test) return 'npm test';
  if (fs.existsSync(path.join(raiz, 'go.mod'))) return 'go test ./...';
  return null;
}

// Comando de build en el orden del criterio 8: el pedido (viene del MCP de Vercel o del dev), luego `buildCommand`
// de vercel.json, luego el script `vercel-build` y por último el script `build`. Devuelve null si no hay ninguno.
function elegirComandoBuild(raiz, comandoPedido) {
  if (comandoPedido) return comandoPedido;
  const vercel = leerJson(path.join(raiz, 'vercel.json'));
  if (vercel && vercel.buildCommand) return vercel.buildCommand;
  const paquete = leerJson(path.join(raiz, 'package.json'));
  if (paquete && paquete.scripts && paquete.scripts['vercel-build']) return 'npm run vercel-build';
  if (paquete && paquete.scripts && paquete.scripts.build) return 'npm run build';
  return null;
}

// El criterio 9(b) solo aplica si el repo tiene un eslint.config.* con las dos reglas (en el mismo archivo o en
// uno que empiece por eslint.config, como eslint.config.limites.mjs de la plantilla).
function hayReglasEslint(raiz) {
  const textos = fs
    .readdirSync(raiz)
    .filter((nombre) => nombre.startsWith('eslint.config'))
    .map((nombre) => fs.readFileSync(path.join(raiz, nombre), 'utf8'));
  const junto = textos.join('\n');
  return junto.includes('max-lines-per-function') && junto.includes('sonarjs/cognitive-complexity');
}

function archivosDeCodigoDelDiff(raiz, principal) {
  const salida = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${principal}...HEAD`], {
    cwd: raiz,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return salida
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea && EXTENSIONES_DE_CODIGO.includes(path.extname(linea).toLowerCase()));
}

function citarParaShell(ruta) {
  return `"${ruta.replace(/"/g, '\\"')}"`;
}

function ultimasLineas(texto) {
  const lineas = texto.replace(/\r/g, '').trimEnd().split('\n');
  let recorte = lineas.slice(-MAXIMO_LINEAS_DE_SALIDA).join('\n');
  if (recorte.length > MAXIMO_CARACTERES_DE_SALIDA) recorte = recorte.slice(-MAXIMO_CARACTERES_DE_SALIDA);
  return recorte;
}

function matarArbolDeProcesos(proceso) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-proceso.pid, 'SIGKILL');
    } catch {
      proceso.kill('SIGKILL');
    }
  }
}

// Ejecuta un comando en la raíz del repo y devuelve { nombre, comando, estado, codigo, segundos, salida }.
function ejecutar({ nombre, comando, raiz, milisegundosMaximo }) {
  return new Promise((resolver) => {
    const inicio = Date.now();
    let salida = '';
    let vencio = false;
    const proceso = spawn(comando, { cwd: raiz, shell: true, windowsHide: true, detached: process.platform !== 'win32' });
    const reloj = setTimeout(() => {
      vencio = true;
      matarArbolDeProcesos(proceso);
    }, milisegundosMaximo);
    proceso.stdout.on('data', (trozo) => { salida += trozo; });
    proceso.stderr.on('data', (trozo) => { salida += trozo; });
    const terminar = (codigo, errorDeArranque) => {
      clearTimeout(reloj);
      const segundos = Math.round((Date.now() - inicio) / 100) / 10;
      if (errorDeArranque) salida += `\nNo se pudo arrancar el comando: ${errorDeArranque.message}`;
      const estado = vencio ? 'TIMEOUT' : codigo === 0 ? 'OK' : 'FAIL';
      resolver({ nombre, comando, estado, codigo, segundos, salida: ultimasLineas(salida) });
    };
    proceso.on('error', (error) => terminar(1, error));
    proceso.on('close', (codigo) => terminar(codigo));
  });
}

function sinEjecutar(nombre, estado, motivo) {
  return Promise.resolve({ nombre, comando: null, estado, codigo: null, segundos: 0, salida: motivo });
}

function formatearBloque(resultado) {
  const detalle = resultado.comando
    ? ` | comando: ${resultado.comando} | código: ${resultado.codigo} | ${resultado.segundos} s`
    : '';
  return `--- ${resultado.nombre}: ${resultado.estado}${detalle}\n${resultado.salida}`;
}

function leerArgumentos(argumentos) {
  const opciones = { principal: null, pruebas: null, build: null, sinBuild: false, minutosMaximo: MINUTOS_MAXIMO_POR_DEFECTO };
  for (let posicion = 0; posicion < argumentos.length; posicion += 1) {
    const argumento = argumentos[posicion];
    if (argumento === '--sin-build') opciones.sinBuild = true;
    else if (argumento === '--pruebas') opciones.pruebas = argumentos[++posicion];
    else if (argumento === '--build') opciones.build = argumentos[++posicion];
    else if (argumento === '--minutos-maximo') opciones.minutosMaximo = Number(argumentos[++posicion]);
    else if (!opciones.principal) opciones.principal = argumento;
  }
  return opciones;
}

function arbolModificado(raiz) {
  return spawnSync('git', ['status', '--porcelain'], { cwd: raiz, encoding: 'utf8' }).stdout.trim();
}

async function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  if (!opciones.principal) {
    process.stderr.write('Uso: correr-verificaciones.js <rama principal> [--pruebas "<comando>"] [--build "<comando>"] [--minutos-maximo N]\n');
    process.exit(1);
  }
  const raiz = process.cwd();
  const milisegundosMaximo = opciones.minutosMaximo * 60 * 1000;
  const inicioTotal = Date.now();
  const arbolAntes = arbolModificado(raiz);

  const comandoPruebas = elegirComandoPruebas(raiz, opciones.pruebas);
  const comandoBuild = opciones.sinBuild ? null : elegirComandoBuild(raiz, opciones.build);
  const archivosDeCodigo = archivosDeCodigoDelDiff(raiz, opciones.principal);
  const eslintAplica = archivosDeCodigo.length > 0 && hayReglasEslint(raiz);

  const pendientes = [
    comandoPruebas
      ? ejecutar({ nombre: 'PRUEBAS', comando: comandoPruebas, raiz, milisegundosMaximo })
      : sinEjecutar('PRUEBAS', 'NO_DETERMINADO', 'El repo no declara comando de pruebas: el revisor aplica las reglas de su criterio 6.'),
    comandoBuild
      ? ejecutar({ nombre: 'BUILD', comando: comandoBuild, raiz, milisegundosMaximo })
      : opciones.sinBuild
        ? sinEjecutar('BUILD', 'NO_APLICA', 'El repo no se despliega (--sin-build).')
        : sinEjecutar('BUILD', 'NO_DETERMINADO', 'No hay buildCommand, vercel-build ni build: el revisor aplica las reglas de su criterio 8.'),
    eslintAplica
      ? ejecutar({
          nombre: 'ESLINT',
          comando: `npx eslint --max-warnings 0 ${archivosDeCodigo.map(citarParaShell).join(' ')}`,
          raiz,
          milisegundosMaximo,
        })
      : sinEjecutar('ESLINT', 'NO_APLICA', 'El repo no tiene las reglas del criterio 9 (falta la plantilla eslint-limites) o el diff no trae código JS/TS.'),
  ];
  const resultados = await Promise.all(pendientes);

  const arbolDespues = arbolModificado(raiz);
  const segundosTotales = Math.round((Date.now() - inicioTotal) / 100) / 10;
  const sumaSecuencial = Math.round(resultados.reduce((suma, r) => suma + r.segundos, 0) * 10) / 10;
  const lineas = [
    `VERIFICACIONES EN PARALELO: ${segundosTotales} s en total (la suma de las tres, en secuencia, serían ${sumaSecuencial} s)`,
    `Node: ${process.version}`,
    '',
    ...resultados.map(formatearBloque),
    '',
    arbolDespues === arbolAntes
      ? 'ARBOL: sin cambios en archivos versionados después de las verificaciones'
      : `ARBOL: CAMBIÓ después de las verificaciones (criterio 8c)\n${arbolDespues}`,
  ];
  process.stdout.write(`${lineas.join('\n')}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { elegirComandoPruebas, elegirComandoBuild, hayReglasEslint, ultimasLineas, formatearBloque, leerArgumentos };
