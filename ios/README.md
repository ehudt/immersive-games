# סופרים עד השמיים — iOS

A native SwiftUI port of the counting game (`src/games/counting/`), for iPhone
(portrait) and iPad (any orientation), iOS 17+. Hebrew only, right-to-left.

Open `CountToTheSky.xcodeproj` in Xcode 16 or later, pick a team under
Signing & Capabilities, and run. Speech recognition needs a real device or a
simulator with a working microphone.

## Install on your iPhone

1. On a Mac with Xcode 16 or later: `git clone https://github.com/ehudt/immersive-games`
   (or `git pull`), check out the branch, and open
   `ios/CountToTheSky.xcodeproj`.
2. Xcode → Settings → Accounts: add your Apple ID.
3. Select the CountToTheSky target → Signing & Capabilities: tick
   "Automatically manage signing" and pick your team. If Xcode says the
   bundle identifier is taken, change `com.ehudt.CountToTheSky` to something
   unique.
4. Plug the iPhone in with a cable, unlock it and tap "Trust This Computer".
   On the iPhone enable Settings → Privacy & Security → Developer Mode (it
   restarts the phone). The option appears only after the phone has been
   connected to Xcode once.
5. Pick the iPhone in the device menu at the top of Xcode and press Run (⌘R).
   The first build takes a minute.
6. With a free Apple ID (not a paid developer account), trust the app once:
   Settings → General → VPN & Device Management → your Apple ID → Trust.
   Free-account builds expire after 7 days; run again from Xcode to renew.
7. On first play, allow the microphone and speech recognition.

## Layout

- `CountingCore/` — Swift package with the pure logic, ported line by line
  from the web: `HebrewNumbers.swift` (`hebrewNumbers.ts`), `CountJudge.swift`
  (`CountJudge.ts`), `SkyColors.swift` and `Decorations.swift` (`scenery.ts`).
  Fix a bug on one side, port it to the other. `Milestones.swift` (the friend
  met every ten numbers) is generated from `MILESTONES` in `scenery.ts`. Tests: `swift test` in that folder, or
  Product → Test in Xcode.
- `CountToTheSky/` — the app (an Xcode 16 synchronized folder: new files are
  picked up without editing the project).
  - `Game/CountingGameModel.swift` — phases, the patience clock, best score
    (`counting.best` / `counting.patience` in UserDefaults, as on the web).
  - `Services/` — `AnalyzerSpeechService` (`SpeechAnalyzer`, iOS 26+),
    `AppleSpeechService` (`SFSpeechRecognizer`, he-IL, restarted session
    after session), a `ScriptedSpeechService` for typed transcripts,
    synthesized sounds (no spoken voice lines).
  - `UI/` — the sky, cards, confetti and styles. Fonts: Varela Round (Hebrew)
    and Fredoka (digits), both OFL, bundled in `Fonts/`.
  - `Assets.xcassets/Art/` — the web's drawings (rocket, clouds, Saturn…) as
    vector SVGs, generated from `src/games/counting/skyArt.ts` by
    `node --experimental-strip-types scripts/export-ios-art.ts`. Rerun it after
    changing a drawing or the milestone table. The scenery is placed by `decorations(at:)` in
    CountingCore, the same seeded rules as the web.

## Launch arguments

Enable them in the scheme (Product → Scheme → Edit Scheme → Arguments):

- `-debug` — transcript log at the bottom, with "copy log". The 🐞 button in
  the top bar turns the same log on and off without Xcode.
- `-scriptedSpeech` — no microphone; type transcripts into the debug box (use
  with `-debug`).
- `-legacySpeech` — on iOS 26+, use the older `SFSpeechRecognizer` instead of
  `SpeechAnalyzer` (the default there; it falls back to the older one by
  itself when it has no Hebrew model, and `LISTEN …` says which is used).
- `-dictation` — with `SpeechAnalyzer`, use `DictationTranscriber` rather
  than `SpeechTranscriber`.
- `-serverSpeech` — with the older recognizer, recognize on Apple's servers even when the device can do
  it on its own (on-device is the default: it answers faster). The debug log
  shows which one is used (`LISTEN on-device`), and after each counted number
  roughly how long it took from the start of the voice (`… 420ms`).
