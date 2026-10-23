// Port of rng() and Sky.decorate() in src/games/counting/Sky.ts. Keep them in
// step: the same seeds give the same sky on the web and on iOS.

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

/// One piece of scenery in the sky.
public struct Decoration: Equatable {
    /// The drawing's name in the asset catalog ("cloud", "balloon3", "moon"…).
    public var art: String
    /// Cloud size, 1...3 (the web's s1...s3); 0 for other art.
    public var size: Int
    /// Left edge of the box, in percent of the width (centered on it).
    public var left: Double
    /// Height above the launch line, in counting steps.
    public var height: Double
    /// Horizontal drift, in points, and how long one drift takes, in seconds.
    public var drift: Double
    public var duration: Double
}

private let fixedArt: [Int: String] = [
    6: "kite", 17: "hotAir", 33: "plane", 64: "satellite", 76: "moon", 88: "ufo", 100: "saturn", 124: "astronaut", 150: "galaxy",
]

/// Scenery for the band of sky at count n (Sky.decorate on the web).
public func decorations(at n: Int) -> [Decoration] {
    var r = SkyRandom(seed: n)
    var pieces: [(String, Int)] = []
    let colors = countColors.count
    if let art = fixedArt[n] {
        pieces.append((art, 0))
    } else if n >= 2 && n <= 50 && r.next() < 0.6 {
        pieces.append(("cloud", 1 + Int(r.next() * 3)))
    } else if n >= 3 && n <= 26 && r.next() < 0.35 {
        pieces.append(r.next() < 0.5 ? ("bird", 0) : ("balloon\(Int(r.next() * Double(colors)))", 0))
    } else if n > 60 && r.next() < 0.12 {
        pieces.append(("comet", 0))
    } else if n > 104 && r.next() < 0.3 {
        pieces.append(("planet\(Int(r.next() * Double(colors)))", 0))
    }
    return pieces.map { art, size in
        // Keep the middle (the rocket's path and number stars) mostly clear.
        let left = r.next() < 0.5 ? 2 + r.next() * 22 : 70 + r.next() * 22
        let height = Double(n) + r.next()
        let drift = (r.next() * 2 - 1) * 30
        let duration = 6 + r.next() * 6
        return Decoration(art: art, size: size, left: left, height: height, drift: drift, duration: duration)
    }
}
