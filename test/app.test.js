import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function page() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const elements = new Map();
  for (const [tag, id] of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const listeners = new Map();
    elements.set(id, {
      disabled: /\sdisabled\b/.test(tag), hidden: /\shidden\b/.test(tag),
      checked: false, value: '', textContent: '', innerHTML: '',
      addEventListener: (event, action) => listeners.set(event, action),
      fire: event => listeners.get(event)?.(),
      setAttribute(name, value) { this[name] = value; },
      replaceChildren() { this.innerHTML = ''; },
      scrollIntoView() {}
    });
  }
  const root = {dataset: {}};
  const theme = {matches: true, addEventListener(event, action) { this.change = action; }};
  let connected = false;
  let finish;
  const robot = {
    identity: {firmware: 'test', mac: '00:11:22:33:44:55'}, attempted: false,
    prepare() { this.attempted = true; return new Promise(resolve => { finish = resolve; }); }
  };
  const scope = {
    document: {documentElement: root, getElementById: id => elements.get(id)},
    navigator: {bluetooth: {}}, AbortController, TESTED_FIRMWARE: 'test',
    RoombaSetup: {async connect() { if (!connected) throw new Error('Connection failed'); return robot; }},
    window: {isSecureContext: true, matchMedia: () => theme, addEventListener() {},
      qrcode: () => ({addData() {}, make() {}, createSvgTag: () => '<svg></svg>'})}
  };
  vm.runInNewContext(readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/^import .*;\n/, ''), scope);
  return {html, elements, root, theme, connect: () => { connected = true; }, finish: result => finish(result)};
}

test('all steps stay visible while connection and code readiness gate later controls', async () => {
  const p = page();
  const get = id => p.elements.get(id);
  assert.equal(get('prepare').hidden, false);
  assert.equal(get('result').hidden, false);
  assert.equal(get('prepare').disabled, true);
  assert.equal(get('result').disabled, true);
  await get('connect').fire('click');
  assert.equal(get('prepare').disabled, true);
  p.connect();
  await get('connect').fire('click');
  assert.equal(get('prepare').disabled, false);
  assert.equal(get('generate').disabled, false);
  const pending = get('generate').fire('click');
  assert.equal(get('result').disabled, true);
  p.finish({code: '34970112332', qr: 'MT:SAMPLE'});
  await pending;
  assert.equal(get('result').disabled, false);
  assert.equal(get('prepare').hidden, false);
  assert.equal(get('setup-details').hidden, false);
  assert.equal(get('setup-code').value, '34970112332');
  get('clear').fire('click');
  assert.equal(get('setup-code').value, '');
  assert.equal(get('qr').innerHTML, '');
  assert.equal(get('setup-details').hidden, true);
  assert.equal(get('result-pending').hidden, false);
});

test('theme follows the system until the user selects a theme', () => {
  const p = page();
  assert.equal(p.root.dataset.theme, 'dark');
  p.theme.change({matches: false});
  assert.equal(p.root.dataset.theme, 'light');
  p.elements.get('theme-toggle').fire('click');
  assert.equal(p.root.dataset.theme, 'dark');
  assert.equal(p.elements.get('theme-toggle')['aria-label'], 'Switch to light mode');
  p.theme.change({matches: false});
  assert.equal(p.root.dataset.theme, 'dark');
});
