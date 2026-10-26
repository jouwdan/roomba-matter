# Roomba Matter Helper

[Open the helper](https://jouwdan.github.io/roomba-matter/) · [Compatibility & technical details](COMPATIBILITY.md) · [Deployment status](https://github.com/jouwdan/roomba-matter/actions/workflows/pages.yml)

Get a **Matter pairing code over Bluetooth** for compatible newer Roombas using the **Roomba Home app**. Add the robot to Home Assistant, Apple Home or Google Home, then exchange Matter commands and status over your local network **without relying on iRobot’s cloud API for that control**.

The robot must already be on Wi-Fi and have Matter-capable firmware. This helper does not install Matter support or replace initial robot setup. No Roomba account or cloud credentials are needed.

## Compatibility

**Browser setup has been verified on two models:**

| Robot | Firmware | Reported result |
| --- | --- | --- |
| Max 705 Vac | `p25-705+9.3.6+I3.8.149` | Owner tested the web helper on macOS with successful pairing to Apple Home and Home Assistant |
| Plus 505 Combo, SKU N185020 | `p25-505+9.3.6+I3.8.149` | Windows 11 / Edge → Apple Home by QR → shared to Home Assistant ([report #1](https://github.com/jouwdan/roomba-matter/issues/1)) |

Still experimental. Other models, Google Home and Bluefy need testing. There is no model or firmware allowlist; testers are welcome.

[iRobot’s app guide](https://www.irobot.ie/en_IE/irobot-home-app.html) lists the newer 100, 200, Plus 400, Plus 500 and Max 705 series for Roomba Home. App compatibility alone does not establish Matter support. Technically, this app generation is often called **Prime**, after its Android package [`com.irobot.home.prime`](https://play.google.com/store/apps/details?id=com.irobot.home.prime).

Use **Chrome or Edge on macOS/Windows**, or **Chrome on Android**, with Bluetooth enabled. Safari and Firefox do not support Web Bluetooth. On iPhone/iPad, [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) supplies the API, but has not been tested with this helper.

## Pair your robot

**Already paired through Matter? Use your controller’s “Share device” option. Starting fresh setup here may remove existing Matter pairings.**

1. Open the helper, close the Roomba Home app, and stay near the powered-on robot.
2. Select **Choose Roomba** and choose your robot in the Bluetooth picker.
3. Read the warning and select **Start Matter setup** once. The numbered instructions in step 2 guide you through the robot confirmation.
4. **When you hear a chime, briefly press the robot’s power button once.** This confirms setup so the helper can retrieve your Matter pairing code. Don’t hold the button or factory-reset the robot.
5. Wait for the setup code and QR code, then use your home app’s **Add Matter device / Add accessory** flow. Scan from another screen or enter the code manually.
6. Check your home app before retrying if it reports an error. **Don’t rerun setup after a successful pairing.**

All three steps stay visible; later steps are greyed out until ready. The page follows your system’s colour theme, with a header toggle for this visit.

The chosen home app performs commissioning and certificate checks. Available controls and required hubs depend on the robot and platform. For HA room selection, use the vacuum entity’s **Map vacuum segments to areas** setting; see [HA’s instructions](https://www.home-assistant.io/integrations/vacuum/#mapping-your-vacuum-areas-to-home-assistant-areas).

**Bluetooth drops while connecting?** The helper retries read-only discovery up to three connection attempts. If it remains unavailable, close other Roomba apps/tabs, stay nearby, and wait a few minutes before choosing it again. A 505 owner reported Bluetooth becoming available again after several minutes following pairing. The cause of that wait is unconfirmed; the helper never retries the Matter setup command. Already-paired robots should be shared from their existing Matter home.

## Source and hosting

This is a plain static site: **`index.html`, `app.js`, `matter.js`, `style.css` and `vendor/`**. No package manager, dependencies to install, compilation or build step.

For a local preview with Python 3:

```sh
git clone https://github.com/jouwdan/roomba-matter.git
cd roomba-matter
python3 -m http.server 8080 --bind 127.0.0.1
```

Open **http://localhost:8080** on that computer. Opening `file://` directly is unsupported. Phones need an HTTPS-hosted copy.

For GitHub Pages, select **GitHub Actions** in Settings → Pages. The included [workflow](.github/workflows/pages.yml) runs the tests and publishes the static files directly on pushes to `main`; pull requests only run tests. Other HTTPS hosts can serve the same files unchanged. `_headers` supplies security headers on hosts that support it; Pages uses the HTML Content Security Policy.

Development tests use Node.js 22 or later, with no npm installation:

```sh
node --test
```

## Testing and privacy

Report your model/firmware, browser/OS, controller, whether the chime and single power-button press worked, and whether pairing and local control succeeded. See [the hardware testing notes](COMPATIBILITY.md). Automated tests use synthetic devices and codes.

No backend, analytics or uploads. Robot details and codes stay in page memory; the QR library is served locally. Copying a code puts it on your clipboard. Clearing the page does not clear your clipboard or screenshots. Your browser and web host may retain normal access logs. **Keep setup codes, QR codes, robot identifiers and credentials out of public reports.**

MIT licensed; [QR library notices](THIRD_PARTY_NOTICES.md). Unofficial community project, not affiliated with iRobot or the Matter platforms.
