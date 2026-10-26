# Model compatibility and evidence

Updated on 26 October 2026. **Native Matter support is different from support for this helper's Bluetooth activation procedure.** Certification, an app capability flag, and a fake-device test cannot prove that procedure on a different physical robot. Owner reports below identify where the browser helper has worked on hardware.

## Evidence we can substantiate

| Robot | Evidence for native Matter | Evidence for this helper's activation sequence |
| --- | --- | --- |
| Max 705 Vac | One physical robot was commissioned into Home Assistant, with attestation validation enabled. Battery, state and clean-mode changes worked. The owner also confirmed Apple Home pairing with the web helper. | Native macOS BLE sequence verified on `p25-705+9.3.6+I3.8.149`. On 26 October 2026, the owner confirmed the browser helper worked on **macOS** with **Apple Home and Home Assistant**; the browser was not specified. |
| Max 705 Combo | [CSA certificate for X100010](https://csa-iot.org/csa_product/x100010-roomba-max-705-combo-2/): Matter 1.4, VID `0x1516`, PID `0x0049`. An independent owner reports [commissioning and state reads](https://github.com/kilianp07/roomba-v4/issues/8) and [working start, stop, pause, resume, dock and mode commands](https://github.com/kilianp07/roomba-v4/issues/11). | Not verified. That owner's setup code came from the manufacturer app. Their chip-tool tests bypassed attestation; our successful HA test did not. |
| Plus 505 Combo | [CSA certificate for N100010](https://csa-iot.org/csa_product/n100010-roomba-plus-505-combo/): Matter 1.4, VID `0x1516`, PID `0x0031`. [Owner report #1](https://github.com/jouwdan/roomba-matter/issues/1) confirms Apple Home commissioning and sharing to HA. | Browser helper verified by Amoray on SKU **N185020**, firmware **`p25-505+9.3.6+I3.8.149`** (app display: **9.3.6 (I3.8.149)**), **Windows 11 / Edge**. Bluetooth setup and the power-button confirmation produced a code; scanning the QR paired it with Apple Home, then Apple Home sharing added it to Home Assistant. |
| Combo 10 Max | [CSA certificate for x085020](https://csa-iot.org/csa_product/roomba-combo-10-max/): Matter 1.3, VID `0x1516`, PID `0x0014`. iRobot's FAQ provides a setup route in the Classic app. | Not verified. The Classic app path must not be assumed to use the newer app's BLE procedure. |

PIDs above are specific certified variants, **not all regional PIDs for each model**. The runtime's tested PID `0x0010` must not be substituted into another robot's code. The CSA pages sometimes reuse product-description text across models; the table uses the identified variant, vendor/product IDs and certificate metadata, not that reused marketing text.

The 505 owner's tested SKU N185020 is different from the N100010 certificate variant. The report does not disclose its Matter product ID; do not infer it from the certificate. The report confirms commissioning and sharing, without a detailed local-control command test matrix.

## Bluetooth reconnection after pairing

[Issue #1](https://github.com/jouwdan/roomba-matter/issues/1) also reports `GATT Server is disconnected. Cannot retrieve services. (Re)connect first with device.gatt.connect` on later connections, with Bluetooth working again after several minutes. This does not establish a firmware cooldown or a browser fault as the cause.

The helper now makes at most **three read-only connection/discovery attempts**, waiting one second and then two seconds between retries. Each attempt reconnects and retrieves fresh services and characteristics, since disconnecting invalidates GATT handles ([Web Bluetooth documentation](https://developer.chrome.com/docs/capabilities/bluetooth#disconnect-from-a-bluetooth-device)). Missing protocol support and invalid metadata stop immediately. The UI reports reconnection progress and, if attempts are exhausted, advises closing other clients, staying nearby and waiting a few minutes.

This recovery never repeats setup initialization or the Matter activation command. No automatic retry occurs during `prepare()`, and a completed setup remains one-shot. These recovery cases are covered by simulated disconnect tests; the fix still needs confirmation on the reporting owner's hardware. If the robot is already in a Matter home, use its Share device flow rather than opening fresh setup.

[iRobot's Matter FAQ](https://answers.irobot.com/zh-TW/knowledge/1606) lists Plus 500 Combo, Max 700 Combo, Max 700 Vac and Combo 10 Max as compatible. It describes separate onboarding paths in Roomba Home and iRobot Home (Classic). That is evidence for native Matter across more than one product/app generation, not proof of a common BLE implementation.

We have not established this helper's compatibility for 105, 205, 405, Essential, j/i/s-series or other models. Do not infer a lack of all possible Matter bridges from that statement: it concerns **native commissioning with this helper**.

## Why cloud API versions are not the support test

This tool uses local Bluetooth, not the cloud API. A cloud/local protocol label such as v3 or v4 does not by itself prove any of the following:

- The installed firmware contains an enabled Matter implementation.
- The robot exposes the same BLE control and payload characteristics.
- The one-byte `g` command has the same meaning on that model.
- Initialization, physical button confirmation and payload framing match.
- The generated onboarding information is accepted by the intended controller.

The [roomba-v4 project](https://github.com/kilianp07/roomba-v4) describes newer Combo Max devices as v4 and demonstrates Matter control. iRobot's FAQ separately confirms native Matter on the Classic-app Combo 10 Max. **We have not independently verified a cloud API version number for each certified model.** App generation and marketing model names should not be presented as numeric API-version proof.

## App-code evidence

The Roomba Home 1.6.0 native client has a capability method `core::AssetCapabilitiesImpl::supportsMatter()` in `libcorebase.so`. Inspection of the method shows that it tests `AssetCapabilityRecord::matter() > 0`, rather than matching a 705 firmware string. It also contains `MatterDataUseCaseImpl::startMatterCommissioningOverBle()` and the setup/payload code used to derive this helper.

This supports investigating capability-based discovery across models. It does not identify every eligible model or prove that a robot implements the complete BLE flow. A positive cloud/app capability or the presence of the characteristic UUIDs alone is insufficient to enable arbitrary control writes. No proprietary app binaries or real onboarding secrets are included in this repository.

The helper has no exact firmware or product-ID allowlist. Owners can test other models through the normal flow. Max 705 Vac and Plus 505 Combo have owner-verified browser activation reports; successful synthetic fixtures or a connection notice do not certify another model. The robot's actual product ID is preserved in the QR payload.

Required BLE characteristics, valid identity/firmware metadata, identity stability, fresh physical confirmation and valid iRobot/on-network Matter payload checks remain in place. Missing protocol support stops the attempt; the helper does not guess alternative commands.

## How to add a model honestly

1. On an owner-authorized test robot, record the exact model/SKU and firmware. Use a robot whose existing Matter pairings can be lost.
2. First inspect the BLE service and required characteristics without control writes. Do not publish MAC addresses, serial numbers, identifiers, or setup payloads.
3. Verify the model's initialization and physical-confirmation sequence. On the tested Max 705 Vac, wait for the chime, then briefly press the power button once to confirm setup and receive the Matter pairing code. Record whether the model chimes, accepts that button press, and emits the expected `h → d → k` indications.
4. Test the activation request once and validate the returned VID/PID, discovery flags, discriminator and PIN. Keep all actual onboarding secrets private.
5. Commission into a real Matter controller with normal attestation validation. Verify state subscriptions, a reversible setting change, persistence and reconnection; document whether existing fabrics were removed.
6. Record the tested model/firmware and add a **synthetic** regression fixture, with a link to the owner's hardware results. Fake tests should check parsing and protocol checks, not be described as hardware proof.

Models without an owner activation report remain research candidates. No additional physical robot was activated by the agent for this update; the 505 result comes from issue #1 and the browser test on the 705 was confirmed by its owner.
