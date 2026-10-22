import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RoombaSetup, SERVICE, TESTED_FIRMWARE, checkDigit, manualCode, qrPayload, decodePayload} from '../matter.js';

const view = text => new DataView(new TextEncoder().encode(text).buffer);
const payload = (fields = {}) => JSON.stringify({startMatterCommissioning: {
  matterCommissioningEnabled: true,
  onboardingPayload: {version:'0x0', vendorId:'0x1516', productId:'0010', customFlow:'0x2', discoveryCapabilitiesBitmask:'0x4', discriminator:'0xf00', passcode:'0x1344225', ...fields}
}});

function fixture({firmware=TESTED_FIRMWARE, setupFirmware=firmware, missingCharacteristic, hello=true, confirm=true, result=payload()}={}) {
  const writes = [];
  const reads = [];
  const characteristics = new Map();
  const device = new EventTarget();
  device.gatt = {
    connected: false,
    connect: async () => { device.gatt.connected=true; return {getPrimaryService: async id => {
      assert.equal(id, SERVICE);
      return {getCharacteristic: async id => {
        const n=Number.parseInt(id.slice(4,8),16);
        if(n===missingCharacteristic) throw new DOMException('Missing setup characteristic','NotFoundError');
        return characteristics.get(n);
      }};
    }}; },
    disconnect: () => { if(device.gatt.connected) { device.gatt.connected=false; device.dispatchEvent(new Event('gattserverdisconnected')); } }
  };
  const notify = byte => { const c=characteristics.get(0x0c); c.value=new DataView(Uint8Array.of(byte).buffer); c.dispatchEvent(new Event('characteristicvaluechanged')); };
  let notifications=false;
  for (const n of [0x0b,0x0c,0x14,0x15,0x16,0x17,0x18,0x19,0x1a,0x22,0x23]) {
    const characteristic=new EventTarget();
    characteristic.startNotifications=async () => {notifications=true;};
    characteristic.readValue=async () => {
      reads.push(n);
      if (n===0x19) return view('"mac":"00:11:22:33:44:55"');
      if (n===0x16) return view(JSON.stringify({sw:notifications ? setupFirmware : firmware}));
      if (n===0x22) {const size=new DataView(new ArrayBuffer(2)); size.setUint16(0,new TextEncoder().encode(result).length,true); return size;}
      if (n===0x23) return view(result);
      if (n===0x1a && notifications) {if(hello) notify(0x68); if(confirm) notify(0x64);}
      return view('{}');
    };
    characteristic.writeValueWithResponse=async data => {writes.push([...data]); assert.equal(n,0x0b); notify(0x6b);};
    characteristics.set(n,characteristic);
  }
  return {device,writes,reads,bluetooth:{requestDevice:async options=>{assert.deepEqual(options.optionalServices,[SERVICE]);return device;}}};
}

test('Matter SDK published setup-code vector and Verhoeff checksum', () => {
  assert.equal(manualCode(3840,20202021),'34970112332');
  assert.equal(checkDigit('236'),'3');
  assert.equal(qrPayload(3840,20202021,0xfff1,0x8000,2),'MT:Y.K9042C00KA0648G00');
});

test('validated robot payload produces standard-flow codes', () => {
  const result=decodePayload(view(payload()));
  assert.equal(result.code,'34970112332');
  assert.match(result.qr,/^MT:[0-9A-Z.\-]+$/);
  assert.equal(result.qr,qrPayload(3840,20202021,0x1516,0x10,4));
});

test('accepts other product IDs and legal flows without replacing their identity', () => {
  for (const product of [0x11,0x31,0x49,0xffff]) {
    for (const flow of [0,1,2]) {
      const result=decodePayload(view(payload({productId:`0x${product.toString(16)}`, customFlow:flow})));
      assert.equal(result.code,'34970112332');
      assert.equal(result.qr,qrPayload(3840,20202021,0x1516,product,4));
    }
  }
});

test('rejects invalid product IDs, malformed fields, forbidden PINs and oversized responses', () => {
  for (const bad of [{productId:'0x10000'},{productId:'-1'},{productId:'junk'},{vendorId:'0x1234'},{passcode:'0x0'},{passcode:'0xa98ac7'},{passcode:'junk'},{discriminator:'0x1000'},{customFlow:'0x3'},{version:'0x1'},{discoveryCapabilitiesBitmask:'0x2'}]) {
    assert.throws(()=>decodePayload(view(payload(bad))),Error);
  }
  assert.throws(()=>decodePayload(view(' '.repeat(4097))),/size/);
  assert.throws(()=>decodePayload(view('{"startMatterCommissioning":{"matterCommissioningEnabled":false}}')),/enable/);
});

test('connecting reads identity and firmware without requesting setup', async () => {
  const f=fixture(); const robot=await RoombaSetup.connect(f.bluetooth);
  assert.deepEqual(f.writes,[]);
  assert.deepEqual(f.reads,[0x19,0x16]);
  assert.equal(robot.identity.mac,'00:11:22:33:44:55');
  robot.close(); assert.equal(f.device.gatt.connected,false);
});

test('untested firmware and product IDs can complete the synthetic setup flow', async () => {
  const f=fixture({firmware:'unverified-model+test-firmware',result:payload({productId:'0x31'})});
  const robot=await RoombaSetup.connect(f.bluetooth);
  assert.equal(robot.identity.firmware,'unverified-model+test-firmware');
  assert.deepEqual(f.writes,[]);
  const result=await robot.prepare(()=>{});
  assert.equal(result.qr,qrPayload(3840,20202021,0x1516,0x31,4));
  assert.deepEqual(f.writes,[[0x67]]);
  assert.equal(f.device.gatt.connected,false);
});

test('missing firmware metadata is rejected without control writes', async () => {
  for(const firmware of ['',null,123]) {
    const f=fixture({firmware});
    await assert.rejects(RoombaSetup.connect(f.bluetooth),/firmware version/);
    assert.deepEqual(f.writes,[]); assert.equal(f.device.gatt.connected,false);
  }
});

test('missing Matter setup characteristics are rejected without control writes', async () => {
  const f=fixture({missingCharacteristic:0x23});
  await assert.rejects(RoombaSetup.connect(f.bluetooth),/Missing setup characteristic/);
  assert.deepEqual(f.writes,[]); assert.equal(f.device.gatt.connected,false);
});

test('firmware changing during initialization still stops setup before a control write', async () => {
  const f=fixture({firmware:'unverified-firmware',setupFirmware:'changed-firmware'});
  const robot=await RoombaSetup.connect(f.bluetooth);
  await assert.rejects(robot.prepare(()=>{}),/Robot firmware changed/);
  assert.deepEqual(f.writes,[]); assert.equal(f.device.gatt.connected,false);
});

test('physical confirmation + initialization send exactly one g, then disconnect', async () => {
  const f=fixture(); const robot=await RoombaSetup.connect(f.bluetooth);
  const result=await robot.prepare(()=>{});
  assert.equal(result.code,'34970112332');
  assert.deepEqual(f.reads.slice(2,9),[0x14,0x15,0x16,0x17,0x18,0x19,0x1a]);
  assert.deepEqual(f.writes,[[0x67]]);
  assert.equal(f.device.gatt.connected,false);
  await assert.rejects(robot.prepare(()=>{}),/already requested/);
  assert.equal(f.writes.length,1);
});

for (const options of [{hello:true,confirm:false},{hello:false,confirm:true}]) {
  test(`no control write without a fresh hello and button confirmation (${JSON.stringify(options)})`, async () => {
    const f=fixture(options); const robot=await RoombaSetup.connect(f.bluetooth);
    const controller=new AbortController();
    await assert.rejects(robot.prepare(message=>{
      if(message.startsWith('Waiting')) controller.abort(new Error('test cancellation'));
    },controller.signal),/test cancellation/);
    assert.deepEqual(f.writes,[]); assert.equal(f.device.gatt.connected,false);
  });
}

test('malformed payload fails closed and is never retried', async () => {
  const f=fixture({result:payload({vendorId:'0xffff'})}); const robot=await RoombaSetup.connect(f.bluetooth);
  await assert.rejects(robot.prepare(()=>{}),/Unsupported Matter payload/);
  assert.equal(f.writes.length,1); assert.equal(f.device.gatt.connected,false);
});

test('vendored QR renderer produces a local SVG without network requests', () => {
  const scope={}; vm.runInNewContext(readFileSync(new URL('../vendor/qrcode.js',import.meta.url),'utf8'),scope);
  const code=scope.qrcode(0,'M'); code.addData(qrPayload(3840,20202021,0x1516,0x10,4),'Alphanumeric'); code.make();
  assert.match(code.createSvgTag({scalable:true,margin:4}),/^<svg\s/);
});
