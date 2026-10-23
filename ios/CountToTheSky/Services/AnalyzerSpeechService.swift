import AVFoundation
import Speech

/**
 * Apple's newer `SpeechAnalyzer` (iOS 26) in Hebrew: built for live audio,
 * with volatile (in-progress) results that arrive sooner than the old
 * recognizer's partials. Uses `SpeechTranscriber` when it knows Hebrew, else
 * `DictationTranscriber`, and falls back to `AppleSpeechService` when neither
 * does or their model can't be installed (`detail` says why).
 *
 * Results are sent like the old recognizer's, cumulative since the last
 * finalized one: each finalized result starts the text over, so it stays
 * short. That is not a new session for the judge — echoes of numbers already
 * counted are ignored anyway.
 */
@available(iOS 26, *)
@MainActor
final class AnalyzerSpeechService: SpeechService {
    var onEvent: ((SpeechEvent) -> Void)?

    private static let locale = Locale(identifier: "he-IL")

    private let engine = AVAudioEngine()
    private let box = MicBox()
    private var analyzer: SpeechAnalyzer?
    private var input: AsyncStream<AnalyzerInput>.Continuation?
    private var results: Task<Void, Never>?
    private var active = false
    private var module = "analyzer"
    /// Used instead when the analyzer can't do Hebrew here.
    private var fallback: AppleSpeechService?
    private var fallbackReason = ""

    var voiceOnset: Date? { fallback?.voiceOnset ?? box.voiceOnset }
    var detail: String {
        guard let fallback else { return module }
        return "\(fallback.detail) (analyzer: \(fallbackReason))"
    }

    /// Call from a user action: the first time, iOS asks for permission.
    func start() {
        active = true
        if let fallback { return fallback.start() }
        Task { await begin() }
    }

    func stop() {
        active = false
        if let fallback { return fallback.stop() }
        teardown()
        onEvent?(.listening(false))
    }

    private func begin() async {
        let speechOK = await withCheckedContinuation { c in
            SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) }
        }
        let micOK = await AVAudioApplication.requestRecordPermission()
        guard active else { return }
        guard speechOK && micOK else { return fail(.notAllowed, "permission denied") }

        let transcriber: any SpeechModule
        if SpeechTranscriber.isAvailable, let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Self.locale) {
            let t = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults, .fastResults], attributeOptions: [])
            transcriber = t
            module = "analyzer-transcriber"
            listen(to: t.results) { String($0.text.characters) }
        } else if let locale = await DictationTranscriber.supportedLocale(equivalentTo: Self.locale) {
            let t = DictationTranscriber(locale: locale, contentHints: [], transcriptionOptions: [], reportingOptions: [.volatileResults, .frequentFinalization], attributeOptions: [])
            transcriber = t
            module = "analyzer-dictation"
            listen(to: t.results) { String($0.text.characters) }
        } else {
            return fallBack("no he-IL")
        }

        do {
            if let install = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
                try await install.downloadAndInstall()
            }
        } catch {
            return fallBack("model: \(error.localizedDescription)")
        }
        guard active else { teardown(); return }

        let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber])
        let (stream, input) = AsyncStream<AnalyzerInput>.makeStream()
        do {
            // Keeps the model loaded between rounds, so the next one starts sooner.
            let analyzer = SpeechAnalyzer(modules: [transcriber], options: .init(priority: .userInitiated, modelRetention: .processLifetime))
            self.analyzer = analyzer
            self.input = input
            try await analyzer.prepareToAnalyze(in: format)
            try await analyzer.start(inputSequence: stream)
        } catch {
            // Some devices list Hebrew but have no model for it.
            return fallBack(error.localizedDescription)
        }
        guard active else { teardown(); return }
        do {
            try box.tap(engine)
        } catch {
            teardown()
            return fail(.noMicrophone, error.localizedDescription)
        }
        let convert = format.map { Converter(from: engine.inputNode.outputFormat(forBus: 0), to: $0) }
        box.set { buffer in
            guard let b = convert == nil ? buffer : convert!.convert(buffer) else { return }
            input.yield(AnalyzerInput(buffer: b))
        }
        guard active else { teardown(); return }
        onEvent?(.listening(true))
    }

    private func listen<Results: AsyncSequence>(to sequence: Results, text: @escaping (Results.Element) -> String) where Results.Element: SpeechModuleResult {
        results = Task { [weak self] in
            var heard = false
            do {
                for try await r in sequence {
                    let t = text(r)
                    heard = true
                    guard let self, self.active else { continue }
                    if !t.isEmpty { self.onEvent?(.result([t], final: r.isFinal, confidence: 0)) }
                }
            } catch {
                guard let self, self.active else { return }
                // Failing before any result: the model is missing after all.
                if heard { self.fail(.other, error.localizedDescription) } else { self.fallBack(error.localizedDescription) }
            }
        }
    }

    @discardableResult
    private func teardown() -> Task<Void, Never> {
        box.set(nil)
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        input?.finish()
        input = nil
        results?.cancel()
        results = nil
        let analyzer = self.analyzer
        self.analyzer = nil
        return Task { await analyzer?.cancelAndFinishNow() }
    }

    private func fallBack(_ reason: String) {
        let done = teardown()
        // Hand the microphone over: the old recognizer runs its own engine.
        try? engine.inputNode.setVoiceProcessingEnabled(false)
        fallbackReason = reason
        let f = AppleSpeechService()
        f.onEvent = { [weak self] in self?.onEvent?($0) }
        fallback = f
        Task {
            await done.value
            if active { f.start() }
        }
    }

    private func fail(_ kind: SpeechErrorKind, _ detail: String) {
        stop()
        onEvent?(.error(kind, detail))
    }
}

/// Resamples microphone buffers to the analyzer's format, on the audio thread.
private final class Converter: @unchecked Sendable {
    private let converter: AVAudioConverter?
    private let format: AVAudioFormat

    init(from: AVAudioFormat, to: AVAudioFormat) {
        converter = from == to ? nil : AVAudioConverter(from: from, to: to)
        format = to
    }

    func convert(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        guard let converter else { return buffer }
        let frames = AVAudioFrameCount((Double(buffer.frameLength) * format.sampleRate / buffer.format.sampleRate).rounded(.up))
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames + 16) else { return nil }
        var fed = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if fed {
                status.pointee = .noDataNow
                return nil
            }
            fed = true
            status.pointee = .haveData
            return buffer
        }
        return error == nil && out.frameLength > 0 ? out : nil
    }
}
