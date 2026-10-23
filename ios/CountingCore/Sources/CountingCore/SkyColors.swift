// Port of skyColors() and starsOpacity() in src/games/counting/scenery.ts.
// Keep the two in step.

/// An sRGB color, 0...255 per channel.
public struct RGB: Equatable {
    public var r: Int, g: Int, b: Int

    public init(_ hex: UInt32) {
        r = Int(hex >> 16 & 0xFF)
        g = Int(hex >> 8 & 0xFF)
        b = Int(hex & 0xFF)
    }

    init(r: Int, g: Int, b: Int) {
        self.r = r
        self.g = g
        self.b = b
    }

    func mixed(with o: RGB, _ t: Double) -> RGB {
        func m(_ a: Int, _ b: Int) -> Int { Int((Double(a) + Double(b - a) * t).rounded()) }
        return RGB(r: m(r, o.r), g: m(g, o.g), b: m(b, o.b))
    }
}

/// The colors of the stars left behind each number.
public let countColors = [RGB(0xFF5D8F), RGB(0xFFB627), RGB(0x2EC4D6), RGB(0x7BD35A), RGB(0xA374FF), RGB(0xFF8A3D)]

/// (count, top color, bottom color): a day sky until 150, then into space by 300.
private let SKY: [(Int, RGB, RGB)] = [
    (0, RGB(0x4FC3FF), RGB(0xD6F3FF)),
    (70, RGB(0x2F9BE8), RGB(0xBFE6FF)),
    (150, RGB(0x2A86E0), RGB(0xA8DCFF)),
    (185, RGB(0x3F5FCF), RGB(0xFFBFD0)),
    (220, RGB(0x262C8A), RGB(0x9A5FC4)),
    (260, RGB(0x121845), RGB(0x3B2A78)),
    (300, RGB(0x060922), RGB(0x1A1450)),
]

/// Stars fade in as the sky darkens: none at 150, all of them by 230.
public func starsOpacity(_ count: Double) -> Double {
    min(1, max(0, (count - 150) / 80))
}

/// The sky gradient (top, bottom) at a count.
public func skyColors(_ count: Int) -> (top: RGB, bottom: RGB) {
    skyColors(at: Double(count))
}

/// The same, between counts too, so the sky can blend smoothly as it changes.
public func skyColors(at count: Double) -> (top: RGB, bottom: RGB) {
    for i in 1..<SKY.count where count <= Double(SKY[i].0) {
        let (c0, t0, b0) = SKY[i - 1]
        let (c1, t1, b1) = SKY[i]
        let t = max(0, (count - Double(c0)) / Double(c1 - c0))
        return (t0.mixed(with: t1, t), b0.mixed(with: b1, t))
    }
    return (SKY[SKY.count - 1].1, SKY[SKY.count - 1].2)
}
