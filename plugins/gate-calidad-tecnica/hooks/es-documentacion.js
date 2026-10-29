// Decide si la ruta de un archivo cambiado es documentación pura, es decir, nada que una máquina o una IA
// ejecute o lea como instrucción. Lo usa verificar-gate.js para dejar pasar sin veredicto el push cuyos
// archivos cambiados son todos documentación (POL-396). Ante la duda devuelve false: el push sigue
// exigiendo veredicto.
//
// Es documentación:
//   - *.md fuera de las carpetas y nombres de instrucciones de IA (abajo), en cualquier carpeta.
//   - README, CHANGELOG y LICENSE (con o sin extensión md, mdx, txt, rst).
//   - Dentro de docs/ en la raíz: además *.mdx, *.txt, *.rst y las imágenes y PDF que ilustran (png, jpg,
//     jpeg, gif, svg, pdf).
// No es documentación (sigue pasando por el gate):
//   - Cualquier archivo dentro de .claude, .cursor, .agents, agents, skills, hooks, commands, rules o
//     prompts, aunque sea .md: son instrucciones o prompts que una IA o el producto ejecutan.
//   - CLAUDE.md, AGENTS.md, GEMINI.md y SKILL.md en cualquier carpeta; .mdx fuera de docs/ (puede importar
//     componentes y ejecutar código).
//   - Código, configuración y manifiestos (package.json, .env, *.yml, etc.).

const CARPETAS_DE_INSTRUCCIONES = new Set(['.claude', '.cursor', '.agents', 'agents', 'skills', 'hooks', 'commands', 'rules', 'prompts']);
const NOMBRES_DE_INSTRUCCIONES = new Set(['claude.md', 'agents.md', 'gemini.md', 'skill.md']);
const NOMBRE_DE_DOCUMENTO = /^(readme|changelog|licen[cs]e)(\.[\w-]+)?$/i;
const EXTENSIONES_EN_CUALQUIER_CARPETA = new Set(['md']);
const EXTENSIONES_EN_DOCS = new Set(['md', 'mdx', 'txt', 'rst', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'pdf']);
const EXTENSIONES_DE_README = new Set(['md', 'mdx', 'txt', 'rst']);

function esDocumentacion(ruta) {
  if (typeof ruta !== 'string' || !ruta) return false;
  const segmentos = ruta.split('/');
  if (segmentos.some((segmento) => !segmento || segmento === '.' || segmento === '..')) return false;
  const nombre = segmentos[segmentos.length - 1].toLowerCase();
  const carpetas = segmentos.slice(0, -1).map((segmento) => segmento.toLowerCase());
  if (carpetas.some((carpeta) => CARPETAS_DE_INSTRUCCIONES.has(carpeta))) return false;
  if (NOMBRES_DE_INSTRUCCIONES.has(nombre)) return false;

  const punto = nombre.lastIndexOf('.');
  const extension = punto === -1 ? '' : nombre.slice(punto + 1);
  if (carpetas[0] === 'docs') return EXTENSIONES_EN_DOCS.has(extension);
  if (NOMBRE_DE_DOCUMENTO.test(nombre) && (extension === '' || EXTENSIONES_DE_README.has(extension))) return true;
  return EXTENSIONES_EN_CUALQUIER_CARPETA.has(extension);
}

module.exports = { esDocumentacion };
