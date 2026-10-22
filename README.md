# Roomba Matter Helper

[Open the app](https://jouwdan.github.io/roomba-matter/) · [Build / deploy status](https://github.com/jouwdan/roomba-matter/actions/workflows/pages.yml) · [Model evidence](COMPATIBILITY.md)

A browser-based helper for **local Matter control of newer Roombas that use the Roomba Home app**. It gets a **Matter setup code over Bluetooth**, so you can add a Matter-capable robot to Home Assistant, Apple Home, or Google Home when the Roomba app does not offer its Matter setup menu.

Once paired, your Matter controller exchanges commands and status with the robot over your local network, **without relying on iRobot's cloud API for that control**. The robot must already be set up on Wi-Fi and have Matter-capable firmware; this helper does not install Matter support or replace initial robot setup. **Testers on other models and firmware are welcome:** there is no model or firmware allowlist.

No Roomba account or cloud password is required. There is no backend, analytics, or upload of robot information or setup codes.

**Experimental: the native Bluetooth sequence and Home Assistant pairing were verified on one Roomba Max 705 Vac. This browser implementation has automated protocol tests, but still needs an end-to-end Bluetooth hardware test. Apple Home, Google Home and Bluefy commissioning have not been verified with this helper.**

## Important: do not rerun it on an already-paired robot

Opening setup again **may remove existing Matter pairings**. During development, a successful HA pairing was lost after another setup request; the robot rejected the old credentials and iRobot sent a removal notification. The precise firmware behavior has not been established for every case.

If your robot already works in one Matter home, use that home's **Share device / pairing mode** to add another home. Do not generate a fresh code here for each platform.

The helper requires an acknowledgement and fresh physical button confirmation, sends the setup command at most once per session, and never automatically retries. Cancel stops this page from continuing, but cannot undo a command already sent to the robot.

## Tested hardware and experimental compatibility

The intended audience is owners of newer robots using **Roomba Home**. [iRobot's app guide](https://www.irobot.ie/en_IE/irobot-home-app.html) lists the 100, 200, Plus 400, Plus 500 and Max 705 series sold after March 2025 for that app. **App compatibility does not guarantee Matter support or compatibility with this helper.**

Technical naming: this app generation is often called **Prime**, after its Android package ID, [`com.irobot.home.prime`](https://play.google.com/store/apps/details?id=com.irobot.home.prime).

| Model | Firmware | Status |
| --- | --- | --- |
| Roomba Max 705 Vac, vacuum-only model | `p25-705+9.3.6+I3.8.149` | Native BLE sequence and HA pairing verified; browser hardware test pending |
| Other models / firmware | Any | Allowed to try the experimental flow if the robot exposes the required Bluetooth setup service and characteristics; not hardware-verified |

This does not add Matter support to robots that lack it. The helper accepts different firmware versions and preserves the product ID returned by each robot. It still requires valid robot identity/firmware metadata, the expected BLE setup characteristics, fresh physical button confirmation, and a valid iRobot Matter onboarding payload for an already-networked robot. Firmware and identity must remain unchanged during the session. A compatible Matter controller and home network are still required.

Native Matter support is documented for additional models, including the 505 Combo, 705 Combo and Combo 10 Max. Their Bluetooth activation with this helper has **not** been proven. See the [compatibility evidence and expansion procedure](COMPATIBILITY.md); cloud API versions alone are not a reliable compatibility test.

## What you need

- A powered-on Roomba nearby, already connected to your home Wi-Fi and implementing the Bluetooth Matter setup flow.
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
2. Select **Choose Roomba**. Choose your iRobot / Roomba in the browser's Bluetooth picker. The picker may also list unrelated devices; the helper checks the required service/characteristics and reads identity and firmware before enabling setup. Untested firmware gets an experimental notice, not a block.
3. Read the existing-pairing warning and check the acknowledgement. Select **Prepare setup code** once.
4. Wait until you hear a **chime from the robot**, then **briefly press its power button once**. This confirms setup so the helper can retrieve your Matter pairing code. Do not hold the button or factory-reset the robot.
5. Wait for the 11-digit setup code and QR code. The Bluetooth connection closes once the code is read.
6. Open Home Assistant, Apple Home, or Google Home and use its normal **Add Matter device / Add accessory** flow. Enter the code manually. If another screen displays the QR code, you can scan it instead.
7. Check whether your robot appeared in the home app even if the phone reported an error. **Do not rerun the helper after a successful pairing.**

The helper prepares onboarding information; the chosen home app performs commissioning and validates the accessory. It does not disable attestation or certificate checks. Platform support, required hubs, network settings and available controls vary. Only HA pairing has been verified here.

### Room cleaning in Home Assistant

The tested robot exposed 11 named rooms through Matter's Service Area cluster. In the vacuum entity's settings, select **Map vacuum segments to areas**, match the robot rooms to your HA areas, and save. Then use **Cleaning → By area** or `vacuum.clean_area`.

This is room selection, not a copy of the manufacturer's interactive floor-plan editor. See [HA's area-cleaning instructions](https://www.home-assistant.io/integrations/vacuum/#mapping-your-vacuum-areas-to-home-assistant-areas).

## Run it locally

The complete editable HTML, JavaScript, CSS and vendored QR library are in **`src/`**. No dependency installation or build is needed for local development. With Python 3 installed:

```sh
git clone https://github.com/jouwdan/roomba-matter.git
cd roomba-matter
python3 -m http.server 8080 --bind 127.0.0.1 --directory src
```

Open **http://localhost:8080** in Chrome or Edge on that computer. Browsers treat localhost as a secure context for development. A phone cannot use another computer's localhost; publish `dist/` to an **HTTPS static host** to use it from a phone.

Opening the HTML directly with `file://` is unsupported. No Wi-Fi passwords, robot cloud credentials, or HA access tokens need to be configured.

## Deploy to GitHub Pages

The repository includes [.github/workflows/pages.yml](.github/workflows/pages.yml). On a push to `main`, GitHub Actions runs the tests, builds the site from `src/` into `dist/`, uploads **only `dist/`**, and deploys it with GitHub's Pages action. Pull requests run the checks without deploying.

In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Push to `main`, or select **Run workflow** on the Actions tab. The published project URL is:

**https://jouwdan.github.io/roomba-matter/**

All application asset/import paths are relative, so the `/roomba-matter/` project prefix works without changing a base URL. No custom domain, secrets, cloud credentials or environment variables are needed. The workflow uses GitHub's short-lived deployment token with Pages permissions.

To build manually with Node.js 22 or later:

```sh
npm test
npm run build
```

`scripts/build.mjs` recreates the generated `dist/` directory from `src/`; edit `src/`, not `dist/`. Generated output is ignored by Git. To host elsewhere, publish `dist/` to an HTTPS static host. Use the page as a top-level tab; embedding it requires a host that allows Bluetooth through Permissions Policy.

`src/_headers` is copied into the build and supplies security headers for hosts that support that format. GitHub Pages does not apply this file; the HTML Content Security Policy still blocks fetch/XHR/WebSocket connections. Verify any other host's Permissions Policy does not disable Bluetooth. The Bluetooth API is used locally.

The vendored QR library is served locally, so setup codes are never sent to a third-party QR image service. Hosting configuration, account credentials, packet captures and real robot payloads are not part of the repository.

## Development and tests

```text
src/                    Editable application source and local QR library
scripts/build.mjs       Dependency-free static build
test/                   Protocol and code-generation tests
.github/workflows/      Test, build and GitHub Pages deployment
dist/                   Generated publication output (ignored)
COMPATIBILITY.md        Model evidence and hardware validation requirements
```

Node.js 22 or later:

```sh
npm test
```

Tests cover the Matter SDK code vector, checksum and QR payload, product-ID preservation, onboarding validation, untested firmware, missing characteristics/metadata, identity stability, read-only connection, physical confirmation gating, cancellation, one-time setup writes, cleanup, and local QR rendering. Fake Bluetooth devices are used; tests never connect to a real robot.

Before calling a new model or browser supported, verify it on actual hardware, including whether existing Matter links survive a setup request. Never test repeated setup on an installation you need to preserve.

### Help test another model

Run the normal flow on a robot whose existing Matter pairings you can afford to lose. Report your model/SKU, firmware, browser/OS, Matter controller, whether the robot chimed and accepted a single brief power-button press, and whether pairing and local control worked. Failed attempts are useful too. Do not post the setup code, QR code, raw onboarding JSON, MAC address, serial number, or cloud credentials. An unsupported BLE flow or invalid onboarding response still stops setup; this release does not send alternative commands or retry automatically.

### Protocol

- GATT service: `c74edd21-763c-4e54-85a8-43bb75035d75`.
- Identity and setup initialization: characteristics `c74e0014` through `c74e001a`, with the same UUID suffix.
- Status indications on `c74e000c`: `h` (physical-confirmation prompt; the tested robot chimes), `d` (button confirmed), `k` (payload ready). On the tested Max 705 Vac, briefly press the power button once after the chime to confirm setup.
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
