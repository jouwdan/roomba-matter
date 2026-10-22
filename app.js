import {RoombaSetup, TESTED_FIRMWARE} from './matter.js';

const $ = id => document.getElementById(id);
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let followSystemTheme = true;
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme-toggle').textContent = dark ? '☀' : '☾';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  $('theme-toggle').setAttribute('aria-label', label);
  $('theme-toggle').title = label;
}
setTheme(systemTheme.matches);
systemTheme.addEventListener('change', event => { if (followSystemTheme) setTheme(event.matches); });
$('theme-toggle').addEventListener('click', () => {
  followSystemTheme = false;
  setTheme(document.documentElement.dataset.theme !== 'dark');
});
let robot;
let controller;
const supported = !!navigator.bluetooth && window.isSecureContext;
$('unsupported').hidden = !!navigator.bluetooth;
$('insecure').hidden = window.isSecureContext;
$('connect').disabled = !supported;

function status(message, error = false) {
  $('status').hidden = false;
  $('status').textContent = message;
  $('status').className = error ? 'error' : '';
}

$('connect').addEventListener('click', async () => {
  $('connect').disabled = true;
  status('Choose your robot in the Bluetooth picker…');
  try {
    robot = await RoombaSetup.connect(navigator.bluetooth);
    $('identity').textContent = `Robot connected · firmware ${robot.identity.firmware} · Bluetooth identity ending ${robot.identity.mac.slice(-5).toUpperCase()}`;
    $('identity').hidden = false;
    $('prepare').disabled = false;
    status(robot.identity.firmware === TESTED_FIRMWARE
      ? 'Robot identity checked. Read the pairing warning before continuing.'
      : 'This robot/firmware is untested. You can try the experimental setup flow after reading the pairing warning.');
  } catch (error) {
    status(error.name === 'NotFoundError' ? 'No robot selected, or it does not expose the required Bluetooth setup service and characteristics. Stay close and choose your Roomba in the picker.' : error.message, true);
    $('connect').disabled = !supported;
  }
});

$('acknowledge').addEventListener('change', () => {
  $('generate').disabled = !$('acknowledge').checked || !robot || robot.attempted;
});

$('generate').addEventListener('click', async () => {
  if (!$('acknowledge').checked || !robot || robot.attempted) return;
  $('generate').disabled = true;
  $('acknowledge').disabled = true;
  $('cancel').hidden = false;
  controller = new AbortController();
  try {
    status('Connecting the setup session. When the robot chimes, briefly press its power button once to get your Matter pairing code…');
    const result = await robot.prepare(message => status(message), controller.signal);
    $('setup-code').value = result.code;
    const qr = window.qrcode(0, 'M');
    qr.addData(result.qr, 'Alphanumeric');
    qr.make();
    $('qr').innerHTML = qr.createSvgTag({scalable: true, margin: 4});
    $('result').disabled = false;
    $('result-pending').hidden = true;
    $('setup-details').hidden = false;
    status('Your setup code is ready. Add it in your home app; don’t request another code.');
    $('result').scrollIntoView({behavior: 'smooth', block: 'start'});
  } catch (error) {
    status(`${error.message || 'Setup stopped.'} If the robot already appeared in your home app, check that home before trying setup again.`, true);
  } finally { $('cancel').hidden = true; }
});

$('cancel').addEventListener('click', () => controller?.abort(new Error('Setup cancelled. A request already sent to the robot cannot be undone.')));
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('setup-code').value); $('copy').textContent = 'Copied'; }
  catch { $('setup-code').focus(); $('setup-code').select(); status('Select and copy the highlighted code.'); }
});
$('clear').addEventListener('click', () => {
  $('setup-code').value = '';
  $('qr').replaceChildren();
  $('setup-details').hidden = true;
  $('result-pending').textContent = 'Code cleared from this page. Your Matter pairing is unchanged.';
  $('result-pending').hidden = false;
  status('Code cleared from this page. Your Matter pairing is unchanged.');
});
window.addEventListener('pagehide', () => { controller?.abort(new Error('Page closed.')); robot?.close(); $('setup-code').value = ''; $('qr').replaceChildren(); });
