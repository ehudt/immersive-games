# סופרים עד השמיים — iOS

A native SwiftUI port of the counting game (`src/games/counting/`), for iPhone
(portrait) and iPad (any orientation), iOS 17+. Hebrew only, right-to-left.

Open `CountToTheSky.xcodeproj` in Xcode 16 or later, pick a team under
Signing & Capabilities, and run. Speech recognition needs a real device or a
simulator with a working microphone.

## Layout

- `CountingCore/` — Swift package with the pure logic, ported line by line
  from the web: `HebrewNumbers.swift` (`hebrewNumbers.ts`), `CountJudge.swift`
  (`CountJudge.ts`), `SkyColors.swift` (`skyColors` in `Sky.ts`). Fix a bug on
  one side, port it to the other. Tests: `swift test` in that folder, or
  Product → Test in Xcode.
- `CountToTheSky/` — the app (an Xcode 16 synchronized folder: new files are
  picked up without editing the project).
  - `Game/CountingGameModel.swift` — phases, the patience clock, best score
    (`counting.best` / `counting.patience` in UserDefaults, as on the web).
  - `Services/` — `AppleSpeechService` (`SFSpeechRecognizer`, he-IL, restarted
    session after session), a `ScriptedSpeechService` for typed transcripts,
    synthesized sounds and the Hebrew narrator.
  - `UI/` — the sky, cards, confetti and styles. Fonts: Varela Round (Hebrew)
    and Fredoka (digits), both OFL, bundled in `Fonts/`.
  - `Assets.xcassets/Art/` — the web's drawings (rocket, clouds, Saturn…) as
    vector SVGs, generated from `src/games/counting/Sky.ts` by
    `node --experimental-strip-types scripts/export-ios-art.ts`. Rerun it after
    changing a drawing. The scenery is placed by `decorations(at:)` in
    CountingCore, the same seeded rules as the web.

## Launch arguments

Enable them in the scheme (Product → Scheme → Edit Scheme → Arguments):

- `-debug` — transcript log at the bottom, with "copy log".
- `-scriptedSpeech` — no microphone; type transcripts into the debug box (use
  with `-debug`).
