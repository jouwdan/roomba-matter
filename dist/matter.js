// Protocol derived from the Roomba Home 1.6.0 client and verified with a Max 705 Vac.
export const SERVICE = 'c74edd21-763c-4e54-85a8-43bb75035d75';
export const TESTED_FIRMWARE = 'p25-705+9.3.6+I3.8.149';
const uuid = n => `c74e${n.toString(16).padStart(4, '0')}-763c-4e54-85a8-43bb75035d75`;
const decoder = new TextDecoder('utf-8', {fatal: true});

function object(value) {
  const text = decoder.decode(value).replace(/\0+$/, '').trim();
  try { return JSON.parse(text); }
  catch { return JSON.parse(`{${text}}`); }
}

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function number(value, name, max) {
  requireThat(typeof value === 'number' || typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(value), `Invalid ${name}.`);
  const result = typeof value === 'string' ? Number.parseInt(value.replace(/^0x/i, ''), 16) : value;
  requireThat(Number.isSafeInteger(result) && result >= 0 && result <= max, `Invalid ${name}.`);
  return result;
}

const permutation = ['0123456789', '1576283094', '5803796142', '8916043527', '9453126870', '4286573901', '2793806415', '7046913258'];
const multiplication = ['0123456789', '1234067895', '2340178956', '3401289567', '4012395678', '5987604321', '6598710432', '7659821043', '8765932104', '9876543210'];
export function checkDigit(text) {
  let state = 0;
  [...text].reverse().forEach((digit, i) => { state = +multiplication[state][+permutation[(i + 1) % 8][+digit]]; });
  return String(state < 5 ? (5 - state) % 5 : state);
}

export function manualCode(discriminator, pin) {
  requireThat(Number.isInteger(discriminator) && discriminator >= 0 && discriminator < 4096 && Number.isInteger(pin) && pin > 0 && pin <= 99999998, 'Invalid setup fields.');
  const short = discriminator >> 8;
  const text = `${short >> 2}${(((short & 3) << 14) | (pin & 0x3fff)).toString().padStart(5, '0')}${(pin >> 14).toString().padStart(4, '0')}`;
  return text + checkDigit(text);
}

export function qrPayload(discriminator, pin, vendor, product, discovery) {
  // Standard commissioning flow avoids the manufacturer-app redirect of custom flow 2.
  const packed = BigInt(vendor) << 3n | BigInt(product) << 19n | BigInt(discovery) << 37n | BigInt(discriminator) << 45n | BigInt(pin) << 57n;
  const bytes = Array.from({length: 11}, (_, i) => Number(packed >> BigInt(8 * i) & 255n));
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-.';
  let result = 'MT:';
  for (let start = 0; start < bytes.length; start += 3) {
    const chunk = bytes.slice(start, start + 3);
    let value = chunk.reduce((sum, byte, i) => sum + byte * 256 ** i, 0);
    for (let i = 0; i < [0, 2, 4, 5][chunk.length]; i++) {
      result += alphabet[value % 38];
      value = Math.floor(value / 38);
    }
  }
  return result;
}

export function decodePayload(value) {
  requireThat(value.byteLength > 0 && value.byteLength <= 4096, 'Unexpected setup response size.');
  const setup = object(value)?.startMatterCommissioning;
  requireThat(setup?.matterCommissioningEnabled === true && setup.onboardingPayload, 'The robot did not enable Matter setup.');
  const p = setup.onboardingPayload;
  const version = number(p.version, 'version', 7);
  const vendor = number(p.vendorId, 'vendor ID', 65535);
  const product = number(p.productId, 'product ID', 65535);
  const flow = number(p.customFlow, 'commissioning flow', 2);
  const discovery = number(p.discoveryCapabilitiesBitmask, 'discovery flags', 255);
  const discriminator = number(p.discriminator, 'discriminator', 4095);
  const pin = number(p.passcode, 'passcode', 99999998);
  requireThat(pin > 0 && ![12345678, 87654321].includes(pin) && !/^([1-9])\1{7}$/.test(String(pin)), 'The robot returned an invalid Matter passcode.');
  requireThat(version === 0 && vendor === 0x1516 && product === 0x10 && [0, 2].includes(flow) && (discovery & 4) !== 0, 'This onboarding payload is not supported by this tested helper.');
  return {code: manualCode(discriminator, pin), qr: qrPayload(discriminator, pin, vendor, product, discovery)};
}

function delay(ms, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, {once: true});
  });
}

async function until(test, ms, signal, message) {
  const deadline = Date.now() + ms;
  while (!test()) {
    if (Date.now() >= deadline) throw new Error(message);
    await delay(100, signal);
  }
  signal?.throwIfAborted();
}

export class RoombaSetup {
  constructor(device, characteristics, identity) {
    this.device = device;
    this.characteristics = characteristics;
    this.identity = identity;
    this.attempted = false;
  }

  static async connect(bluetooth) {
    // A broad chooser also works in iOS Web Bluetooth browsers. Validate before writes.
    const device = await bluetooth.requestDevice({acceptAllDevices: true, optionalServices: [SERVICE]});
    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE);
      const characteristics = new Map();
      for (const n of [0x19, 0x16, 0x0b, 0x0c, 0x22, 0x23, 0x14, 0x15, 0x17, 0x18, 0x1a]) {
        characteristics.set(n, await service.getCharacteristic(uuid(n)));
      }
      const mac = object(await characteristics.get(0x19).readValue()).mac;
      const firmware = object(await characteristics.get(0x16).readValue()).sw;
      requireThat(typeof mac === 'string' && /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac), 'Could not verify the robot identity.');
      requireThat(firmware === TESTED_FIRMWARE, `Unsupported firmware: ${firmware ?? 'unknown'}. This release supports only the tested Max 705 Vac firmware.`);
      return new RoombaSetup(device, characteristics, {mac: mac.toLowerCase(), firmware});
    } catch (error) { device.gatt.disconnect(); throw error; }
  }

  async prepare(progress, signal) {
    requireThat(!this.attempted, 'Setup was already requested. Use the code you received, or share from the home you paired it with.');
    requireThat(this.device.gatt.connected, 'The robot is disconnected.');
    this.attempted = true;
    const status = this.characteristics.get(0x0c);
    let helloSeen = false;
    let confirmed = false;
    let ready = false;
    let sent = false;
    const changed = event => {
      const value = event.target.value;
      if (value?.byteLength !== 1) return;
      const byte = value.getUint8(0);
      if (byte === 0x68) {
        helloSeen = true;
        progress('Press the button the Roomba asks for. Use a brief press, not a long hold.');
      }
      if (byte === 0x64 && helloSeen) confirmed = true;
      if (byte === 0x6b && sent) ready = true;
    };
    const disconnected = () => controller.abort(new Error('Bluetooth disconnected before setup finished. Stay close to the robot.'));
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, {once: true});
    if (signal?.aborted) abort();
    const deadline = setTimeout(() => controller.abort(new Error('Setup timed out. No automatic retry was sent.')), 150000);
    const closeOnAbort = () => this.device.gatt.disconnect();
    controller.signal.addEventListener('abort', closeOnAbort, {once: true});
    this.device.addEventListener('gattserverdisconnected', disconnected);
    status.addEventListener('characteristicvaluechanged', changed);
    try {
      controller.signal.throwIfAborted();
      await status.startNotifications();
      for (let n = 0x14; n <= 0x1a; n++) {
        controller.signal.throwIfAborted();
        const data = await this.characteristics.get(n).readValue();
        if (n === 0x19) requireThat(object(data).mac?.toLowerCase() === this.identity.mac, 'Robot identity changed. Setup stopped.');
        if (n === 0x16) requireThat(object(data).sw === TESTED_FIRMWARE, 'Robot firmware changed. Setup stopped.');
      }
      progress('Waiting for the robot’s button confirmation…');
      await until(() => confirmed, 90000, controller.signal, 'The robot’s button confirmation was not received.');
      progress('Button confirmed. Preparing your setup code…');
      controller.signal.throwIfAborted();
      const command = this.characteristics.get(0x0b);
      sent = true;
      // Exactly one request; repeating this may remove an existing Matter pairing.
      if (typeof command.writeValueWithResponse === 'function') await command.writeValueWithResponse(Uint8Array.of(0x67));
      else await command.writeValue(Uint8Array.of(0x67));
      await until(() => ready, 60000, controller.signal, 'The robot did not report that its setup code was ready.');
      for (let attempt = 0; attempt < 15; attempt++) {
        controller.signal.throwIfAborted();
        const size = await this.characteristics.get(0x22).readValue();
        requireThat(size.byteLength === 2 && size.getUint16(0, true) <= 4096, 'Unexpected setup response size.');
        const payload = await this.characteristics.get(0x23).readValue();
        if (payload.byteLength && (!size.getUint16(0, true) || payload.byteLength === size.getUint16(0, true))) return decodePayload(payload);
        await delay(2000, controller.signal);
      }
      throw new Error('The robot did not return a complete setup code. Do not repeat setup if it already paired.');
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', closeOnAbort);
      this.device.removeEventListener('gattserverdisconnected', disconnected);
      status.removeEventListener('characteristicvaluechanged', changed);
      this.device.gatt.disconnect();
    }
  }

  close() { this.device.gatt.disconnect(); }
}
