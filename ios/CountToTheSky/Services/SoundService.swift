import AVFoundation

/**
 * The game's sound effects, synthesized like the web's `CountingSfx`
 * (src/games/counting/sounds.ts): oscillator tones with a quick attack and an
 * exponential fade, plus filtered noise for the crowd cheer. No asset files.
 */
@MainActor
final class SoundService {
    var muted = false

    private let engine = AVAudioEngine()
    private let synth: Synth
    private var started = false

    /// C-major pentatonic, two octaves: every count climbs a step, wrapping each ten.
    private static let scale: [Double] = [523, 587, 659, 784, 880, 1046, 1175, 1318, 1568, 1760]

    init() {
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        synth = Synth(sampleRate: format.sampleRate)
        let synth = synth
        let node = AVAudioSourceNode(format: format) { @Sendable _, _, frames, abl in
            synth.render(UnsafeMutableAudioBufferListPointer(abl), frames: Int(frames))
            return noErr
        }
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = 0.35
    }

    /// A bright "bloop" that climbs with the count.
    func count(_ n: Int) {
        let f = Self.scale[(n - 1) % Self.scale.count]
        tone(f * 0.75, 0.12, .sine, 0.5, glideTo: f)
        tone(f * 2, 0.18, .triangle, 0.18, delay: 0.04)
    }

    /// Every ten: a quick sparkly arpeggio.
    func milestone() {
        for (i, f) in [1046.0, 1318, 1568, 2093].enumerated() { tone(f, 0.22, .triangle, 0.4, delay: 0.12 + Double(i) * 0.07) }
        sparkle(0.12, 0.6)
    }

    /// The end of a game: a little victory fanfare with cheering.
    func victory() {
        // (freq, start, length)
        let notes: [(Double, Double, Double)] = [(392, 0, 0.16), (523, 0.16, 0.16), (659, 0.32, 0.16), (784, 0.48, 0.32), (659, 0.8, 0.16), (784, 0.96, 0.7)]
        for (f, t, d) in notes {
            tone(f, d + 0.1, .triangle, 0.55, delay: t)
            tone(f / 2, d + 0.1, .sine, 0.3, delay: t)
        }
        // Final chord.
        for f in [523.0, 659, 784, 1046] { tone(f, 1.2, .triangle, 0.25, delay: 0.96) }
        play { $0.noise(delay: 0.9, duration: 2.2) }
        sparkle(1.0, 1.4)
    }

    /// Gentle "hmm?" when nothing was heard at all.
    func nothing() {
        tone(440, 0.25, .sine, 0.4, glideTo: 330)
        tone(392, 0.3, .sine, 0.4, delay: 0.28, glideTo: 300)
    }

    /// Random high pings, like glitter.
    private func sparkle(_ delay: Double, _ dur: Double) {
        for i in 0..<10 { tone(1800 + Double.random(in: 0..<1800), 0.08, .sine, 0.12, delay: delay + dur * Double(i) / 10) }
    }

    private func tone(_ freq: Double, _ dur: Double, _ wave: Synth.Wave, _ gain: Double, delay: Double = 0, glideTo: Double? = nil) {
        play { $0.tone(freq: freq, duration: dur, wave: wave, gain: gain, delay: delay, glideTo: glideTo) }
    }

    private func play(_ fn: (Synth) -> Void) {
        guard !muted else { return }
        if !started {
            try? AudioSession.configure()
            started = (try? engine.start()) != nil
        }
        fn(synth)
    }
}

/// Mixes scheduled voices on the audio thread.
private final class Synth: @unchecked Sendable {
    enum Wave { case sine, triangle }

    private struct Voice {
        var start: Int
        var length: Int
        var freq: Double
        var glideTo: Double?
        var wave: Wave
        var gain: Double
        var phase = 0.0
        /// Pre-rendered samples (noise) instead of an oscillator.
        var samples: [Float]?
    }

    private let lock = NSLock()
    private let sampleRate: Double
    private var voices: [Voice] = []
    private var clock = 0

    init(sampleRate: Double) {
        self.sampleRate = sampleRate
    }

    func tone(freq: Double, duration: Double, wave: Wave, gain: Double, delay: Double, glideTo: Double?) {
        add(Voice(start: 0, length: Int(duration * sampleRate), freq: freq, glideTo: glideTo, wave: wave, gain: gain), delay: delay)
    }

    /// Clapping far away: noise with random bursts, band-passed around 1.5 kHz,
    /// swelling and fading.
    func noise(delay: Double, duration: Double) {
        let len = Int(sampleRate * duration)
        var data = (0..<len).map { _ in Float.random(in: -1...1) * 0.25 }
        for _ in 0..<Int(duration * 40) {
            let at = Int.random(in: 0..<(len - 800))
            for k in 0..<800 { data[at + k] += Float.random(in: -1...1) * (1 - Float(k) / 800) }
        }
        // Two one-pole filters make a soft band-pass.
        var low: Float = 0, lower: Float = 0
        let a = Float(1 - exp(-2 * Double.pi * 2500 / sampleRate))
        let b = Float(1 - exp(-2 * Double.pi * 900 / sampleRate))
        for i in 0..<len {
            low += a * (data[i] - low)
            lower += b * (low - lower)
            data[i] = (low - lower) * Float(cheerEnvelope(Double(i) / sampleRate, duration)) * 2
        }
        add(Voice(start: 0, length: len, freq: 0, wave: .sine, gain: 1, samples: data), delay: delay)
    }

    /// Rises to 0.35 in 0.3 s, eases to 0.25 by 60%, then fades out.
    private func cheerEnvelope(_ t: Double, _ dur: Double) -> Double {
        if t < 0.3 { return 0.35 * t / 0.3 }
        let mid = dur * 0.6
        if t < mid { return 0.35 - 0.1 * (t - 0.3) / max(0.001, mid - 0.3) }
        return 0.25 * max(0, dur - t) / max(0.001, dur - mid)
    }

    private func add(_ v: Voice, delay: Double) {
        lock.lock()
        var v = v
        v.start = clock + Int(delay * sampleRate)
        voices.append(v)
        lock.unlock()
    }

    func render(_ buffers: UnsafeMutableAudioBufferListPointer, frames: Int) {
        lock.lock()
        defer { lock.unlock() }
        guard let out = buffers.first?.mData?.assumingMemoryBound(to: Float.self) else { return }
        for i in 0..<frames {
            let now = clock + i
            var s = 0.0
            for k in voices.indices where now >= voices[k].start && now < voices[k].start + voices[k].length {
                let t = now - voices[k].start
                if let samples = voices[k].samples {
                    s += Double(samples[t])
                    continue
                }
                let v = voices[k]
                let p = Double(t) / Double(v.length)
                let f = v.glideTo.map { v.freq * pow($0 / v.freq, p) } ?? v.freq
                voices[k].phase = (v.phase + f / sampleRate).truncatingRemainder(dividingBy: 1)
                let x = v.wave == .sine ? sin(2 * .pi * v.phase) : 1 - 4 * abs(v.phase - 0.5)
                // 10 ms attack, then an exponential fade to -60 dB.
                let secs = Double(t) / sampleRate
                let env = secs < 0.01 ? secs / 0.01 : pow(0.001, (secs - 0.01) / max(0.001, Double(v.length) / sampleRate - 0.01))
                s += x * env * v.gain
            }
            out[i] = Float(max(-1, min(1, s)))
        }
        clock += frames
        voices.removeAll { $0.start + $0.length < clock }
        for b in buffers.dropFirst() { b.mData?.copyMemory(from: out, byteCount: Int(b.mDataByteSize)) }
    }
}
