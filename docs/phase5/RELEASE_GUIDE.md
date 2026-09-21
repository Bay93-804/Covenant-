# Phase 5 Release Guide — physical-device readiness & TestFlight launch

This is the operational companion to `mobile/README.md`. It covers everything needed to get
**Coach Conde: The Long Game** onto a real iPhone — first as an unsigned preview build for
immediate device QA, then as a signed TestFlight build for Baylor and other reviewers. Phases 1–4
are authoritative and untouched by this phase; this document only covers release engineering,
configuration, and QA process.

Nothing in this phase created an EAS build, submitted to Apple, deployed the Supabase Edge
Function, or spent any money/credentials. Every step below that requires one of those says so
explicitly and is **not yet done** — see [§13 Exact remaining manual actions](#13-exact-remaining-manual-actions-for-baylor).

## Contents

1. [Required accounts](#1-required-accounts)
2. [Expo / EAS setup](#2-expo--eas-setup)
3. [Apple Developer prerequisites](#3-apple-developer-prerequisites)
4. [Supabase setup & migration order](#4-supabase-setup--migration-order)
5. [Environment variables](#5-environment-variables)
6. [Local development](#6-local-development)
7. [Path 1 — immediate physical-device preview](#7-path-1--immediate-physical-device-preview)
8. [Path 2 — TestFlight production build](#8-path-2--testflight-production-build)
9. [Deploying the delete-account Edge Function](#9-deploying-the-delete-account-edge-function)
10. [Build-number / version-code increment procedure](#10-build-number--version-code-increment-procedure)
11. [Rollback procedure](#11-rollback-procedure)
12. [Release checklist](#12-release-checklist)
13. [Exact remaining manual actions for Baylor](#13-exact-remaining-manual-actions-for-baylor)
14. [Physical-device QA checklist](#14-physical-device-qa-checklist)
15. [Privacy & support requirements](#15-privacy--support-requirements)
16. [Known limitations (Phase 5)](#16-known-limitations-phase-5)

---

## 1. Required accounts

| Account | Needed for | Cost |
| --- | --- | --- |
| **Expo account** (expo.dev) | Running EAS builds (both preview and production) | Free tier is enough |
| **Apple Developer Program** membership | Signing an iOS build for a real device, and any TestFlight/App Store distribution | $99/year, enrolled to an individual or the "Coach Conde" organization |
| **Supabase account + project** | The real (non-demo) backend | Free tier is enough to start |
| **App Store Connect access** (comes with the Apple Developer membership) | Creating the TestFlight listing, inviting testers | Included in the $99/year |

None of these were created or signed into during this phase.

## 2. Expo / EAS setup

```bash
npm install --global eas-cli   # or use `npx eas-cli` without a global install
cd mobile
eas login                      # signs in to your Expo account
eas init                       # links this project to an Expo project id (first time only)
```

`eas.json` (already in this repo) defines three build profiles — `development`, `preview`, and
`production` — see [§7](#7-path-1--immediate-physical-device-preview) and
[§8](#8-path-2--testflight-production-build). `appVersionSource: "local"` means the version/build
number EAS uses comes from `app.json`/`eas.json` directly, not a number tracked remotely by EAS —
see [§10](#10-build-number--version-code-increment-procedure).

## 3. Apple Developer prerequisites

Before a `production` (or a non-simulator `preview`) iOS build can be **submitted**, you need:

1. An active Apple Developer Program membership.
2. An App Store Connect **app record** for bundle identifier `com.coachconde.longgame` (create one
   under **My Apps → +** in App Store Connect; the bundle ID must match `app.json`'s
   `expo.ios.bundleIdentifier` exactly).
3. A signing certificate + provisioning profile — **EAS can generate and manage these for you**
   (`eas build` prompts for this interactively the first time; choose "Let Expo handle it" unless
   your organization has its own distribution certificate policy).

None of this is required just to **build** a preview `.ipa` for ad-hoc install on your own
registered device — only to submit to TestFlight. See the distinction in §7 vs §8.

## 4. Supabase setup & migration order

1. Create a Supabase project at supabase.com.
2. Apply every migration in `mobile/supabase/migrations/` **in filename order** — they're
   timestamp-prefixed, so alphabetical order is chronological order:
   ```
   20250601000001_extensions_enums_helpers.sql
   20250601000002_profiles.sql
   20250601000003_program_content.sql
   20250601000004_enrollment_and_scheduling.sql
   20250601000005_readiness_and_safety.sql
   20250601000006_testing.sql
   20250601000007_sport_journal_notifications.sql
   20250601000008_row_level_security.sql
   20250601000009_phase3_schedule_extensions.sql
   20250601000010_adjustment_audit_trail.sql
   ```
   Apply them with the Supabase CLI (`supabase link --project-ref <ref>` then
   `supabase db push`), or paste each file's contents into the SQL Editor in the Supabase
   dashboard, in that exact order. **This phase verified all 10 apply cleanly, in order, to an
   empty Postgres database** — see the verification note at the end of this section.
3. Seed the program-content tables from the authoritative JSON:
   ```bash
   cd mobile
   SUPABASE_URL=https://<project>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
   npm run seed:supabase
   ```
   Idempotent — safe to re-run (see `mobile/README.md`'s Supabase setup section for why).
4. Verify Row-Level Security is on. In the SQL Editor:
   ```sql
   select relname, relrowsecurity from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r'
   order by relname;
   ```
   Every row should show `relrowsecurity = t`. (Also verified by this phase — see below.)
5. Set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — see [§5](#5-environment-variables).

**Verification done in this phase (no live Supabase project available in this environment):**
every migration was applied in order to a local Postgres 16 database with a stand-in `auth`
schema (a minimal `auth.users` table plus `auth.uid()`/`auth.role()` functions matching what
Supabase's real Postgres provides) — all 10 files applied without error. All 24 `public` tables
came back with `relrowsecurity = true` and the expected policy counts (2 for
read-only-to-authenticated content tables, 4 for user-owned tables). A live cross-user isolation
test was then run against `readiness_entries`: athlete A inserted a row; athlete B, authenticated
as a different `auth.uid()`, got 0 rows back from `SELECT`, `UPDATE 0`/`DELETE 0` on athlete A's
row, and a rejected `RLS policy violation` when attempting to `INSERT` a row claiming to be
athlete A. This is strong evidence the schema and policies are correct, but it is **not** a
substitute for repeating the same check against the real Supabase project once it exists —
Supabase's actual `auth.uid()`/`auth.role()` implementations and any project-level settings
(Postgres version, extensions) could still differ.

## 5. Environment variables

See `mobile/.env.example` for the full annotated list. Summary:

| Variable | Where it's used | Required for |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | App bundle (client) | Real backend mode |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | App bundle (client) | Real backend mode |
| `EXPO_PUBLIC_APP_ENV` | App bundle (client) | Set automatically per EAS profile — `development`/`preview`/`production`. A `production` build with no Supabase URL/key refuses to start rather than silently using demo mode (`src/lib/env.ts`'s `isMisconfiguredProductionBuild`). |
| `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_SUPPORT_URL` | App bundle (client) | Shown on the Profile screen; see [§15](#15-privacy--support-requirements) |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/seed-supabase.ts` only, run from a trusted machine/CI | Seeding program content — **never** in the app bundle, **never** committed |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets (`supabase secrets set`) | `delete-account` function only — see [§9](#9-deploying-the-delete-account-edge-function) |

**For local development:** `cp mobile/.env.example mobile/.env` and fill in the two
`EXPO_PUBLIC_*` values (or leave them blank to use demo mode).

**For EAS builds:** set `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS
environment variables/secrets scoped to the `preview` and `production` profiles — **never** commit
them to `eas.json` or any file in git:
```bash
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://<project>.supabase.co --environment preview production
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --environment preview production
```
(The `development` profile is intentionally left unconfigured so it always boots in demo mode for
day-to-day device testing without a live backend.)

## 6. Local development

```bash
cd mobile
npm install
npm run start        # Expo dev server; press i/a/w, or scan the QR code with Expo Go
```

Works immediately in demo mode with no setup. See `mobile/README.md` for the full breakdown.

## 7. Path 1 — immediate physical-device preview

No Apple Developer account, no Supabase project, no App Store Connect — just a way to get the
real app on a real iPhone today.

**Option A — Expo Go (fastest, zero build step):**
```bash
cd mobile
npm run start
```
Scan the QR code with the iPhone's Camera app (opens in Expo Go, installed free from the App
Store). This runs the exact same JS as any other build, in demo mode by default. This is the
fastest path and is what most of Section 14's QA checklist below should be run through first.

**Option B — a real standalone preview build (closer to production, needs Expo/EAS account only):**
```bash
cd mobile
eas build --profile preview --platform ios
```
This requires registering the test device's UDID with EAS the first time (`eas device:create`,
following the prompt) so the ad-hoc provisioning profile can include it — EAS walks you through
this interactively. No Apple Developer Program membership is required for this ad-hoc path if
Expo's own shared ad-hoc distribution is used; a paid account is required to distribute to devices
outside of that. Once the build finishes, EAS gives you an install link/QR code — open it on the
iPhone.

The `preview` profile has no `EXPO_PUBLIC_SUPABASE_*` set by default (see §5), so it runs in demo
mode unless you've explicitly configured those EAS env vars for `preview`.

## 8. Path 2 — TestFlight production build

**Not run in this phase — requires your explicit authorization, an Apple Developer membership,
and will use EAS's free build-minutes allotment or a paid plan once that's exhausted.**

```bash
cd mobile
eas build --profile production --platform ios
```
- Uses `com.coachconde.longgame` (must match an App Store Connect app record — see §3).
- `autoIncrement: true` in `eas.json`'s `production` profile means EAS bumps the iOS build number
  automatically on every production build — see §10 for the manual alternative.
- Requires `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` to be set as EAS secrets for
  the `production` environment (§5) — the app will refuse to start otherwise
  (`isMisconfiguredProductionBuild`), by design.

Once the build finishes:
```bash
eas submit --profile production --platform ios
```
This is interactive (Apple ID sign-in, app-specific password or API key) and is the step that
actually uploads to App Store Connect / TestFlight — **do not run this without explicit
authorization**, since it's the point of no return for "an Apple-side record now exists."

After a successful submit, in App Store Connect → TestFlight:
1. Add Baylor as an internal or external tester (their Apple ID email).
2. Once Apple finishes processing the build (usually a few minutes to an hour), Baylor gets a
   TestFlight invite email/notification.
3. **TestFlight installation guide for Baylor:**
   1. Install **TestFlight** from the App Store (free, from Apple).
   2. Open the invite email/link on the iPhone, tap "View in TestFlight."
   3. Tap **Install**.
   4. Open the app from the TestFlight app or the home screen icon — same as any other app from
      here on.
   5. TestFlight builds expire 90 days after upload — a new build (with a higher build number,
      §10) needs to be submitted before then to keep testing.

## 9. Deploying the delete-account Edge Function

**Not deployed in this phase — the function exists at
`mobile/supabase/functions/delete-account/index.ts` but has not been pushed to any Supabase
project.** Account deletion in Supabase mode will show a clear "not available yet" error in the
app until this is done (see `src/lib/accountDeletion/deleteAccount.ts`).

```bash
cd mobile
supabase link --project-ref <your-project-ref>
supabase functions deploy delete-account
supabase secrets set SUPABASE_URL=https://<project>.supabase.co
supabase secrets set SUPABASE_ANON_KEY=<anon-key>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```
The service-role key here lives only in Supabase's managed function environment — never in git,
never in the mobile app bundle. See the header comment in
`mobile/supabase/functions/delete-account/index.ts` for the full security rationale (the function
verifies the caller's own session token before using the service-role client, so it can only ever
delete the caller's own account).

## 10. Build-number / version-code increment procedure

- **iOS build number** (`app.json`'s `expo.ios.buildNumber`): the `production` EAS profile has
  `autoIncrement: true`, so this is normally handled automatically per `eas build`. To bump it by
  hand instead (e.g. for a preview build, which doesn't auto-increment), edit
  `app.json` → `expo.ios.buildNumber` to the next integer string before building.
- **Android version code** (`app.json`'s `expo.android.versionCode`): same mechanism — bump the
  integer in `app.json` before an Android production build, or rely on `autoIncrement`.
- **App version** (`app.json`'s `expo.version`, currently `1.0.0`): bump this for any
  user-visible release (semver). `runtimeVersion: { policy: "appVersion" }` (also in `app.json`)
  ties the JS runtime-compatibility version to this same number — bumping `version` on a native
  change is what tells EAS Update (if ever wired up) that an OTA update targeting the old runtime
  is no longer compatible.

## 11. Rollback procedure

- **TestFlight build:** in App Store Connect → TestFlight, you can stop distributing a specific
  build to testers (it stays visible in build history but testers can no longer install it) or
  simply not promote it further. TestFlight has no true "rollback" — the fix is to ship a new
  build with a higher build number promptly.
- **Supabase migration:** every migration in `mobile/supabase/migrations/` is additive (new
  tables/columns/policies) — none of them are destructive. If a migration needs to be undone,
  write a new migration that reverses it explicitly (e.g. `drop policy ...`, `alter table ... drop
  column ...`) rather than editing or deleting the original file; the numbered migrations are a
  permanent history, not a mutable state.
- **This git branch:** if a Phase 5 change needs to be reverted independently of the rest, revert
  the specific commit(s) — see `git log` on this branch for the commit boundaries described in
  the final report.

## 12. Release checklist

Run through this before any TestFlight submission:

- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` all clean
- [ ] `npm test` — all Jest suites passing
- [ ] `npm run e2e` — Playwright suite passing
- [ ] `npm run validate:program` — program content still valid, unchanged
- [ ] `npx expo export --platform ios` and `--platform android` — both bundle cleanly
- [ ] `npx expo-doctor` — no new failures beyond documented network-dependent checks (see final report)
- [ ] `app.json` version/build number bumped per §10
- [ ] EAS secrets for the target profile include a real, tested `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY`
- [ ] Supabase migrations applied to the target project, in order (§4)
- [ ] Manual device QA checklist (§14) run on an actual iPhone for anything code review/CI cannot verify
- [ ] Privacy/support URLs are real (not placeholders) if this is a public-facing TestFlight build (§15)
- [ ] No secrets in git (`git log -p` diff review, `.env` never committed)

## 13. Exact remaining manual actions for Baylor

These are the only steps this phase could not complete, because each requires a credential,
external account, or spend decision reserved for you:

1. **Create/confirm the Expo account** and run `eas login` / `eas init` (§2).
2. **Enroll in the Apple Developer Program** if not already enrolled, and create the App Store
   Connect app record for `com.coachconde.longgame` (§3).
3. **Create the real Supabase project**, apply the 10 migrations in order, run
   `npm run seed:supabase`, and set the EAS env vars for `preview`/`production` (§4, §5).
4. **Decide on and set real privacy-policy/support URLs** (§15) — currently unset placeholders.
5. **Run `eas build --profile preview --platform ios`** (or use Expo Go directly) to get the app
   on your iPhone for Section 14's QA pass.
6. **Explicitly authorize** `eas build --profile production` and `eas submit` when ready for
   TestFlight (§8) — this phase deliberately did not run either.
7. **Deploy the `delete-account` Edge Function** (§9) once the Supabase project exists, if
   Supabase-mode account deletion needs to work before general/public availability.
8. **Replace the placeholder app icon/splash assets** — see the note at the end of §14.

## 14. Physical-device QA checklist

**Not run against a physical device during this phase** — this environment has no iPhone, no
Xcode, and no iOS Simulator (see `mobile/README.md`'s pre-existing "Not tested on a physical
iOS/Android simulator or device" limitation, unchanged since Phase 3/4). Everything in this
checklist is what to verify once the app is actually installed on Baylor's iPhone via §7 or §8.
Automated coverage that *was* run this phase (Jest, Playwright on a Chromium mobile viewport,
`expo export` for all three platforms) is reported separately in the final Phase 5 report — it is
not a substitute for the items below, which specifically test real iOS behavior (hardware timers,
backgrounding, VoiceOver, Keychain, real push of the app to background/foreground, etc.) that a
simulator/emulator or web browser cannot exercise.

For each item: check it off only after actually performing it on the device, and note anything
that fails so it can be fixed before a public release.

### Install & launch
- [ ] Fresh install (delete any prior copy first) installs and opens without error
- [ ] Splash screen shows the Midnight Navy background + icon, then transitions to the app
- [ ] Status bar is legible (light content on the dark background)

### Auth & onboarding
- [ ] Sign-up (Supabase mode) creates an account and lands in onboarding
- [ ] Sign-up (demo mode, no `EXPO_PUBLIC_SUPABASE_*` set) works fully offline
- [ ] Sign-in with correct/incorrect credentials behaves as expected, with a clear error on failure
- [ ] Onboarding's native date picker (DOB, Week 1 Start Date) opens and behaves like a normal iOS
      date picker; a non-Monday Week 1 Start Date shows the inline validation error
- [ ] Notification-time pickers work
- [ ] Completing onboarding lands on the Today tab

### Week 0 testing & RHR
- [ ] Week 0 testing hub is reachable immediately after onboarding
- [ ] Three-morning RHR entry: entering a 4th morning on the same calendar date offers the
      correction flow rather than silently duplicating
- [ ] Established RHR only appears after exactly 3 mornings are recorded
- [ ] Entering each of the 15 Week 0 markers works; sprint-deferral flow records a reason + date

### Keyboard & forms
- [ ] Numeric/decimal keyboards appear for weight/rep/time fields where expected
- [ ] Keyboard does not obscure the field being edited; "Done"/return dismisses correctly
- [ ] Autosave: fill a field, background the app (swipe up, don't force-quit), reopen — value
      persisted
- [ ] Force-quit the app mid-entry, reopen — last saved value persisted (not necessarily
      mid-keystroke, but not silently lost either)

### Backgrounding & timers
- [ ] Start a rest timer, lock the phone (side button), unlock a few seconds later — the timer
      shows correct elapsed/remaining time (not frozen, not reset)
- [ ] Background the app during a rest timer (home swipe, not lock) for 30+ seconds, foreground —
      timer is accurate
- [ ] Timer completion sound/haptic fires correctly when the app is foregrounded at completion

### Readiness, safety, and adjustments
- [ ] Daily readiness check gates a session correctly on each safety signal (elevated RHR, <6h
      sleep, calf/Achilles warning, hamstring grabby, joint pain, two missed weeks)
- [ ] Safety-adjustment confirmation screen shows the correct original vs. adjusted prescription
      and requires explicit confirmation
- [ ] Pickup-sport adjustment flow completes and reflects on the day's session

### Guided workout player
- [ ] PM strength (cluster-based set logging) and Tuesday AM Core/Balance/Brake log sets correctly
- [ ] The other AM session types' segment checklists check off and persist
- [ ] Substitutions can be selected and are reflected in the session summary
- [ ] Completing a workout shows the correct summary and marks the day complete on the Program
      calendar

### Progress, testing history, comparisons
- [ ] Progress dashboard adherence/charts render with real logged data
- [ ] Exercise history shows personal-best detection correctly
- [ ] Week 0 → Week 6 comparison shows exactly the markers Week 6 carries (6, or 7 if #11 was
      deferred) — never a full 15-marker comparison
- [ ] Readiness/adjustment history is a factual log, not framed as medical advice

### Offline, sync, and duplicate prevention
- [ ] Enable Airplane Mode, log a full workout, disable Airplane Mode — data syncs to Supabase
      (Supabase mode only) without user action
- [ ] Kill the app mid-sync (force-quit while offline data is pending), reopen with connectivity —
      sync resumes and completes; no duplicate rows in Supabase
- [ ] Deliberately fail a sync (e.g. briefly point at an invalid `EXPO_PUBLIC_SUPABASE_URL` in a
      preview build) — the app keeps working locally and the Connectivity Banner
      (`src/features/shared/ConnectivityBanner.tsx`) shows a clear, non-alarming message

### Deep links & account lifecycle
- [ ] Tap "Forgot password," receive the email, tap the link on the iPhone — the app opens
      directly (not a browser) to the "set a new password" screen and the new password takes
      effect on next sign-in
- [ ] Sign out, sign in as a **different** account (Supabase mode: a second real account; demo
      mode: a second local demo account) — no trace of the first account's workouts/testing/
      profile data appears anywhere
- [ ] Account deletion (Profile → Delete Account): warning copy is accurate, requires password +
      typed confirmation, and afterward the account can no longer sign in
- [ ] Demo mode's "Reset Local Demo Data" (Profile tab) clears every local demo account

### Layout, accessibility, appearance
- [ ] Test on the smallest supported iPhone screen you have access to — no clipped/overlapping
      content
- [ ] iOS Settings → Accessibility → Larger Text at a large setting — text scales, layout doesn't
      break
- [ ] VoiceOver: swipe through the Today screen and the guided workout player — every control has
      a sensible spoken label (Button/TextField already set `accessibilityRole`/labels — verify
      they read naturally, not just that they exist)
- [ ] iOS Dark Mode / Light Mode OS setting — app always renders its fixed Midnight Navy theme
      regardless (by design, not a bug — see `tailwind.config.js`'s `darkMode: 'class'` comment)
- [ ] Rotate the device — app either locks portrait cleanly or handles landscape without breaking
      (per `app.json`, orientation is locked to portrait — confirm rotation is actually ignored)
- [ ] Safe areas: on a Face-ID iPhone, content never sits under the notch/Dynamic Island or is
      obscured by the home indicator

### Power, connectivity, and updates
- [ ] Low Power Mode enabled — timers and haptics still function acceptably
- [ ] Airplane Mode toggled on/off repeatedly during normal use doesn't crash or corrupt local data
- [ ] Installing a newer build over an existing one (same bundle ID) preserves local
      workout/testing/profile data — no data loss on update

**Icon/splash placeholder note:** `mobile/assets/icon.png`, `splash-icon.png`, and the three
Android adaptive-icon layers are still the default Expo template asset (a generic blue "A"
mark), not a real Coach Conde crest. This phase did not fabricate a replacement, per the brief's
instruction. **Exact dimensions needed before public release** (Apple/Google's own current
requirements, restated here for convenience):
- `icon.png` (iOS App Store icon, referenced by `expo.icon`): **1024×1024px, PNG, no alpha
  channel, no transparency, no rounded corners** (iOS applies the mask itself).
- `splash-icon.png` (used at `imageWidth: 140` in `app.json`'s splash-screen plugin config): any
  square PNG at least 280×280px (2x of 140) is safe; transparency is fine here.
- `android-icon-foreground.png` / `android-icon-background.png`: **512×512px PNG**, foreground
  content kept within the inner ~66% safe zone (Android's adaptive-icon masking crops the outer
  edge on some launchers).
- `android-icon-monochrome.png`: **512×512px PNG**, single-color artwork only (used for Android
  13+ themed icons) — the existing file is 432×432px and should be regenerated at 512×512 to
  match the other two layers.
- `favicon.png` (web only, lowest priority): 48×48px is sufficient.

## 15. Privacy & support requirements

`EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_SUPPORT_URL` (see §5) are **unset placeholders** —
the Profile screen shows "Not yet published" for both until real URLs are set. **A public App
Store submission requires both**: Apple's App Store Connect submission flow requires a privacy
policy URL, and a support URL is strongly expected (required in practice for review). Neither is
needed for an internal TestFlight build to a small group of named testers, only for a public
listing.

## 16. Known limitations (Phase 5)

- **No physical iPhone was available in this environment** — see §14's header note. Everything
  automatable (typecheck, lint, unit tests, Playwright on a Chromium mobile viewport, all three
  platform exports) was run and is reported in the final Phase 5 report; genuine iOS-hardware
  behavior (real background timer accuracy under iOS's own suspension model, VoiceOver's actual
  spoken output, Keychain behavior across an OS-level backup/restore, TestFlight's own install
  flow) is unverified until §14 is actually run on Baylor's device.
- **`npx expo-doctor` and `npx expo install --check`** could not complete two of their checks
  (remote Expo config-schema validation and the React Native Directory package-metadata check)
  because this sandboxed environment's outbound network allowlist doesn't include the specific
  hosts those two checks call — every other check (SDK version compatibility, peer dependencies,
  duplicate dependencies, native module compatibility, and 15 others) passed. This is a sandbox
  networking limitation, not a finding about the project — see the final Phase 5 report for the
  exact verbatim output.
- **No live Supabase project exists yet** — §4's migration/RLS verification was performed against
  a local Postgres instance with a hand-written stand-in `auth` schema, which is strong evidence
  but not a substitute for the same check against the real project once created.
- **The `delete-account` Edge Function is not deployed** (§9) — Supabase-mode account deletion
  will show a clear error until it is.
- **Push-notification delivery, coaching dashboards, subscriptions, and social features** remain
  entirely out of scope, per Phase 4's own "What remains for Phase 5" list — this phase is release
  engineering only, not a new-feature phase, and none of those were touched.
