# checkpoint mobile — playtesting companion

This is a separate Expo SDK 58 / React Native application in the team repository. It uses the existing Express/MongoDB API. It is not the desktop site in a WebView.

Included: existing-account sign-in, playtester registration, project search, build links/release notes, open playtest sessions, rating/comments feedback, structured bug reports, own-report status tracking, and up to three authenticated screenshot attachments/removal. Team/project administration, planning boards, assignments and GitHub management stay on desktop. Feedback review/triage also stays on desktop.

## Run on your Mac and phone

Use Node 24 LTS (or Node 22.19+). Node 25 is outside the supported engine range of some Expo lint dependencies.

```bash
cd "$HOME/checkpoint-review"
npm ci --prefix mobile
cd mobile
npx expo start --lan
```

Install Expo Go on your phone and scan the QR code. This branch targets SDK 58 to match the installed Expo Go version observed on the team phone. Keep the Expo SDK and its native dependency versions aligned; do not upgrade individual native packages independently. The Mac and phone must be able to reach the development server. The default API is `https://checkpoint.morning.codes`; use your existing account, or create a playtester account. New-account verification/recovery are not implemented by this mobile branch.

**PR #10's shared API must be deployed** before using advanced session/screenshot features against production. This branch includes that repair baseline and should be reviewed after it. This work does not merge or deploy it.

## Test against isolated local sample data

From the repository root, install root/server/client dependencies once:

```bash
npm ci
npm ci --prefix server
npm ci --prefix client
```

Terminal 1:

```bash
CHECKPOINT_DEMO_HOST=0.0.0.0 npm run demo:local
```

Terminal 2, replace `YOUR_MAC_LAN_IP` with your Mac's LAN IP address (System Settings → Network; often also shown by `ipconfig getifaddr en0`):

```bash
cd "$HOME/checkpoint-review/mobile"
EXPO_PUBLIC_API_URL=http://YOUR_MAC_LAN_IP:4002 npx expo start --lan --clear
```

Open the QR code in Expo Go. Use `tester` / `checkpoint-demo` for playtesting, or `demo` / `checkpoint-demo` for a developer account. The desktop sample app is `http://localhost:4002`. Sample data is temporary and resets when the demo API restarts. Use the LAN binding only when connecting a phone on your trusted local network; the normal demo defaults to loopback.

`localhost` on a phone means the phone itself. A public Expo tunnel exposes the Metro development bundle, not your local API; the API still needs a reachable LAN address or remote HTTPS origin. Fully restart Metro with `--clear` after changing `EXPO_PUBLIC_API_URL`. This variable is public configuration, never a password or secret.

## Checks and scope of evidence

```bash
npm run typecheck
npm run lint
npm test
npm run export:native
npx expo-doctor
```

From the repository root, `npm ci --prefix tools/quality` then `npm run test:mobile:e2e` builds the native-source web validation target and desktop production bundle, starts a real isolated API/MongoDB, and runs browser interaction checks at 390×844. It saves results/screenshots under `artifacts/mobile-smoke`. This includes a deliberately failed write to verify draft retention; other success paths use the real API. It changes isolated test data only.

iOS/Android JavaScript/Hermes exports and browser validation are not an installed native binary or physical-device test. Native SecureStore, the OS photo picker, permissions, keyboard, safe areas and hardware back behavior still require a phone/emulator walkthrough. Use Expo Go for the first walkthrough. Optional EAS profiles provide an Android internal APK or an iOS simulator build; `npx eas-cli@latest build --platform android --profile preview` requires the team's Expo account and build setup.

Native tokens use SecureStore; the browser validation target uses sessionStorage. Passwords are never persisted. Saved tokens are scoped to the API origin and cleared on 401/sign-out. A failed write keeps the form; double taps are locked. A transport timeout can have an unknown server outcome: inspect My bug reports before manually resubmitting. Unsent drafts are in memory and are lost if you leave/unmount or restart the app; offline drafts/background sync are not implemented.

Photo attachment is an explicit second step after a report is saved, so an upload failure does not recreate the report. PNG/JPEG/WebP only, 2 MiB each, three per bug; the server revalidates type, size and access. HEIC must be converted before selection. Native upload uses `expo/fetch` with an Expo File body.

## Phone demo checklist

- Sign in, reload/reopen, sign out; confirm a shared device stays signed out.
- Choose the actual project/build; open a playable link suitable for that device.
- Submit session feedback and see it in the desktop feedback view.
- Submit a bug with reproduction, expected/actual, severity and environment.
- Attach an actual phone screenshot, then verify it in the desktop bug drawer.
- Change the report's status on desktop; refresh My bug reports on the phone.
- Try a closed/expired session and a disconnected network; confirm clear errors and preserved drafts.
- Record device/OS, account role, API origin, date, results and failures. Do not mark the native-device gate complete until this is done.

## iOS Simulator fallback

After Xcode finishes installing, launch Xcode once to complete first-run setup and install an iOS simulator runtime if prompted. Start Metro with an API origin reachable from the simulator, such as `EXPO_PUBLIC_API_URL=http://127.0.0.1:4002 npx expo start --clear`, then press `i`. Keep the local API running. Simulator execution is a separate acceptance check; it was not executed in this environment.
