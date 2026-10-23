import CountingCore
import Foundation
import Observation

enum SpeechChoice {
    case apple, scripted
}

/**
 * "סופרים עד השמיים" (src/games/counting/CountingGame.ts): the child counts
 * out loud in Hebrew, and every correct number lifts a rocket higher. The game
 * never prompts the next number; it ends when a number is skipped or the child
 * stops for a while, with a celebration of how far they got.
 *
 * Owns the rules and the patience clock; views only render its state and
 * react to `lastEffect`.
 */
@MainActor
@Observable
final class CountingGameModel {
    struct Result: Equatable {
        var count: Int
        /// The number said out of order, or nil when time ran out.
        var wrong: Int?
        var record: Bool
    }

    enum Phase: Equatable {
        case intro, playing, over(Result), failed(SpeechErrorKind)
    }

    /// One-shot effects for the views: a new number, every ten, the end.
    enum Event: Equatable {
        case counted(Int), milestone(Int, praise: String), finished(record: Bool)
    }

    private(set) var phase: Phase = .intro
    private(set) var count = 0
    private(set) var listening = false
    /// Speech came in just now: the mic indicator bounces.
    private(set) var hearing = false
    /// 0...1: the rocket's flame shrinks as the time for the next number runs out.
    private(set) var fuel = 1.0
    /// The latest effect, with a serial so the same one twice still changes.
    struct Effect: Equatable {
        var id: Int
        var event: Event
    }
    private(set) var lastEffect: Effect?
    private(set) var log: [String] = []

    var patience: Patience {
        didSet { defaults.set(patience.rawValue, forKey: Self.patienceKey) }
    }
    private(set) var best: Int
    var muted = false {
        didSet {
            sfx.muted = muted
            if muted { narrator.stop() }
        }
    }

    let speechSupported: Bool
    /// Fed by the debug transcript box when speech is scripted.
    let scripted: ScriptedSpeechService?

    private let speech: SpeechService
    private let sfx = SoundService()
    private let narrator = Narrator()
    private let defaults: UserDefaults
    private var judge = CountJudge()
    /// When the clock for the next number started (nil until the mic is on).
    private var waitingSince: Date?
    private var lastSpeech = Date.distantPast
    private var lastTick = Date()
    private var ticker: Task<Void, Never>?
    private var pending: [Task<Void, Never>] = []
    private var eventSerial = 0

    /// While words are still coming in, wait up to this much past the patience limit.
    private static let speakingGrace = 6.0
    /// Speech heard this recently means the child is still talking.
    private static let speakingWindow = 1.5
    /// The same keys as the web's localStorage.
    private static let bestKey = "counting.best"
    private static let patienceKey = "counting.patience"

    init(speech choice: SpeechChoice = .apple, defaults: UserDefaults = .standard) {
        self.defaults = defaults
        best = defaults.integer(forKey: Self.bestKey)
        patience = defaults.string(forKey: Self.patienceKey).flatMap(Patience.init(rawValue:)) ?? .long
        switch choice {
        case .apple:
            speech = AppleSpeechService()
            scripted = nil
            speechSupported = AppleSpeechService.supported
        case .scripted:
            let s = ScriptedSpeechService()
            speech = s
            scripted = s
            speechSupported = true
        }
        speech.onEvent = { [weak self] event in self?.onSpeechEvent(event) }
    }

    // ----------------------------------------------------------- screens

    func play() {
        narrator.stop()
        cancelPending()
        judge = CountJudge()
        count = 0
        phase = .playing
        waitingSince = nil
        fuel = 1
        setListening(false)
        speech.start()
        ticker?.cancel()
        lastTick = Date()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(100))
                self?.tick()
            }
        }
    }

    func exitToIntro() {
        stopPlaying()
        narrator.stop()
        cancelPending()
        // Back to the launch pad.
        count = 0
        phase = .intro
    }

    private func end(wrong: Int?) {
        guard phase == .playing else { return }
        stopPlaying()
        let n = judge.count
        debugLog("END count=\(n) \(wrong.map { "wrong=\($0)" } ?? "timeout")")
        if n == 0 {
            sfx.nothing()
            phase = .over(Result(count: 0, wrong: wrong, record: false))
            return
        }
        let record = n > best
        if record {
            best = n
            defaults.set(n, forKey: Self.bestKey)
        }
        sfx.victory()
        emit(.finished(record: record))
        phase = .over(Result(count: n, wrong: wrong, record: record))
        later(1.7) { [weak self] in
            guard let self, !self.muted, case .over = self.phase else { return }
            self.narrator.say("כל הכבוד! ספרת עד \(n)!")
        }
    }

    private func stopPlaying() {
        ticker?.cancel()
        ticker = nil
        speech.stop()
        hearing = false
    }

    // ------------------------------------------------------------- play

    private func onSpeechEvent(_ event: SpeechEvent) {
        switch event {
        case let .result(alts, isFinal, confidence):
            onSpeech(alts, isFinal: isFinal, confidence: confidence)
        case let .listening(on):
            if on {
                judge.newSession()
                debugLog("LISTEN \(speech.detail)")
            }
            setListening(on)
        case let .error(kind, detail):
            debugLog("ERROR \(kind) \(detail)")
            guard phase == .playing else { return }
            if judge.count > 0 { return end(wrong: nil) }
            stopPlaying()
            phase = .failed(kind)
        }
    }

    private func onSpeech(_ alts: [String], isFinal: Bool, confidence: Double) {
        guard phase == .playing else { return }
        lastSpeech = Date()
        hearing = true
        let heard = judge.hear(alts, final: isFinal, confidence: confidence)
        let kind = isFinal ? "FINAL " + String(format: "%.2f", confidence) : "interim"
        let texts = alts.map { "\"\($0)\"" }.joined(separator: " | ")
        let wrong = heard.wrong.map { " wrong \($0)" } ?? ""
        // From when the voice started to now: roughly how long recognition took.
        let lag = heard.counted.isEmpty ? "" : speech.voiceOnset.map { " \(Int(Date().timeIntervalSince($0) * 1000))ms" } ?? ""
        debugLog("\(kind) \(texts) → +\(heard.counted)\(wrong)\(lag)")
        for (i, n) in heard.counted.enumerated() {
            if i == 0 { onCount(n) } else { later(Double(i) * 0.14) { [weak self] in self?.onCount(n) } }
        }
        if !heard.counted.isEmpty { waitingSince = Date() }
        if let wrong = heard.wrong {
            later(Double(heard.counted.count) * 0.14 + 0.25) { [weak self] in self?.end(wrong: wrong) }
        }
    }

    private func onCount(_ n: Int) {
        guard phase == .playing else { return }
        count = n
        sfx.count(n)
        emit(.counted(n))
        if n % 10 == 0 {
            sfx.milestone()
            emit(.milestone(n, praise: Strings.praise.randomElement()!))
        }
    }

    /**
     * The patience clock: no new number for too long means the child is stuck.
     * It stops while the recognizer restarts between sessions (not the child's
     * fault), and gives extra time while the child is still talking.
     */
    private func tick() {
        let now = Date()
        let dt = now.timeIntervalSince(lastTick)
        lastTick = now
        guard phase == .playing, var since = waitingSince else { return }
        if !listening {
            since += dt
            waitingSince = since
        }
        let limit = Double(patienceMs(judge.count, patience)) / 1000
        let waited = now.timeIntervalSince(since)
        let speaking = now.timeIntervalSince(lastSpeech) < Self.speakingWindow
        if !speaking { hearing = false }
        fuel = max(0, min(1, 1 - waited / limit))
        if waited > limit && !(speaking && waited < limit + Self.speakingGrace) { end(wrong: nil) }
    }

    private func setListening(_ on: Bool) {
        listening = on
        // The clock starts once the mic really listens (after the permission prompt).
        if on && phase == .playing && waitingSince == nil { waitingSince = Date() }
    }

    /// The listen indicator's text. Between sessions (a moment) it keeps the text.
    var listenText: String {
        guard listening || waitingSince != nil else { return "מדליקים את המיקרופון…" }
        return count == 0 ? "מקשיבים… אפשר להתחיל לספור!" : "מקשיבים…"
    }

    // ------------------------------------------------------------ helpers

    private func emit(_ e: Event) {
        eventSerial += 1
        lastEffect = Effect(id: eventSerial, event: e)
    }

    private func later(_ seconds: Double, _ fn: @escaping @MainActor () -> Void) {
        pending.append(Task {
            try? await Task.sleep(for: .seconds(seconds))
            if !Task.isCancelled { fn() }
        })
    }

    private func cancelPending() {
        pending.forEach { $0.cancel() }
        pending = []
    }

    private func debugLog(_ line: String) {
        log.append(line)
        if log.count > 400 { log.removeFirst(log.count - 400) }
    }
}
