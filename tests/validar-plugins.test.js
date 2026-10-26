// Prueba del validador estático: un marketplace mínimo válido debe pasar, y cada defecto que ya nos ha fallado
// (o podría) debe producir el ERROR esperado. Es la prueba de la prueba: un validador que nunca falla no sirve.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const VALIDADOR = path.resolve(__dirname, '..', 'scripts', 'validar-plugins.js');

function escribir(raiz, ruta, contenido) {
  const destino = path.join(raiz, ruta);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, typeof contenido === 'string' ? contenido : JSON.stringify(contenido, null, 2));
}

// Marketplace de un solo plugin "demo", válido en todo.
function armarMarketplace() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'validador-'));
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true });
  fs.copyFileSync(VALIDADOR, path.join(raiz, 'scripts', 'validar-plugins.js'));
  const entrada = { name: 'demo', source: 'demo', version: '1.0.0' };
  escribir(raiz, '.claude-plugin/marketplace.json', { name: 'm', plugins: [entrada] });
  escribir(raiz, '.cursor-plugin/marketplace.json', { name: 'm', plugins: [entrada] });
  escribir(raiz, 'plugins/demo/.claude-plugin/plugin.json', { name: 'demo', version: '1.0.0' });
  escribir(raiz, 'plugins/demo/.cursor-plugin/plugin.json', { name: 'demo', version: '1.0.0', skills: ['./skills'], hooks: './hooks/cursor-hooks.json' });
  escribir(raiz, 'plugins/demo/skills/demo-skill/SKILL.md', '---\nname: demo-skill\ndescription: Hace algo. Úsala cuando digan "hola".\n---\n# Demo\n');
  escribir(raiz, 'plugins/demo/hooks/hooks.json', { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/uno.js"' }] }] } });
  escribir(raiz, 'plugins/demo/hooks/cursor-hooks.json', { version: 1, hooks: { sessionStart: [{ command: 'node "${CURSOR_PLUGIN_ROOT}/hooks/uno.js"' }] } });
  escribir(raiz, 'plugins/demo/hooks/uno.js', "console.log('ok');\n");
  return raiz;
}

function validar(raiz) {
  const r = spawnSync(process.execPath, [path.join(raiz, 'scripts', 'validar-plugins.js')], { encoding: 'utf8' });
  return { codigo: r.status, salida: r.stdout };
}

function modificarJson(raiz, ruta, cambio) {
  const archivo = path.join(raiz, ruta);
  const json = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  cambio(json);
  fs.writeFileSync(archivo, JSON.stringify(json, null, 2));
}

test('un marketplace válido pasa sin errores', () => {
  const resultado = validar(armarMarketplace());
  assert.strictEqual(resultado.codigo, 0, resultado.salida);
});

const DEFECTOS = [
  ['source con ./plugins/ (Cursor duplica el segmento)', (r) => modificarJson(r, '.cursor-plugin/marketplace.json', (j) => (j.plugins[0].source = './plugins/demo')), /source "\.\/plugins\/demo" debe ser "demo"/],
  ['versión distinta entre manifiestos', (r) => modificarJson(r, 'plugins/demo/.cursor-plugin/plugin.json', (j) => (j.version = '1.0.1')), /versión distinta entre manifiestos/],
  ['versión del marketplace desactualizada', (r) => modificarJson(r, '.claude-plugin/marketplace.json', (j) => (j.plugins[0].version = '0.9.0')), /marketplace claude: version 0\.9\.0/],
  ['plugin ausente del marketplace de Cursor', (r) => modificarJson(r, '.cursor-plugin/marketplace.json', (j) => (j.plugins = [])), /no está en el marketplace de cursor/],
  ['hook que apunta a un script inexistente', (r) => fs.rmSync(path.join(r, 'plugins/demo/hooks/uno.js')), /apunta a hooks\/uno\.js, que no existe/],
  ['script con error de sintaxis', (r) => escribir(r, 'plugins/demo/hooks/uno.js', 'function ('), /error de sintaxis/],
  ['skill con name distinto de la carpeta', (r) => escribir(r, 'plugins/demo/skills/demo-skill/SKILL.md', '---\nname: otro\ndescription: x\n---\n'), /no coincide con la carpeta/],
  ['skill sin description', (r) => escribir(r, 'plugins/demo/skills/demo-skill/SKILL.md', '---\nname: demo-skill\n---\n'), /falta description/],
  ['skill de más de 500 líneas', (r) => escribir(r, 'plugins/demo/skills/demo-skill/SKILL.md', `---\nname: demo-skill\ndescription: x\n---\n${'linea\n'.repeat(500)}`), /líneas \(máximo 500/],
  ['JSON inválido', (r) => escribir(r, 'plugins/demo/.claude-plugin/plugin.json', '{ no es json'), /JSON inválido/],
];

for (const [nombre, romper, esperado] of DEFECTOS) {
  test(`detecta: ${nombre}`, () => {
    const raiz = armarMarketplace();
    romper(raiz);
    const resultado = validar(raiz);
    assert.strictEqual(resultado.codigo, 1, `debía fallar:\n${resultado.salida}`);
    assert.match(resultado.salida, esperado);
  });
}
