// Port of src/games/counting/CountJudge.ts. Keep the two in step.

public struct Heard: Equatable {
    /// Numbers newly counted, in order.
    public var counted: [Int]
    /// A number said out of order (only reported from final results).
    public var wrong: Int?

    public init(counted: [Int], wrong: Int?) {
        self.counted = counted
        self.wrong = wrong
    }
}

/**
 * Follows a child counting out loud: 1, 2, 3, …
 *
 * Fed with every speech result. Interim results only ever move the count
 * forward (quick feedback); a wrong number is judged only once the recognizer
 * has finalized the words, because interim guesses change. Numbers at or
 * below the current count are ignored: they are echoes of text already heard
 * (recognizers resend whole transcripts) or a repeat, not a new mistake.
 */
public final class CountJudge {
    public var count = 0
    /// A new recognition session started and nothing was counted in it yet.
    private var freshSession = true

    public init() {}

    /**
     * The recognizer (re)started listening. It often misses the first word of
     * a session (while it warms up, or said in the gap of a restart), so the
     * first number heard may skip one.
     */
    public func newSession() {
        freshSession = true
    }

    /**
     * `alternatives`: the recognizer's guesses for one result, best first.
     * `confidence` (0...1, 0 = unknown): a low-confidence wrong number is
     * treated as misheard, not as a mistake.
     */
    @discardableResult
    public func hear(_ alternatives: [String], final isFinal: Bool, confidence: Double = 0) -> Heard {
        var best: Guess?
        for text in alternatives {
            let h = simulate(text, judge: isFinal && !(confidence > 0 && confidence < minConfidence))
            if best == nil || h.score > best!.score { best = h }
        }
        guard let best else { return Heard(counted: [], wrong: nil) }
        if let last = best.counted.last {
            count = last
            freshSession = false
        }
        return Heard(counted: best.counted, wrong: best.wrong)
    }

    private func simulate(_ text: String, judge: Bool) -> Guess {
        var counted: [Int] = []
        var forgave = false
        var c = count
        for x in parseNumbers(text, last: c) {
            if x == c + 1 {
                c += 1
                counted.append(c)
            } else if x == c + 2 && freshSession && counted.isEmpty {
                counted.append(contentsOf: [c + 1, c + 2])
                c += 2
                forgave = true
            } else if x > c + 1 && !farOff(x, c) {
                return Guess(counted: counted, wrong: judge ? x : nil, forgave: forgave)
            }
        }
        return Guess(counted: counted, wrong: nil, forgave: forgave)
    }
}

/**
 * A "wrong" number far beyond the count (1233 when at 2) is a transcript
 * artifact — digits glued together — not a child's mistake; ignore it.
 * Real slips stay close: a skipped number, or the wrong ten (29 → 40).
 */
private func farOff(_ x: Int, _ count: Int) -> Bool {
    x > 2 * (count + 1) + 20
}

/// Below this recognizer confidence a wrong number is ignored.
private let minConfidence = 0.5

private struct Guess {
    var counted: [Int]
    var wrong: Int?
    var forgave: Bool

    /**
     * A guess without a mistake beats one with; then the one counting further,
     * where a forgiven missing number counts less than one actually heard.
     */
    var score: Double {
        (wrong == nil ? 1e6 : 0) + Double(counted.count) - (forgave ? 1.5 : 0)
    }
}

public enum Patience: String, CaseIterable {
    case normal, long, xlong

    /// Seconds to think: (before the first number, between numbers).
    var seconds: (first: Int, between: Int) {
        switch self {
        case .normal: (15, 8)
        case .long: (20, 12)
        case .xlong: (30, 20)
        }
    }
}

/**
 * How long the child may stay quiet before we decide they don't know the next
 * number. Generous at the start, and longer for long numbers ("מאה עשרים ושלוש").
 */
public func patienceMs(_ count: Int, _ level: Patience = .long) -> Int {
    let (first, between) = level.seconds
    if count == 0 { return first * 1000 }
    return (between + (count >= 100 ? 2 : 0)) * 1000
}
