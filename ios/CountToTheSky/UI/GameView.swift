import CountingCore
import SwiftUI

/// One scene: the sky always behind, the playing HUD or a card over it.
struct GameView: View {
    @Bindable var model: CountingGameModel
    var debug = false

    @State private var confetti = Confetti()
    @State private var praise: (n: Int, text: String)?
    @State private var praiseID = 0

    private var playing: Bool { model.phase == .playing }
    private var celebrating: Bool {
        if case let .over(r) = model.phase { return r.count > 0 }
        return false
    }

    var body: some View {
        GeometryReader { geo in
            let layout = SkyLayout(size: geo.size)
            ZStack(alignment: .top) {
                SkyView(count: model.count, fuel: model.fuel, flying: playing, celebrating: celebrating)

                if playing && model.count > 0 {
                    BigNumber(n: model.count, size: layout.clamp(88, 26, 230))
                        .padding(.top, max(64, geo.size.height * 0.07))
                }

                if let praise {
                    PraiseBanner(n: praise.n, text: praise.text, size: layout.clamp(36, 10, 80))
                        .id(praiseID)
                        .padding(.top, geo.size.height * 0.4)
                }

                ConfettiView(confetti: confetti)

                VStack(spacing: 0) {
                    TopBar(model: model)
                    Spacer()
                    if playing { ListenIndicator(model: model).padding(.bottom, 16) }
                }

                panel
                    .padding(.top, max(70, geo.size.height * 0.08))
                    .frame(maxHeight: .infinity, alignment: .top)
            }
            .onChange(of: playing) { _, on in if on { confetti.clear() } }
            .onChange(of: model.lastEffect) { _, effect in
                if let effect { react(to: effect.event, layout: layout) }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .environment(\.locale, Locale(identifier: "he"))
        .sensoryFeedback(.impact(weight: .light, intensity: 0.8), trigger: model.count) { old, new in new > old }
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

    private func react(to event: CountingGameModel.Event, layout: SkyLayout) {
        switch event {
        case .counted:
            let p = layout.rocketPoint
            confetti.sparkle(x: p.x, y: p.y + 60)
        case let .milestone(n, text):
            confetti.burst(n % 50 == 0 ? 120 : 60)
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            praiseID += 1
            praise = (n, text)
            let id = praiseID
            Task {
                try? await Task.sleep(for: .seconds(2.2))
                if praiseID == id { praise = nil }
            }
        case let .finished(record):
            praise = nil
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            confetti.burst(110)
            confetti.fireworks(record ? 7 : 4)
            Task {
                try? await Task.sleep(for: .seconds(0.6))
                confetti.rain(4)
            }
        }
    }
}

/// The number just counted, popping in big (`.c-number.pop`).
private struct BigNumber: View {
    var n: Int
    var size: CGFloat

    var body: some View {
        Text(String(n))
            .font(.digits(size))
            .foregroundStyle(.white)
            .shadow(color: Palette.count(n), radius: 0, y: size * 0.05)
            .shadow(color: .black.opacity(0.12), radius: 0, y: size * 0.09)
            .shadow(color: .black.opacity(0.18), radius: size * 0.15, y: size * 0.12)
            .keyframeAnimator(initialValue: Pop(), trigger: n) { content, v in
                content.scaleEffect(v.scale).rotationEffect(.degrees(v.angle))
            } keyframes: { _ in
                KeyframeTrack(\.scale) {
                    MoveKeyframe(1.45)
                    SpringKeyframe(1, duration: 0.45, spring: .bouncy)
                }
                KeyframeTrack(\.angle) {
                    MoveKeyframe(-6)
                    SpringKeyframe(0, duration: 0.45, spring: .bouncy)
                }
            }
            .allowsHitTesting(false)
            .accessibilityLabel(Text(String(n)))
    }

    struct Pop {
        var scale = 1.0
        var angle = 0.0
    }
}

/// "30! כל הכבוד!" every ten numbers (`.c-praise`).
private struct PraiseBanner: View {
    var n: Int
    var text: String
    var size: CGFloat

    var body: some View {
        VStack(spacing: 0) {
            Text("\(n)!")
                .font(.digits(size))
                .foregroundStyle(Palette.sun)
                .shadow(color: .white, radius: 0, x: 1.5, y: 1.5)
                .shadow(color: .white, radius: 0, x: -1.5, y: -1.5)
                .shadow(color: .white, radius: 0, x: 1.5, y: -1.5)
                .shadow(color: .white, radius: 0, x: -1.5, y: 1.5)
            Text(text)
                .font(.game(size * 0.8).bold())
                .foregroundStyle(.white)
                .shadow(color: Palette.pink, radius: 0, y: 4)
                .shadow(color: .black.opacity(0.2), radius: 10, y: 8)
        }
        .allowsHitTesting(false)
        .keyframeAnimator(initialValue: Frame(), trigger: go) { content, v in
            content.opacity(v.opacity).scaleEffect(v.scale).offset(y: v.y)
        } keyframes: { _ in
            KeyframeTrack(\.opacity) {
                LinearKeyframe(1, duration: 0.33)
                LinearKeyframe(1, duration: 1.43)
                LinearKeyframe(0, duration: 0.44)
            }
            KeyframeTrack(\.scale) {
                CubicKeyframe(1.1, duration: 0.33)
                CubicKeyframe(1, duration: 0.22)
            }
            KeyframeTrack(\.y) {
                LinearKeyframe(0, duration: 0.55)
                CubicKeyframe(-10, duration: 1.21)
                CubicKeyframe(-40, duration: 0.44)
            }
        }
        .onAppear { go = true }
    }

    @State private var go = false

    struct Frame {
        var opacity = 0.0
        var scale = 0.3
        var y = 0.0
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

/// "מקשיבים…" with the mic and sound bars (`.c-listen`).
private struct ListenIndicator: View {
    var model: CountingGameModel

    var body: some View {
        HStack(spacing: 10) {
            Text("🎤")
                .font(.system(size: 24))
                .grayscale(model.listening ? 0 : 1)
                .opacity(model.listening ? 1 : 0.6)
                .phaseAnimator([false, true]) { v, big in
                    v.scaleEffect(model.listening && big ? 1.12 : 1)
                } animation: { _ in .easeInOut(duration: 1.4) }
            TimelineView(.animation(paused: !model.hearing)) { tl in
                let t = tl.date.timeIntervalSinceReferenceDate
                HStack(spacing: 3) {
                    ForEach(0..<4) { i in
                        let wave = (1 - cos(2 * .pi * (t - Double(i) * 0.1) / 0.8)) / 2
                        Capsule()
                            .fill(Palette.teal)
                            .frame(width: 5, height: model.hearing ? 6 + 16 * wave : 6)
                    }
                }
                .frame(height: 22)
            }
            Text(model.listenText).font(.game(19).bold())
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(Capsule().fill(.white.opacity(0.9)).shadow(color: .black.opacity(0.12), radius: 8, y: 4))
        .foregroundStyle(Palette.plum)
        .environment(\.layoutDirection, .rightToLeft)
    }
}

private struct IntroCard: View {
    @Bindable var model: CountingGameModel

    var body: some View {
        Card {
            Text("סופרים עד השמיים").font(.game(44).bold()).foregroundStyle(Palette.pink)
            (Text("סופרים בקול רם, עד המספר הכי גבוה שאפשר:\n") + Text("אחת, שתיים, שלוש…").bold().foregroundColor(Palette.pink))
                .font(.game(22))
            Text("כל מספר נכון מקפיץ את הרקטה למעלה 🚀\nטעינו או נתקענו? המשחק נגמר ואפשר לנסות שוב.")
                .font(.game(17))
                .foregroundStyle(Palette.sub)
            if !model.speechSupported {
                Text("המכשיר הזה לא תומך בזיהוי דיבור בעברית.")
                    .font(.game(17))
                    .foregroundStyle(Color(hex: 0x8A4B00))
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color(hex: 0xFFF1D6)))
            }
            VStack(spacing: 6) {
                Text("⏱️ זמן לחשוב:").font(.game(16)).foregroundStyle(Palette.sub)
                HStack(spacing: 6) {
                    ForEach(Strings.patience, id: \.0) { item in
                        let p = item.0, label = item.1
                        let on = model.patience == p
                        Button(label) { model.patience = p }
                            .font(.game(16).weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 6)
                            .foregroundStyle(on ? .white : Palette.plum)
                            .background(Capsule().fill(on ? Palette.teal : Palette.secondary))
                            .background(Capsule().fill(on ? Color(hex: 0x1D8F9C) : Palette.secondaryShadow).offset(y: 3))
                            .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
            }
            .padding(.top, 4)
            Button("יוצאים לדרך!") { model.play() }
                .buttonStyle(CandyButtonStyle())
                .disabled(!model.speechSupported)
                .opacity(model.speechSupported ? 1 : 0.45)
                .padding(.top, 8)
            Text("המשחק משתמש במיקרופון. זיהוי הדיבור נעשה על ידי שירות זיהוי הדיבור של Apple.")
                .font(.game(13))
                .foregroundStyle(Color(hex: 0x8A86A8))
        }
    }
}

private struct ResultCard: View {
    var model: CountingGameModel
    var result: CountingGameModel.Result
    @State private var shown = false

    var body: some View {
        Card {
            Text("🏆")
                .font(.system(size: 80))
                .phaseAnimator([false, true]) { v, on in
                    v.rotationEffect(.degrees(on ? 8 : -8)).scaleEffect(on ? 1.1 : 1)
                } animation: { _ in .easeInOut(duration: 1.2) }
            Text(Strings.cheer(result.count)).font(.game(34).bold())
            Text("ספרת עד").font(.game(21)).foregroundStyle(Palette.sub)
            Text(String(result.count))
                .font(.digits(110))
                .foregroundStyle(Palette.sun)
                .shadow(color: Palette.plum, radius: 0, x: 2.5, y: 2.5)
                .shadow(color: Palette.plum, radius: 0, x: -2.5, y: -2.5)
                .shadow(color: Palette.plum, radius: 0, x: 2.5, y: -2.5)
                .shadow(color: Palette.plum, radius: 0, x: -2.5, y: 2.5)
                .shadow(color: Palette.plum.opacity(0.15), radius: 0, y: 8)
                .scaleEffect(shown ? 1 : 0.3)
                .opacity(shown ? 1 : 0)
                .onAppear { withAnimation(.bouncy(duration: 0.7, extraBounce: 0.25).delay(0.2)) { shown = true } }
            if result.record && result.count > 1 {
                Text("⭐ שיא חדש! ⭐")
                    .font(.game(24).bold())
                    .foregroundStyle(Palette.pink)
                    .phaseAnimator([false, true]) { v, on in v.scaleEffect(on ? 1.1 : 1) } animation: { _ in .easeInOut(duration: 0.8) }
            } else {
                Text("השיא: \(model.best)").font(.game(18)).foregroundStyle(Palette.sub)
            }
            Text("💡 אחרי \(result.count) בא \(result.count + 1)")
                .font(.game(17))
                .foregroundStyle(Color(hex: 0x1D7F8C))
                .padding(.horizontal, 14)
                .padding(.vertical, 5)
                .background(Capsule().fill(Color(hex: 0xEAF9FB)))
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
