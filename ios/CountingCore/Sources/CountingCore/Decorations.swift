// Port of rng() and decorations() in src/games/counting/scenery.ts. Keep them
// in step: the same seeds give the same sky on the web and on iOS. The
// milestone table itself is generated into Milestones.swift.

/// The web's seeded generator (mulberry32 on 32-bit integers).
public struct SkyRandom {
    private var a: UInt32

    public init(seed: Int) {
        a = UInt32(truncatingIfNeeded: Int64(seed) &* 2_654_435_761)
    }

    public mutating func next() -> Double {
        a = a &+ 0x6D2B_79F5
        var t = (a ^ (a >> 15)) &* (1 | a)
        t = (t &+ ((t ^ (t >> 7)) &* (61 | t))) ^ t
        return Double(t ^ (t >> 14)) / 4_294_967_296
    }
}

/// A friend the rocket meets (MILESTONES on the web; the list is `milestones`).
public struct Milestone: Equatable {
    public var count: Int
    /// The drawing's name in the asset catalog.
    public var art: String
    /// Hebrew name, for the greeting ("שלום, דרקון!").
    public var name: String
    /// Width in points (at most a third of the screen), and height / width.
    public var width: Double
    public var aspect: Double
}

/// The friend met at this count, if any.
public func milestone(at count: Int) -> Milestone? {
    milestones.first { $0.count == count }
}

/// One piece of scenery in the sky.
public struct Decoration: Equatable {
    /// The drawing's name in the asset catalog ("cloud", "planet3", "dragon"…).
    public var art: String
    /// Cloud size, 1...3 (the web's s1...s3); 0 for other art.
    public var size: Int
    /// Width for a milestone friend; 0 for the rest (sized by SkyView).
    public var width: Double
    /// Center, in percent of the width.
    public var left: Double
    /// Height above the launch line, in counting steps.
    public var height: Double
    /// Horizontal drift, in points, and how long one drift takes, in seconds.
    public var drift: Double
    public var duration: Double
}

/// Scenery for the band of sky at count n (decorations() on the web).
public func decorations(at n: Int) -> [Decoration] {
    var r = SkyRandom(seed: n)
    if let m = milestone(at: n) {
        // Beside the rocket's nose when it gets here, on the right (the number
        // star of a multiple of ten is on the left).
        let left = 77 + r.next() * 6
        let height = Double(n) + 0.85 + r.next() * 0.3
        let drift = (r.next() * 2 - 1) * 12
        let duration = 5 + r.next() * 3
        return [Decoration(art: m.art, size: 0, width: m.width, left: left, height: height, drift: drift, duration: duration)]
    }
    var art = ""
    var size = 0
    if n >= 2 && n <= 145 && r.next() < 0.6 {
        art = "cloud"
        size = 1 + Int(r.next() * 3)
    } else if n >= 3 && n <= 60 && r.next() < 0.3 {
        art = "bird"
    } else if n > 165 && r.next() < 0.12 {
        art = "comet"
    } else if n > 175 && r.next() < 0.3 {
        art = "planet\(Int(r.next() * 6))"
    }
    if art.isEmpty { return [] }
    // Keep the middle (the rocket's path and number stars) mostly clear, and
    // the right side next to a friend free for it.
    let nearFriend = milestone(at: n - 1) != nil || milestone(at: n + 1) != nil
    let left = r.next() < 0.5 || nearFriend ? 2 + r.next() * 22 : 70 + r.next() * 22
    let height = Double(n) + r.next()
    let drift = (r.next() * 2 - 1) * 30
    let duration = 6 + r.next() * 6
    return [Decoration(art: art, size: size, width: 0, left: left, height: height, drift: drift, duration: duration)]
}
