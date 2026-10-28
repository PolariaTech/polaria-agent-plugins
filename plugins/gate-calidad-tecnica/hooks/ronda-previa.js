#!/usr/bin/env node
// Decide si la revisión del gate es COMPLETA o ACOTADA (ronda 2 o posterior de la misma rama).
// Lo ejecuta la skill gate-calidad-tecnica-pre-merge-polaria en su Paso 1, desde la raíz del repo:
//   node "<raíz del plugin>/hooks/ronda-previa.js" <rama principal>
// La decisión la toma este script y no la IA: así nadie declara «revisión acotada» para saltarse criterios.
// Solo lee git y las marcas de <git-dir>/polaria-gate/; no escribe nada.
//
// Busca, entre los commits de la rama anteriores a HEAD (de más nuevo a más viejo), la marca más cercana.
// Es ACOTADA solo si esa marca es RECHAZADO y trae la línea CRITERIOS_FAIL (la escribe
// registrar-veredicto.js --reporte). Con cualquier otra marca, sin marca, o con una marca vieja que solo
// guardó el veredicto, la revisión es COMPLETA.
// Salida: una línea JSON.
//   {"ronda":"COMPLETA"}
//   {"ronda":"ACOTADA","shaPrevio":"<sha>","criteriosFail":[2,4],"criteriosSiempre":[6,8],"comandoDelta":"git diff <sha>..HEAD"}

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Criterios mecánicos que se re-ejecutan en toda ronda acotada: dependen de correr pruebas y build.
const CRITERIOS_SIEMPRE = [6, 8];

// Recibe el texto de una marca y devuelve { veredicto, criteriosFail }.
function leerMarca(texto) {
  const veredicto = (/^VEREDICTO: (\S+)/m.exec(texto) || [])[1] || null;
  const linea = (/^CRITERIOS_FAIL: ([\d,]+)\s*$/m.exec(texto) || [])[1];
  const criteriosFail = linea ? linea.split(',').map(Number).filter((n) => n >= 1 && n <= 8) : [];
  return { veredicto, criteriosFail };
}

// Recibe los commits previos (del más nuevo al más viejo) y una función que lee la marca de un commit
// (texto o null). Devuelve la decisión de ronda.
function decidirRonda(commitsPrevios, leerTextoDeMarca) {
  for (const sha of commitsPrevios) {
    const texto = leerTextoDeMarca(sha);
    if (texto === null) continue;
    const { veredicto, criteriosFail } = leerMarca(texto);
    if (veredicto === 'RECHAZADO' && criteriosFail.length) {
      return {
        ronda: 'ACOTADA',
        shaPrevio: sha,
        criteriosFail,
        criteriosSiempre: CRITERIOS_SIEMPRE,
        comandoDelta: `git diff ${sha}..HEAD`,
      };
    }
    return { ronda: 'COMPLETA' }; // La marca más cercana no es un rechazo con reporte guardado.
  }
  return { ronda: 'COMPLETA' };
}

function main() {
  const principal = process.argv[2];
  if (!principal) {
    process.stderr.write('Uso: ronda-previa.js <rama principal>\n');
    process.exit(1);
  }
  const git = (...argumentos) =>
    execFileSync('git', argumentos, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  let commitsPrevios;
  let carpetaGate;
  try {
    // El primero es HEAD: la marca del commit que se está revisando ahora no cuenta como ronda previa.
    commitsPrevios = git('rev-list', `${principal}..HEAD`).split(/\r?\n/).filter(Boolean).slice(1);
    carpetaGate = path.join(path.resolve(git('rev-parse', '--git-dir')), 'polaria-gate');
  } catch (error) {
    process.stderr.write(`No se pudo leer el historial contra ${principal}: ${String(error.stderr || error.message).trim()}\n`);
    process.exit(1);
  }

  const leerTextoDeMarca = (sha) => {
    try {
      return fs.readFileSync(path.join(carpetaGate, `${sha}.md`), 'utf8');
    } catch {
      return null; // Ese commit no se revisó.
    }
  };
  process.stdout.write(`${JSON.stringify(decidirRonda(commitsPrevios, leerTextoDeMarca))}\n`);
}

if (require.main === module) main();

module.exports = { decidirRonda, leerMarca, CRITERIOS_SIEMPRE };
