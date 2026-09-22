# GemSteps for Android

Kotlin / Jetpack Compose / Material 3 native application, Android 8.0 (API 26)+.
The current iOS app is the functional and visual reference. No WebView, backend,
account, AI feature, analytics or network permission is used. Data stays on this
installation; cloud backup and device transfer are disabled.

## Build and run

Open this `android/` directory in Android Studio, or use JDK 17 and an Android SDK:

```sh
# From android/; set JAVA_HOME to your JDK 17 and ANDROID_HOME to your SDK.
./gradlew assembleDebug
./gradlew testDebugUnitTest lintDebug
# Start an emulator or attach a test device before this command:
./gradlew connectedDebugAndroidTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The Gradle wrapper pins and verifies Gradle 8.13. AGP 8.11.1, Kotlin 2.1.20,
Compose BOM 2025.06.01 and Room 2.7.2 are pinned as a compatible set.
SDK platform 36 and build tools 35.0.0 are required. `local.properties` can point
to the local SDK but must not be committed. Dependencies download on first build.

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`.
Application ID: `me.gordon.gemsteps`. Release signing is intentionally not
configured; the debug APK is suitable for installation and acceptance testing.
Use a dedicated test device/profile: UI instrumentation exercises the installed
app's real user flows. Database tests always use separate temporary databases.

## iOS parity

Interface copy follows the **resolved translations** in
`ios/GemSteps/Localizable.xcstrings`, not the resource keys or README prose.
For example, `Manual Adjustment` displays as `Adjust` / `手动加减`, and
`Undo Mode` displays as `Undo` / `撤销模式`. Font scaling does not substitute
alternate wording. Both language resources have been checked against 51
corresponding iOS strings, including editor, empty-state and accessibility text.
The Compose flow tests also assert the visible header labels in both languages.


- Purple gradient header; balance on the left, date and daily net on the right;
  action row on phones and a single header row on sufficiently wide windows.
- Tasks / rewards selector above the same multicolored card grid. Two columns
  on phones, more columns on tablet-size windows; system light/dark appearance,
  font scaling and TalkBack descriptions.
- Same stable IDs, order, bilingual names, points and enablement defaults for
  28 tasks and 10 rewards. Initially 8 tasks and 4 rewards are enabled.
- Repeatable task completion, reward redemption, cumulative balance, daily
  occurrence counts and same-day undo of the latest outstanding occurrence.
- Undo uses the original point amount and item snapshot, even after editing,
  disabling or deleting the item. Reward refunds retain the original cost.
  A task undo cannot make the balance negative.
- Manual ±1–999 adjustment in a centered native dialog with a three-column keypad:
  `+ / amount / −`, digits, then `0 / backspace / confirm`. Excess deductions
  clamp to the available balance and record the actual deduction, including 0.
- Approximately two seconds of blocking celebration after successful writes;
  manual adjustments dismiss the keypad and use the same full-screen celebration
  as tasks. Undo is silent. Audio is the same Kenney CC0 resource used on iOS; see AUDIO-LICENSE.txt.
- Management has the selector and close control at the top, mixed template and
  custom rows, edit buttons, active switches, drag handles and an add button at
  the bottom right. Drag a handle to reorder; tapping a handle or using TalkBack
  also provides move-up / move-down actions. New items are inserted first.
- Templates have fixed names/icons; points and active state can be edited.
  Custom items support name, one emoji/grapheme, points, active state and confirmed
  deletion. Names allow up to 100 graphemes. Item kind remains fixed.
- English / Simplified Chinese switching is available from the globe button and
  Android's per-app language settings. First launch uses Chinese for a Chinese
  system locale, otherwise English. The choice persists; custom text is literal.
- Business dates follow America/Los_Angeles, including daylight-saving time,
  exactly as on iOS. Foregrounding, periodic refresh and every write check the day.

Platform differences: Material buttons, dialogs, switches, fonts, system emoji,
back navigation and ripple feedback replace their Apple equivalents. The app
uses Android adaptive launcher artwork with the same star motif. Android data
is independent of iOS data; there is no import or cross-device synchronization.

## Structure and data safety

- `Points.kt`: pure point rules, ledger replay and Pacific date keys.
- `Catalog.kt`: shipped catalog matching `ios/GemSteps/Models/Catalog.swift`.
- `Database.kt`: Room entities, transactions, validation, catalog initialization
  and ordering. Schema snapshots are committed in `app/schemas/`.
- `GemViewModel.kt`: serialized actions, saved navigation state, date refresh and
  celebration/audio lifetime. UI updates only after successful ledger commits.
- `PointsScreen.kt`, `AdjustmentDialog.kt`, `ManagementScreen.kt`: Compose views.
- `res/values*/strings.xml`: interface translations; `drawable-nodpi` and `raw`
  contain the reused iOS illustrations and audio.

Ledger entries are append-only, explicitly sequenced, and include snapshots plus
reversal IDs. Deleting a custom item never deletes ledger rows. Template upgrades
preserve points, active switches and ordering; new templates default to inactive
once initialization has occurred. All-disabled is a legitimate saved state.

Room transactions roll back failed writes. The SQLite corruption callback is
explicitly overridden to retain the original file instead of deleting it. There
is no destructive migration fallback. Future schema changes must supply explicit
migrations and migration tests; existing installs must not be reset.

## Verification

Verified on 2026-09-21:

- Debug APK and optimized, unsigned Release APK build successfully.
- 11 JVM unit tests and 9 Android instrumentation tests pass on Android 16 / API 36.
- Android lint reports zero errors (remaining warnings are dependency update,
  newer-API XML attributes and Kotlin style suggestions).
- Visually inspected Chinese and English, a 320 × 568 dp small phone,
  the default Pixel 6 viewport, a 1280 × 800 dp tablet-size window, management,
  the keypad, dark mode and 1.5× font scaling on the emulator.
- Force-stopping and relaunching preserves the committed balance and Chinese
  language selection. No AndroidRuntime crash was reported in these checks.
- API 26 is the declared minimum; this run did not test an API 26 device.

On 2026-09-22, the centered adjustment dialog was verified on Kindle Fire, and
the updated debug APK was installed with existing data preserved. All 11 JVM
tests and 10 instrumentation tests passed; the added regression test verifies
that manual and task celebrations use the same full-screen dimensions.

Unit tests cover defaults, repeated tasks, original-price undo/refunds, insufficient
balance, oversized deductions, invalid inputs, midnight/DST and overflow. Device
tests cover persistence, deletion snapshots, order, catalog initialization,
Unicode validation, real SQLite transaction aborts and unreadable-file retention.
Compose tests exercise earning, keypad adjustment, creation, disabling, deletion,
undo, recreation, language switching, redemption and drag ordering.

Build outputs, verification screenshots, test reports and emulator state are not
source files and must remain outside Git. Physical-device sound/ringer behavior
and vendor-specific differences require real-device acceptance testing.
