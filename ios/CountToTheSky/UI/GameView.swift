import CountingCore
import SwiftUI

/// One scene: the sky always behind, the playing HUD or a card over it.
struct GameView: View {
    @Bindable var model: CountingGameModel
    var debug = false

    @State private var confetti = Confetti()
    @State private var pop = false
    @State private var praise: (n: Int, text: String)?
    @State private var praiseID = 0

    private var playing: Bool { model.phase == .playing }
    private var celebrating: Bool {
        if case let .over(r) = model.phase { return r.count > 0 }
        return false
    }

    var body: some View {
        ZStack {
            SkyView(count: model.count, fuel: model.fuel, flying: playing, celebrating: celebrating)
            ConfettiView(confetti: confetti)

            VStack(spacing: 0) {
                TopBar(model: model)
                if playing && model.count > 0 {
                    Text(String(model.count))
                        .font(.digits(140))
                        .minimumScaleFactor(0.5)
                        .foregroundStyle(.white)
                        .shadow(color: Palette.count(model.count), radius: 0, y: 6)
                        .shadow(color: .black.opacity(0.18), radius: 12, y: 10)
                        .scaleEffect(pop ? 1.45 : 1)
                        .rotationEffect(.degrees(pop ? -6 : 0))
                        .accessibilityLabel(Text(String(model.count)))
                }
                Spacer()
                if playing { ListenIndicator(model: model).padding(.bottom, 24) }
            }

            if let praise {
                VStack(spacing: 4) {
                    Text("\(praise.n)!").font(.digits(64))
                    Text(praise.text).font(.game(40).bold())
                }
                .foregroundStyle(.white)
                .shadow(color: Palette.pink, radius: 0, y: 4)
                .id(praiseID)
                .transition(.scale(scale: 0.4).combined(with: .opacity))
            }

            panel
        }
        .environment(\.layoutDirection, .rightToLeft)
        .environment(\.locale, Locale(identifier: "he"))
        .onChange(of: model.lastEffect) { _, effect in
            if let effect { react(to: effect.event) }
        }
        .overlay(alignment: .bottom) {
            if debug { DebugPanel(model: model) }
        }
    }

    @ViewBuilder private var panel: some View {
        switch model.phase {
        case .intro:
            IntroCard(model: model).transition(.move(edge: .bottom).combined(with: .opacity))
        case .playing:
            EmptyView()
        case let .over(result):
            if result.count == 0 { NothingCard(model: model) } else { ResultCard(model: model, result: result) }
        case let .failed(kind):
            ErrorCard(model: model, kind: kind)
        }
    }

    private func react(to event: CountingGameModel.Event) {
        switch event {
        case .counted:
            pop = true
            withAnimation(.spring(response: 0.45, dampingFraction: 0.45)) { pop = false }
            confetti.burst(6, y: 0.7)
        case let .milestone(n, text):
            confetti.burst(n % 50 == 0 ? 120 : 60)
            praiseID += 1
            withAnimation(.spring(duration: 0.5)) { praise = (n, text) }
            let id = praiseID
            Task {
                try? await Task.sleep(for: .seconds(1.6))
                if praiseID == id { withAnimation { praise = nil } }
            }
        case .finished:
            withAnimation { praise = nil }
            confetti.burst(110)
            Task {
                try? await Task.sleep(for: .seconds(0.6))
                confetti.burst(80, y: 0.2)
            }
        }
    }
}

private struct TopBar: View {
    @Bindable var model: CountingGameModel

    var body: some View {
        HStack(spacing: 10) {
            if model.phase != .intro {
                IconButton(symbol: "xmark", label: "חזרה לתפריט") { model.exitToIntro() }
            }
            IconButton(symbol: model.muted ? "speaker.slash.fill" : "speaker.wave.2.fill", label: "השתקה") { model.muted.toggle() }
            Spacer()
            if model.best > 0 {
                Text("🏅 השיא: \(model.best)")
                    .font(.game(20).bold())
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(.white.opacity(0.85)))
                    .foregroundStyle(Palette.plum)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

private struct IconButton: View {
    var symbol: String
    var label: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .bold))
                .frame(width: 48, height: 48)
                .background(Circle().fill(.white.opacity(0.85)))
                .foregroundStyle(Palette.plum)
        }
        .accessibilityLabel(Text(label))
    }
}

private struct ListenIndicator: View {
    var model: CountingGameModel

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "mic.fill")
                .foregroundStyle(model.listening ? Palette.pink : .gray)
                .symbolEffect(.variableColor.iterative, isActive: model.hearing)
            Text(model.listenText).font(.game(20))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(Capsule().fill(.white.opacity(0.9)))
        .foregroundStyle(Palette.plum)
        .scaleEffect(model.hearing ? 1.06 : 1)
        .animation(.easeInOut(duration: 0.25), value: model.hearing)
    }
}

private struct IntroCard: View {
    @Bindable var model: CountingGameModel

    var body: some View {
        Card {
            Text("סופרים עד השמיים").font(.game(38).bold()).foregroundStyle(Palette.pink)
            Text("סופרים בקול רם, עד המספר הכי גבוה שאפשר:\n**אחת, שתיים, שלוש…**").font(.game(22))
            Text("כל מספר נכון מקפיץ את הרקטה למעלה 🚀\nטעינו או נתקענו? המשחק נגמר ואפשר לנסות שוב.").font(.game(17)).opacity(0.8)
            if !model.speechSupported {
                Text("המכשיר הזה לא תומך בזיהוי דיבור בעברית.").font(.game(17)).foregroundStyle(.red)
            }
            HStack(spacing: 8) {
                Text("⏱️ זמן לחשוב:").font(.game(17))
                ForEach(Strings.patience, id: \.0) { item in
                    let p = item.0, label = item.1
                    let on = model.patience == p
                    Button(label) { model.patience = p }
                        .font(.game(17).bold())
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(on ? Palette.teal : Palette.secondary))
                        .foregroundStyle(on ? .white : Palette.plum)
                        .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            Button("יוצאים לדרך!") { model.play() }
                .buttonStyle(CandyButtonStyle())
                .disabled(!model.speechSupported)
                .padding(.top, 6)
            Text("המשחק משתמש במיקרופון. זיהוי הדיבור נעשה על ידי שירות זיהוי הדיבור של Apple.").font(.game(13)).opacity(0.6)
        }
    }
}

private struct ResultCard: View {
    var model: CountingGameModel
    var result: CountingGameModel.Result

    var body: some View {
        Card {
            Text("🏆").font(.system(size: 64))
            Text(Strings.cheer(result.count)).font(.game(34).bold()).foregroundStyle(Palette.pink)
            Text("ספרת עד").font(.game(22))
            Text(String(result.count)).font(.digits(96)).foregroundStyle(Palette.count(result.count))
            if result.record && result.count > 1 {
                Text("⭐ שיא חדש! ⭐").font(.game(24).bold()).foregroundStyle(Palette.sun)
            } else {
                Text("השיא: \(model.best)").font(.game(18)).opacity(0.8)
            }
            Text("💡 אחרי \(result.count) בא \(result.count + 1)").font(.game(18))
            Buttons(model: model, again: "עוד פעם!")
        }
    }
}

private struct NothingCard: View {
    var model: CountingGameModel

    var body: some View {
        Card {
            Text("🙉").font(.system(size: 64))
            Text("לא שמענו מספרים…").font(.game(30).bold())
            Text("מתחילים מ**אחת** וסופרים בקול רם וברור.\nכדאי לשבת קרוב למכשיר.").font(.game(18))
            Buttons(model: model, again: "ננסה שוב!")
        }
    }
}

private struct ErrorCard: View {
    var model: CountingGameModel
    var kind: SpeechErrorKind
    @Environment(\.openURL) private var openURL

    var body: some View {
        Card {
            Text("🎤").font(.system(size: 64))
            Text("אופס…").font(.game(30).bold())
            Text(Strings.error(kind)).font(.game(18))
            if kind == .notAllowed, let url = URL(string: UIApplication.openSettingsURLString) {
                Button("פתיחת ההגדרות") { openURL(url) }.buttonStyle(CandyButtonStyle())
            }
            Buttons(model: model, again: "ננסה שוב")
        }
    }
}

private struct Buttons: View {
    var model: CountingGameModel
    var again: String

    var body: some View {
        HStack(spacing: 14) {
            Button(again) { model.play() }.buttonStyle(CandyButtonStyle())
            Button("לתפריט") { model.exitToIntro() }.buttonStyle(CandyButtonStyle(secondary: true))
        }
        .padding(.top, 6)
    }
}

/// DEBUG: type transcripts as if the recognizer heard them, and read the log.
private struct DebugPanel: View {
    var model: CountingGameModel
    @State private var text = ""
    @State private var isFinal = true

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let scripted = model.scripted {
                HStack {
                    TextField("type a transcript, e.g. אחת שתיים", text: $text)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit {
                            scripted.say(text, isFinal: isFinal)
                            text = ""
                        }
                    Toggle("final", isOn: $isFinal).fixedSize()
                }
            }
            HStack {
                Text("count=\(model.count) listening=\(model.listening) patience=\(model.patience.rawValue)")
                Spacer()
                Button("copy log") { UIPasteboard.general.string = model.log.joined(separator: "\n") }
            }
            Text(model.log.suffix(8).joined(separator: "\n")).lineLimit(8)
        }
        .font(.system(size: 11, design: .monospaced))
        .padding(10)
        .background(.black.opacity(0.7))
        .foregroundStyle(.white)
        .environment(\.layoutDirection, .leftToRight)
    }
}
