# Model compatibility and evidence

Checked on 21 October 2026. **Native Matter support is different from support for this helper's Bluetooth activation procedure.** Certification, an app capability flag, and a fake-device test cannot prove that procedure on a different physical robot.

## Evidence we can substantiate

| Robot | Evidence for native Matter | Evidence for this helper's activation sequence |
| --- | --- | --- |
| Max 705 Vac | One physical robot was commissioned into Home Assistant, with attestation validation enabled. Battery, state and clean-mode changes worked. | Native macOS BLE implementation verified on `p25-705+9.3.6+I3.8.149`; this browser port still needs a complete hardware test. |
| Max 705 Combo | [CSA certificate for X100010](https://csa-iot.org/csa_product/x100010-roomba-max-705-combo-2/): Matter 1.4, VID `0x1516`, PID `0x0049`. An independent owner reports [commissioning and state reads](https://github.com/kilianp07/roomba-v4/issues/8) and [working start, stop, pause, resume, dock and mode commands](https://github.com/kilianp07/roomba-v4/issues/11). | Not verified. That owner's setup code came from the manufacturer app. Their chip-tool tests bypassed attestation; our successful HA test did not. |
| Plus 505 Combo | [CSA certificate for N100010](https://csa-iot.org/csa_product/n100010-roomba-plus-505-combo/): Matter 1.4, VID `0x1516`, PID `0x0031`. | Not verified. Certification does not document the BLE activation command or shipping firmware behavior. |
| Combo 10 Max | [CSA certificate for x085020](https://csa-iot.org/csa_product/roomba-combo-10-max/): Matter 1.3, VID `0x1516`, PID `0x0014`. iRobot's FAQ provides a setup route in the Classic app. | Not verified. The Classic app path must not be assumed to use the newer app's BLE procedure. |

PIDs above are specific certified variants, **not all regional PIDs for each model**. The runtime's tested PID `0x0010` must not be substituted into another robot's code. The CSA pages sometimes reuse product-description text across models; the table uses the identified variant, vendor/product IDs and certificate metadata, not that reused marketing text.

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

The helper no longer has an exact firmware or product-ID allowlist. Owners can test other models through the normal flow. The Max 705 Vac remains the only hardware-verified native activation procedure; successful synthetic fixtures or a connection notice do not certify another model. The robot's actual product ID is preserved in the QR payload.

Required BLE characteristics, valid identity/firmware metadata, identity stability, fresh physical confirmation and valid iRobot/on-network Matter payload checks remain in place. Missing protocol support stops the attempt; the helper does not guess alternative commands.

## How to add a model honestly

1. On an owner-authorized test robot, record the exact model/SKU and firmware. Use a robot whose existing Matter pairings can be lost.
2. First inspect the BLE service and required characteristics without control writes. Do not publish MAC addresses, serial numbers, identifiers, or setup payloads.
3. Verify the model's initialization and physical-confirmation sequence. Record whether the robot prompts and the expected `h → d → k` indications occur.
4. Test the activation request once and validate the returned VID/PID, discovery flags, discriminator and PIN. Keep all actual onboarding secrets private.
5. Commission into a real Matter controller with normal attestation validation. Verify state subscriptions, a reversible setting change, persistence and reconnection; document whether existing fabrics were removed.
6. Record the tested model/firmware and add a **synthetic** regression fixture, with a link to the owner's hardware results. Fake tests should check parsing and protocol checks, not be described as hardware proof.

Until then, these are research candidates that owners are welcome to test. No additional physical robot was activated to prepare this document or remove the allowlists.
