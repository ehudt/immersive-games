import SwiftUI

/// "סופרים עד השמיים" for iPhone and iPad. Launch arguments (Xcode scheme →
/// Arguments): `-debug` shows the transcript log, `-scriptedSpeech` swaps the
/// microphone for a box to type transcripts into.
@main
struct CountToTheSkyApp: App {
    @State private var model: CountingGameModel
    private let debug: Bool

    init() {
        Fonts.register()
        let args = ProcessInfo.processInfo.arguments
        debug = args.contains("-debug")
        _model = State(initialValue: CountingGameModel(speech: args.contains("-scriptedSpeech") ? .scripted : .apple))
    }

    var body: some Scene {
        WindowGroup {
            GameView(model: model, debug: debug)
                .persistentSystemOverlays(.hidden)
                .statusBarHidden()
        }
    }
}
