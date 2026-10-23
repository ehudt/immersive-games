// Port of src/core/speech/hebrewNumbers.ts. Keep the two in step.

/**
 * Turns Hebrew speech-recognition transcripts into numbers.
 *
 * Recognizers return counting either as digits ("1 2 3", sometimes glued as
 * "123") or as words ("אחת שתיים שלוש", "עשרים ואחת"), in feminine or
 * masculine forms, with or without the "ו" (and) prefix. Word sequences are
 * often ambiguous: "תשע עשר" is 19, or 9 followed by 10. So the parser lists
 * every reading of each span and picks the segmentation that best looks like
 * counting (most consecutive steps), optionally continuing from a known last
 * number.
 *
 * Text is handled as Unicode scalars, as the TypeScript version handles UTF-16
 * code units: Swift `Character`s would glue niqqud onto their letters.
 */

enum Kind {
    case unit // 1..9 (also the "שתים"/"שנים" teen forms)
    case ten // 10 alone, or the "עשרה" of a teen
    case tens // 20..90
    case hundred // 100, 200
    case hundreds // the "מאות" of 300..900
    case thousand // 1000, 2000
    case thousands // the "אלפים" of 3000..9000
    case construct // "שלושת", "ארבעת"... before "אלפים"
    case digits
    case near // one sound away from some number words: `options`
}

struct Item {
    var kind: Kind
    var value: Int
    /// Written with the "ו" (and) prefix.
    var vav: Bool
    /// Not a number word, only sounds like one ("אשר" for "עשר").
    var fuzzy = false
    /// For `.near` items: the numbers it might be.
    var options: [Int] = []
}

private let WORDS: [String: (Kind, Int)] = {
    var w: [String: (Kind, Int)] = [:]
    func words(_ kind: Kind, _ value: Int, _ forms: String...) {
        for f in forms { w[f] = (kind, value) }
    }
    words(.unit, 1, "אחת", "אחד")
    words(.unit, 2, "שתיים", "שתים", "שניים", "שנים", "שתי", "שני")
    words(.unit, 3, "שלוש", "שלושה", "שלש", "שלשה")
    words(.unit, 4, "ארבע", "ארבעה")
    words(.unit, 5, "חמש", "חמישה", "חמשה")
    words(.unit, 6, "שש", "שישה", "ששה")
    words(.unit, 7, "שבע", "שבעה")
    words(.unit, 8, "שמונה")
    words(.unit, 9, "תשע", "תשעה")
    words(.ten, 10, "עשר", "עשרה")
    words(.tens, 20, "עשרים")
    words(.tens, 30, "שלושים", "שלשים")
    words(.tens, 40, "ארבעים")
    words(.tens, 50, "חמישים", "חמשים")
    words(.tens, 60, "שישים", "ששים")
    words(.tens, 70, "שבעים")
    words(.tens, 80, "שמונים")
    words(.tens, 90, "תשעים")
    words(.hundred, 100, "מאה")
    words(.hundred, 200, "מאתיים", "מאתים")
    words(.hundreds, 100, "מאות")
    words(.thousand, 1000, "אלף")
    words(.thousand, 2000, "אלפיים")
    words(.thousands, 1000, "אלפים")
    words(.construct, 3, "שלושת", "שלשת")
    words(.construct, 4, "ארבעת")
    words(.construct, 5, "חמשת", "חמישת")
    words(.construct, 6, "ששת", "שישת")
    words(.construct, 7, "שבעת")
    words(.construct, 8, "שמונת")
    words(.construct, 9, "תשעת")
    words(.construct, 10, "עשרת")
    return w
}()

private let SOUND_MAP: [Unicode.Scalar: Unicode.Scalar] = [
    "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ", "ח": "כ", "ק": "כ", "ט": "ת", "ס": "ש",
]
private let SILENT: Set<Unicode.Scalar> = ["א", "ה", "ע", "ו", "י"]

/**
 * A rough sound key for a Hebrew word, so misheard or mispronounced number
 * words still match: final letters → regular, letters that sound alike merge
 * (ח/כ/ק, ט/ת, ס/ש — the last also covers a child's lisp), and the silent or
 * vowel letters א ה ע ו י are dropped. "עשר", "אשר" and "אסר" all become "שר".
 */
public func soundKey(_ word: String) -> String {
    var out = String.UnicodeScalarView()
    for c in word.unicodeScalars {
        let m = SOUND_MAP[c] ?? c
        if !SILENT.contains(m) { out.append(m) }
    }
    return String(out)
}

/// Sound key → number word, for units and tens only (short keys and clashes left out).
private let SOUNDS: [String: (Kind, Int)] = {
    var sounds: [String: (Kind, Int)] = [:]
    var clash = Set<String>()
    for (word, (kind, value)) in WORDS {
        if kind != .unit && kind != .ten && kind != .tens { continue }
        let key = soundKey(word)
        if key.unicodeScalars.count < 2 { continue }
        if let prev = sounds[key], prev.1 != value { clash.insert(key) }
        sounds[key] = (kind, value)
    }
    for key in clash { sounds[key] = nil }
    return sounds
}()

/// Mishearings too short for a sound key.
private let ALIASES: [String: (Kind, Int)] = ["את": (.unit, 1)]

/// Niqqud, cantillation and the geresh/gershayim marks.
private func isMark(_ c: Unicode.Scalar) -> Bool {
    (0x0591...0x05C7).contains(c.value) || c.value == 0x05F3 || c.value == 0x05F4
}

private func isDigit(_ c: Unicode.Scalar) -> Bool { c.value >= 0x30 && c.value <= 0x39 }
private func isHebrewLetter(_ c: Unicode.Scalar) -> Bool { c.value >= 0x05D0 && c.value <= 0x05EA }
/// JavaScript's `\w`, for the `\b` in the thousands-separator rule.
private func isWordChar(_ c: Unicode.Scalar) -> Bool {
    isDigit(c) || (c.value >= 0x41 && c.value <= 0x5A) || (c.value >= 0x61 && c.value <= 0x7A) || c == "_"
}

/// A number too big to be counting; used for digit runs that overflow `Int`.
private let HUGE = 1_000_000_000_000

private func lookup(_ word: String, _ vav: Bool) -> Item? {
    if !word.isEmpty && word.unicodeScalars.allSatisfy(isDigit) {
        return Item(kind: .digits, value: Int(word) ?? HUGE, vav: vav)
    }
    guard let w = WORDS[word] else { return nil }
    return Item(kind: w.0, value: w.1, vav: vav)
}

private func soundsLike(_ word: String, _ vav: Bool) -> Item? {
    let key = soundKey(word)
    if let w = ALIASES[word] ?? SOUNDS[key] {
        return Item(kind: w.0, value: w.1, vav: vav, fuzzy: true)
    }
    // One sound off ("שלום" or "שלו" for שלוש): any number it is close to.
    if key.unicodeScalars.count < 2 { return nil }
    var options = Set<Int>()
    for (target, (_, value)) in SOUNDS where target.unicodeScalars.count >= 3 && oneEditApart(key, target) {
        options.insert(value)
    }
    return options.isEmpty ? nil : Item(kind: .near, value: 0, vav: vav, fuzzy: true, options: options.sorted())
}

/// Levenshtein distance ≤ 1 (one letter added, dropped or changed).
public func oneEditApart(_ a: String, _ b: String) -> Bool {
    let a = Array(a.unicodeScalars), b = Array(b.unicodeScalars)
    if abs(a.count - b.count) > 1 { return false }
    var i = 0
    while i < a.count && i < b.count && a[i] == b[i] { i += 1 }
    func from(_ x: [Unicode.Scalar], _ k: Int) -> ArraySlice<Unicode.Scalar> { x[min(k, x.count)...] }
    if a.count == b.count { return from(a, i + 1) == from(b, i + 1) }
    return a.count > b.count ? from(a, i + 1) == from(b, i) : from(b, i + 1) == from(a, i)
}

/// Drops marks and the "," of "1,000", then splits on anything but Hebrew letters and digits.
private func words(of text: String) -> [String] {
    let s = Array(text.unicodeScalars).filter { !isMark($0) }
    var raw: [String] = []
    var cur = String.UnicodeScalarView()
    for (k, c) in s.enumerated() {
        if c == ",", k > 0, isDigit(s[k - 1]), k + 3 < s.count, s[(k + 1)...(k + 3)].allSatisfy(isDigit),
           k + 4 == s.count || !isWordChar(s[k + 4]) {
            continue // "1,000"
        }
        if isDigit(c) || isHebrewLetter(c) {
            cur.append(c)
        } else if !cur.isEmpty {
            raw.append(String(cur))
            cur = String.UnicodeScalarView()
        }
    }
    if !cur.isEmpty { raw.append(String(cur)) }
    return raw
}

/// Splits a word into runs of digits and runs of letters ("ו3" → "ו", "3").
private func digitRuns(_ tok: String) -> [String] {
    var parts: [String] = []
    var cur = String.UnicodeScalarView()
    var curDigits = false
    for c in tok.unicodeScalars {
        if !cur.isEmpty && isDigit(c) != curDigits {
            parts.append(String(cur))
            cur = String.UnicodeScalarView()
        }
        curDigits = isDigit(c)
        cur.append(c)
    }
    if !cur.isEmpty { parts.append(String(cur)) }
    return parts
}

/// Splits a transcript into number items; anything else becomes nil (a gap).
func tokenize(_ text: String) -> [Item?] {
    var out: [Item?] = []
    var pendingVav = false
    for tok in words(of: text) {
        if tok == "ו" {
            // A detached "ו" ("ו-3", "ו 3") belongs to the next word.
            pendingVav = true
            continue
        }
        // Digits can be glued to letters ("ו3").
        for part in digitRuns(tok) {
            if part == "ו" {
                pendingVav = true
                continue
            }
            let vav = part.hasPrefix("ו") && part.unicodeScalars.count > 1
            let rest = String(part.unicodeScalars.dropFirst())
            let item =
                lookup(part, pendingVav)
                ?? (vav ? lookup(rest, true) : nil)
                ?? (vav ? soundsLike(rest, true) : nil)
                ?? soundsLike(part, pendingVav)
            out.append(item)
            pendingVav = false
        }
    }
    return out
}

struct Span {
    var end: Int
    var values: [Int]
    /// Reading starts with a dangling "ו" ("ואחת" on its own) — unlikely.
    var odd: Bool
    /// A word that only sounds like a number: taken only when it continues the count.
    var guess = false
    /**
     * A glued digit run split into several numbers ("123" → 1, 2, 3). Recognizers
     * resend the whole utterance, so it may start with numbers already counted;
     * taken only when it starts at or before the next number.
     */
    var split = false
}

private struct Part {
    var end: Int
    var value: Int
}

private func at(_ items: [Item?], _ i: Int) -> Item? { i < items.count ? items[i] : nil }

private func isUnit(_ it: Item?) -> Bool {
    guard let it else { return false }
    return it.kind == .unit || (it.kind == .digits && it.value >= 1 && it.value <= 9)
}

/// Readings of 1..99 starting at i (the first item may carry a "ו").
private func belowHundred(_ items: [Item?], _ i: Int) -> [Part] {
    guard let it = at(items, i) else { return [] }
    var out: [Part] = []
    switch it.kind {
    case .unit:
        out.append(Part(end: i + 1, value: it.value))
        if let next = at(items, i + 1), next.kind == .ten, !next.vav { out.append(Part(end: i + 2, value: 10 + it.value)) }
    case .ten:
        out.append(Part(end: i + 1, value: 10))
    case .tens:
        out.append(Part(end: i + 1, value: it.value))
        let next = at(items, i + 1)
        if isUnit(next) { out.append(Part(end: i + 2, value: it.value + next!.value)) }
    case .digits where it.value >= 1 && it.value <= 99:
        out.append(Part(end: i + 1, value: it.value))
    default:
        break
    }
    return out
}

private func hundreds(_ items: [Item?], _ i: Int) -> [Part] {
    guard let it = at(items, i) else { return [] }
    if it.kind == .hundred { return [Part(end: i + 1, value: it.value)] }
    let next = at(items, i + 1)
    if it.kind == .unit && it.value >= 3 && next?.kind == .hundreds && next?.vav == false {
        return [Part(end: i + 2, value: it.value * 100)]
    }
    return []
}

private func thousands(_ items: [Item?], _ i: Int) -> [Part] {
    guard let it = at(items, i) else { return [] }
    if it.kind == .thousand { return [Part(end: i + 1, value: it.value)] }
    let next = at(items, i + 1)
    if (it.kind == .construct || (it.kind == .unit && it.value >= 3)) && next?.kind == .thousands && next?.vav == false {
        return [Part(end: i + 2, value: it.value * 1000)]
    }
    return []
}

/// Every reading of one spoken number (1..9999) that starts at item i.
private func wordNumbers(_ items: [Item?], _ i: Int) -> [Part] {
    var out: [Part] = []
    func add(_ start: [Part], _ rest: (Int) -> [Part]) {
        for s in start {
            out.append(s)
            for r in rest(s.end) { out.append(Part(end: r.end, value: s.value + r.value)) }
        }
    }
    let afterHundreds = { (j: Int) in belowHundred(items, j) }
    let afterThousands = { (j: Int) -> [Part] in
        var res = belowHundred(items, j)
        for h in hundreds(items, j) {
            res.append(h)
            for r in belowHundred(items, h.end) { res.append(Part(end: r.end, value: h.value + r.value)) }
        }
        return res
    }
    add(thousands(items, i), afterThousands)
    add(hundreds(items, i), afterHundreds)
    out.append(contentsOf: belowHundred(items, i))
    return out
}

/**
 * Splits a glued digit run ("123", "91011") into a counting run, if it is
 * one. A number may repeat ("1233" → 1, 2, 3, 3): children (and transcripts)
 * sometimes say one twice. A run may also break off and go on from another
 * number ("1234568" → 1…6, 8): that is a child skipping one, which must still
 * be heard as a skip.
 */
public func splitConsecutive(_ digits: String) -> [Int]? {
    let d = Array(digits.unicodeScalars)
    guard let first = d.first, first != "0" else { return nil }
    func number(_ s: ArraySlice<Unicode.Scalar>) -> Int { Int(String(String.UnicodeScalarView(s))) ?? HUGE }
    func starts(_ s: String, _ pos: Int) -> Bool {
        let p = Array(s.unicodeScalars)
        return pos + p.count <= d.count && Array(d[pos..<(pos + p.count)]) == p
    }
    // Longest counting run from the start, for each length of its first number.
    var runs: [(seq: [Int], pos: Int)] = []
    for len in 1...min(4, d.count) {
        var n = number(d[0..<len])
        var seq = [n]
        var pos = len
        while pos < d.count {
            if n == 8 && starts("19", pos) && !starts("9", pos) {
                // "תשע, עשר" written as 19 (see spansAt).
                seq.append(contentsOf: [9, 10])
                n = 10
                pos += 2
                continue
            }
            if starts(String(n + 1), pos) {
                n += 1
            } else if !starts(String(n), pos) {
                break
            }
            seq.append(n)
            pos += String(n).unicodeScalars.count
        }
        if seq.count > 1 && pos == d.count { return seq }
        runs.append((seq, pos))
    }
    // A run of at least two, then the rest: another run, or one short number.
    for (seq, pos) in runs where seq.count >= 2 {
        let rest = d[pos...]
        if rest.first == "0" { continue }
        let tail = splitConsecutive(String(String.UnicodeScalarView(rest))) ?? (rest.count <= 3 ? [number(rest)] : nil)
        if let tail { return seq + tail }
    }
    return nil
}

private func spansAt(_ items: [Item?], _ i: Int) -> [Span] {
    guard let it = at(items, i) else { return [] }
    if it.kind == .near {
        return it.options.map { Span(end: i + 1, values: [$0], odd: false, guess: true) }
    }
    if it.kind == .digits {
        var spans = [Span(end: i + 1, values: [it.value], odd: false)]
        if let split = splitConsecutive(String(it.value)) {
            spans.append(Span(end: i + 1, values: split, odd: false, split: true))
        }
        // "תשע, עשר" (9, 10) said quickly is also how 19 sounds, and iOS writes
        // it as "19". Taken as 9, 10 only where those come next.
        if it.value == 19 { spans.append(Span(end: i + 1, values: [9, 10], odd: false, split: true)) }
        // "20 ו-1": digits followed by a unit.
        if it.value % 10 == 0 && it.value >= 20 && it.value < 100, isUnit(at(items, i + 1)), let next = at(items, i + 1), next.vav {
            spans.append(Span(end: i + 2, values: [it.value + next.value], odd: false))
        }
        return spans
    }
    return wordNumbers(items, i).map { p in
        Span(end: p.end, values: [p.value], odd: it.vav, guess: items[i..<p.end].contains { $0?.fuzzy == true })
    }
}

/// A map that keeps insertion order, like JavaScript's `Map`: ties go to the
/// reading found first, so the order readings are tried in must match.
private struct OrderedMap<Value> {
    private(set) var keys: [Int] = []
    private var values: [Int: Value] = [:]
    subscript(key: Int) -> Value? {
        get { values[key] }
        set {
            if values[key] == nil { keys.append(key) }
            values[key] = newValue
        }
    }
    var entries: [(Int, Value)] { keys.map { ($0, values[$0]!) } }
}

/**
 * Reads the numbers in a transcript. `last` is the number counted just before
 * this text (0 at the start), which helps resolve ambiguous readings.
 *
 * Readings are ranked by consecutive steps (n → n+1), minus one for a reading
 * that starts with a dangling "ו" and 1.5 for each number word left unread;
 * ties go to fewer (so longer) numbers.
 */
public func parseNumbers(_ text: String, last: Int = 0) -> [Int] {
    let items = tokenize(text)
    let n = items.count
    struct State {
        var rank: Double
        var steps: Int
        var skipped: Int
        var weight: Double
        var values: [Int]
    }
    func rank(_ steps: Int, _ skipped: Int, _ weight: Double) -> Double {
        (Double(steps) - 1.5 * Double(skipped)) * 1e4 - weight
    }
    // best[i]: best reading of items[0..<i], keyed by the last number read.
    var best = [OrderedMap<State>](repeating: OrderedMap(), count: n + 1)
    best[0][last] = State(rank: 0, steps: 0, skipped: 0, weight: 0, values: [])
    /// `weight`: how many numbers the reading claims (fewer, longer ones win ties).
    func offer(_ i: Int, _ key: Int, _ steps: Int, _ skipped: Int, _ weight: Double, _ values: [Int]) {
        let r = rank(steps, skipped, weight)
        if let cur = best[i][key], r <= cur.rank { return }
        best[i][key] = State(rank: r, steps: steps, skipped: skipped, weight: weight, values: values)
    }
    for i in 0..<n {
        for (prev, st) in best[i].entries {
            // Leave this item unread (free if it isn't a number word at all).
            offer(i + 1, prev, st.steps, st.skipped + (items[i] != nil ? 1 : 0), st.weight, st.values)
            for span in spansAt(items, i) {
                if span.guess && span.values.enumerated().contains(where: { k, v in v != prev + 1 + k }) { continue }
                if span.split && span.values[0] > prev + 1 { continue }
                var steps = st.steps - (span.odd ? 1 : 0)
                var p = prev
                for v in span.values {
                    // A split only earns its new numbers, so "123" after 122 stays 123.
                    if v == p + 1 && (!span.split || v > last) { steps += 1 }
                    p = v
                }
                // A split's resent numbers weigh nothing, and on a tie it beats one
                // huge number ("1234568" is 1…6, 8, not a million).
                let weight = span.split ? Double(span.values.filter { $0 > last }.count) - 0.5 : Double(span.values.count)
                offer(span.end, p, steps, st.skipped, st.weight + weight, st.values + span.values)
            }
        }
    }
    var result: State?
    for (_, st) in best[n].entries where result == nil || st.rank > result!.rank { result = st }
    return result?.values ?? []
}
