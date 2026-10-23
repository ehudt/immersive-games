import AVFoundation
import Speech

enum SpeechErrorKind {
    case notAllowed, noMicrophone, network, language, other
}

enum SpeechEvent {
    /// One recognition result: alternative transcripts (best first), and the
    /// best one's confidence (0...1; 0 when the recognizer doesn't say).
    case result([String], final: Bool, confidence: Double)
    /// Recognition is (re)listening — a new session — or stopped between sessions.
    case listening(Bool)
    /// A problem restarting will not fix; listening has stopped.
    case error(SpeechErrorKind, String)
}

/// Continuous speech recognition, restarted session after session for as long
/// as `start()` is in effect (the web game's `SpeechListener`).
@MainActor
protocol SpeechService: AnyObject {
    var onEvent: ((SpeechEvent) -> Void)? { get set }
    /// When the voice heard now started (debug: how long the recognizer took).
    var voiceOnset: Date? { get }
    /// How speech is being recognized, for the debug log.
    var detail: String { get }
    func start()
    func stop()
}

/// Shares the audio buffers from the input tap (audio thread) with whatever
/// consumes them (main thread sets it), and notes when a voice starts after a
/// pause, so the debug log can show the recognizer's delay.
final class MicBox: @unchecked Sendable {
    private let lock = NSLock()
    private var sink: ((AVAudioPCMBuffer) -> Void)?
    private var onset: Date?
    private var lastLoud = Date.distantPast
    private var voiced = false

    /// Louder than this (RMS, 0...1) is a voice; quieter for `gap` is a pause.
    private static let threshold: Float = 0.015
    private static let gap = 0.15

    var voiceOnset: Date? {
        lock.lock()
        defer { lock.unlock() }
        return onset
    }

    func set(_ s: ((AVAudioPCMBuffer) -> Void)?) {
        lock.lock()
        sink = s
        lock.unlock()
    }

    func append(_ buffer: AVAudioPCMBuffer) {
        let loud = Self.level(buffer) > Self.threshold
        let now = Date()
        lock.lock()
        sink?(buffer)
        if loud {
            if !voiced { onset = now }
            voiced = true
            lastLoud = now
        } else if voiced && now.timeIntervalSince(lastLoud) > Self.gap {
            voiced = false
        }
        lock.unlock()
    }

    /// Feeds the box from the microphone: our own sounds are cancelled from
    /// it, so a "bloop" is not heard as speech.
    func tap(_ engine: AVAudioEngine) throws {
        try AudioSession.configure()
        let input = engine.inputNode
        try? input.setVoiceProcessingEnabled(true)
        // Small buffers reach the recognizer sooner (iOS may round this up).
        input.installTap(onBus: 0, bufferSize: 512, format: input.outputFormat(forBus: 0)) { @Sendable [self] buffer, _ in
            append(buffer)
        }
        engine.prepare()
        try engine.start()
    }

    private static func level(_ buffer: AVAudioPCMBuffer) -> Float {
        guard let data = buffer.floatChannelData, buffer.frameLength > 0 else { return 0 }
        let n = Int(buffer.frameLength)
        var sum: Float = 0
        for i in 0..<n { sum += data[0][i] * data[0][i] }
        return (sum / Float(n)).squareRoot()
    }
}

/**
 * Apple's `Speech` framework in Hebrew, fed by `AVAudioEngine`. Safari on iOS
 * uses the same recognizer, so the transcripts look like the iPhone logs the
 * parser was tuned on: cumulative within a session, digits glued together.
 *
 * A recognition request ends after about a minute or after an error; this
 * starts a new one right away, backing off when sessions keep dying at once.
 *
 * Recognition runs on the device when it can: no round trip to Apple's
 * servers, so each number shows up sooner. `-serverSpeech` turns that off.
 */
@MainActor
final class AppleSpeechService: SpeechService {
    var onEvent: ((SpeechEvent) -> Void)?

    static var supported: Bool { SFSpeechRecognizer(locale: locale) != nil }
    private static let locale = Locale(identifier: "he-IL")

    private let recognizer = SFSpeechRecognizer(locale: AppleSpeechService.locale)
    private let engine = AVAudioEngine()
    private let box = MicBox()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var active = false
    private var startedAt = Date.distantPast
    private var quickEnds = 0
    private var restart: Task<Void, Never>?
    /// Set by `-serverSpeech`, or once on-device sessions keep dying at once.
    private var preferServer = ProcessInfo.processInfo.arguments.contains("-serverSpeech")

    var voiceOnset: Date? { box.voiceOnset }
    private var onDevice: Bool { !preferServer && recognizer?.supportsOnDeviceRecognition == true }
    var detail: String { onDevice ? "on-device" : "server" }

    /// Call from a user action: the first time, iOS asks for permission.
    func start() {
        active = true
        quickEnds = 0
        Task { await begin() }
    }

    func stop() {
        active = false
        restart?.cancel()
        endSession()
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        onEvent?(.listening(false))
    }

    private func begin() async {
        let speechOK = await withCheckedContinuation { c in
            SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) }
        }
        let micOK = await AVAudioApplication.requestRecordPermission()
        guard active else { return }
        guard speechOK && micOK else { return fail(.notAllowed, "permission denied") }
        guard let recognizer else { return fail(.language, "no he-IL recognizer") }
        guard recognizer.isAvailable else { return fail(.network, "recognizer unavailable") }
        do {
            try box.tap(engine)
        } catch {
            return fail(.noMicrophone, error.localizedDescription)
        }
        session()
    }

    private func session() {
        guard active, let recognizer else { return }
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.taskHint = .dictation
        req.addsPunctuation = false
        req.requiresOnDeviceRecognition = onDevice
        request = req
        box.set { req.append($0) }
        startedAt = Date()
        onEvent?(.listening(true))
        task = recognizer.recognitionTask(with: req) { @Sendable [weak self] result, error in
            // Read the result here, on the recognizer's queue, and hand plain values over.
            let alts = result?.transcriptions.prefix(3).map(\.formattedString) ?? []
            let segments = result?.bestTranscription.segments ?? []
            let confidence = segments.isEmpty ? 0 : Double(segments.map(\.confidence).reduce(0, +)) / Double(segments.count)
            let isFinal = result?.isFinal ?? false
            let failed = error != nil
            Task { @MainActor in
                guard let self, self.request === req else { return }
                if !alts.isEmpty { self.onEvent?(.result(alts, final: isFinal, confidence: confidence)) }
                if isFinal || failed { self.sessionEnded() }
            }
        }
    }

    private func endSession() {
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil
        box.set(nil)
    }

    private func sessionEnded() {
        endSession()
        onEvent?(.listening(false))
        guard active else { return }
        // Sessions that die right away usually mean a lasting problem; back off.
        quickEnds = Date().timeIntervalSince(startedAt) < 1 ? quickEnds + 1 : 0
        if quickEnds >= 3 && onDevice {
            preferServer = true
            quickEnds = 0
        }
        if quickEnds > 8 { return fail(.other, "Speech recognition keeps stopping") }
        let delay = min(1000, 60 * quickEnds)
        restart = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(delay))
            guard !Task.isCancelled else { return }
            self?.session()
        }
    }

    private func fail(_ kind: SpeechErrorKind, _ detail: String) {
        stop()
        onEvent?(.error(kind, detail))
    }
}

/// Replays typed transcripts: for previews, the simulator and the debug box.
@MainActor
final class ScriptedSpeechService: SpeechService {
    var onEvent: ((SpeechEvent) -> Void)?
    var voiceOnset: Date? { nil }
    var detail: String { "scripted" }

    func start() { onEvent?(.listening(true)) }
    func stop() { onEvent?(.listening(false)) }

    func say(_ text: String, isFinal: Bool = true) {
        onEvent?(.result([text], final: isFinal, confidence: 0))
    }
}

enum AudioSession {
    /// Play and record at once: the game listens while it plays sounds.
    static func configure() throws {
        let s = AVAudioSession.sharedInstance()
        try s.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP])
        // 5 ms audio buffers instead of ~20: the mic and the sounds lag less.
        try? s.setPreferredIOBufferDuration(0.005)
        try s.setActive(true)
    }
}
