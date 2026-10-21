# Roomba Matter Helper

A small, browser-based tool that asks a supported Roomba for a **Matter setup code over Bluetooth**. Use the code in your Matter home app when the Roomba app does not offer its Matter setup menu.

No Roomba account or cloud password is required. There is no backend, analytics, or upload of robot information or setup codes.

**Experimental: the native Bluetooth sequence and Home Assistant pairing were verified on one Roomba Max 705 Vac. This browser implementation has automated protocol tests, but still needs an end-to-end Bluetooth hardware test. Apple Home, Google Home and Bluefy commissioning have not been verified with this helper.**

## Important: do not rerun it on an already-paired robot

Opening setup again **may remove existing Matter pairings**. During development, a successful HA pairing was lost after another setup request; the robot rejected the old credentials and iRobot sent a removal notification. The precise firmware behavior has not been established for every case.

If your robot already works in one Matter home, use that home's **Share device / pairing mode** to add another home. Do not generate a fresh code here for each platform.

The helper requires an acknowledgement and fresh physical button confirmation, sends the setup command at most once per session, and never automatically retries. Cancel stops this page from continuing, but cannot undo a command already sent to the robot.

## Supported robot

| Model | Firmware | Status |
| --- | --- | --- |
| Roomba Max 705 Vac, vacuum-only model | `p25-705+9.3.6+I3.8.149` | Native BLE sequence and HA pairing verified; browser hardware test pending |
| Other models / firmware | Any | Blocked before control writes |

This does not add Matter support to robots that lack it. Firmware and payload checks deliberately restrict this first release to the configuration tested. A compatible Matter controller and home network are still required.

## What you need

- A powered-on, supported robot nearby, already connected to your home Wi-Fi.
- Bluetooth enabled on the computer or phone.
- A browser with Web Bluetooth support and an HTTPS-hosted copy of this page.
- Your home app, ready to add a Matter accessory.

| Device | Browser |
| --- | --- |
| macOS | Chrome or Edge; Safari does not support Web Bluetooth |
| Windows | Chrome or Edge with a supported Bluetooth adapter |
| Android | Chrome; Bluetooth permissions may be required |
| iPhone / iPad | Safari cannot do this. [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) provides Web Bluetooth, but this helper still needs a Bluefy hardware test |
| Firefox | Unsupported |

Browser support references: [Chrome's Web Bluetooth documentation](https://developer.chrome.com/docs/capabilities/bluetooth), [WebKit's unsupported APIs](https://webkit.org/tracking-prevention/), and [Bluefy's instructions](https://bluefy.app/guide.html).

## Pair your robot

1. Open the helper in a supported browser, close the Roomba app, and stay near the robot.
2. Select **Choose Roomba**. Choose your iRobot / Roomba in the browser's Bluetooth picker. The picker may also list unrelated devices; the helper verifies the robot's service, identity and firmware before enabling setup.
3. Read the existing-pairing warning and check the acknowledgement. Select **Prepare setup code** once.
4. When the Roomba asks, **briefly press the requested button**. Do not hold buttons or factory-reset it.
5. Wait for the 11-digit setup code and QR code. The Bluetooth connection closes once the code is read.
6. Open Home Assistant, Apple Home, or Google Home and use its normal **Add Matter device / Add accessory** flow. Enter the code manually. If another screen displays the QR code, you can scan it instead.
7. Check whether your robot appeared in the home app even if the phone reported an error. **Do not rerun the helper after a successful pairing.**

The helper prepares onboarding information; the chosen home app performs commissioning and validates the accessory. It does not disable attestation or certificate checks. Platform support, required hubs, network settings and available controls vary. Only HA pairing has been verified here.

### Room cleaning in Home Assistant

The tested robot exposed 11 named rooms through Matter's Service Area cluster. In the vacuum entity's settings, select **Map vacuum segments to areas**, match the robot rooms to your HA areas, and save. Then use **Cleaning → By area** or `vacuum.clean_area`.

This is room selection, not a copy of the manufacturer's interactive floor-plan editor. See [HA's area-cleaning instructions](https://www.home-assistant.io/integrations/vacuum/#mapping-your-vacuum-areas-to-home-assistant-areas).

## Run it locally

No dependency installation or build is needed. With Python 3 installed:

```sh
git clone https://github.com/jouwdan/roomba-matter.git
cd roomba-matter
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open **http://localhost:8080** in Chrome or Edge on that computer. Browsers treat localhost as a secure context for development. A phone cannot use another computer's localhost; publish `dist/` to an **HTTPS static host** to use it from a phone.

Opening the HTML directly with `file://` is unsupported. No Wi-Fi passwords, robot cloud credentials, or HA access tokens need to be configured.

## Deploy / share

Publish the contents of `dist/` on an HTTPS static host, such as GitHub Pages or Cloudflare Pages. No environment variables or server are needed. Use the page as a top-level tab; embedding it requires a host that allows Bluetooth through Permissions Policy.

`dist/_headers` supplies security headers for hosts that support that format. Other hosts may ignore it; verify their Permissions Policy does not disable Bluetooth. The HTML also declares a Content Security Policy that blocks fetch/XHR/WebSocket connections. The Bluetooth API is used locally.

The vendored QR library is served locally, so setup codes are never sent to a third-party QR image service. Hosting configuration, account credentials, packet captures and real robot payloads are not part of the repository.

## Development and tests

Node.js 22 or later:

```sh
npm test
```

Tests cover the Matter SDK code vector, checksum and QR payload, onboarding validation, unsupported firmware, read-only connection, physical confirmation gating, cancellation, one-time setup writes, cleanup, and local QR rendering. Fake Bluetooth devices are used; tests never connect to a real robot.

Before calling a new model or browser supported, verify it on actual hardware, including whether existing Matter links survive a setup request. Never test repeated setup on an installation you need to preserve.

### Protocol

- GATT service: `c74edd21-763c-4e54-85a8-43bb75035d75`.
- Identity and setup initialization: characteristics `c74e0014` through `c74e001a`, with the same UUID suffix.
- Status indications on `c74e000c`: `h` (button prompt), `d` (button confirmed), `k` (payload ready).
- After initialization and fresh button confirmation, write **one byte `0x67` (`g`)** with response to `c74e000b`.
- Read the little-endian payload length from `c74e0022`, then the onboarding JSON from `c74e0023`.
- Validate the response and encode a standard-flow Matter manual code and QR payload. This avoids the manufacturer-app redirect from the robot's custom-flow metadata; passcode, discriminator, vendor and product identity are preserved in the QR payload.

The standard-flow encoding was used successfully with HA. It is not a guarantee that every Matter platform will accept the device. Encoding follows the [Matter SDK setup-payload implementation](https://github.com/project-chip/connectedhomeip/tree/master/src/setup_payload). BLE initialization is also described in [irobot-explore](https://github.com/samm-git/irobot-explore/blob/main/BLUETOOTH.md). The control byte and characteristics were checked against Roomba Home 1.6.0 client code; no proprietary app binaries are included.

### Privacy

Robot identity and setup codes stay in page memory. They are not put in URLs, local storage, analytics, or logs. **Copy** intentionally places the code on your clipboard; clearing the page does not clear your clipboard or screenshots. Closing or clearing the page removes its displayed code. Browser permissions and normal web-host access logs are separate from this tool.

Do not include setup codes, QR codes, robot identifiers, cloud credentials, network captures, or private home details in public issue reports.

## License

MIT. The locally vendored `qrcode-generator` 1.4.4 library is also MIT, by Kazuhiko Arase; its license is retained in the source and `THIRD_PARTY_NOTICES.md`.

This is an unofficial community project, not affiliated with iRobot, Home Assistant, Apple, Google, or the Connectivity Standards Alliance. Product names belong to their respective owners.
