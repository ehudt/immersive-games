import CountingCore
import SwiftUI

/**
 * The sky the rocket climbs through (src/games/counting/Sky.ts). Every counted
 * number lifts it one step: past the launch pad and hills, through clouds and
 * balloons, a plane, the sunset, then stars, the moon, Saturn and on into
 * space. The drawings are the web's own SVGs (scripts/export-ios-art.ts), and
 * the scenery is placed by the same seeded rules (`decorations(at:)`).
 *
 * The world is one layer moved down as the rocket climbs.
 */
struct SkyView: View {
    var count: Int
    var fuel: Double
    var flying: Bool
    var celebrating: Bool

    /// The highest band of sky with scenery so far (it stays when the rocket lands).
    @State private var builtUpTo = 24

    var body: some View {
        GeometryReader { geo in
            let L = SkyLayout(size: geo.size)
            ZStack(alignment: .topLeading) {
                SkyBackground(count: Double(count))
                    .animation(.easeInOut(duration: 1.2), value: count)
                StarField()
                    .opacity(min(1, max(0, Double(count - 40) / 35)))
                    .animation(.easeInOut(duration: 1.2), value: count)

                World(count: count, builtUpTo: builtUpTo, layout: L)
                    .offset(y: CGFloat(count) * SkyLayout.step)
                    .animation(
                        count == 0
                            ? .timingCurve(0.6, 0, 0.3, 1, duration: 1.3)
                            : .timingCurve(0.3, 1.25, 0.6, 1, duration: 0.75),
                        value: count
                    )

                Rocket(width: L.rocketWidth, count: count, fuel: fuel, flying: flying, celebrating: celebrating)
                    .position(x: L.width / 2, y: L.rocketCenterY)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
        // Positions are physical (left/right), as on the web.
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityHidden(true)
        .onChange(of: count) { _, n in builtUpTo = max(builtUpTo, n + 24) }
    }
}

/// Sizes and places from counting.css, in points.
struct SkyLayout {
    /// Points of climb per counted number.
    static let step: CGFloat = 64

    var width: CGFloat
    var height: CGFloat

    init(size: CGSize) {
        width = size.width
        height = size.height
    }

    private var vmin: CGFloat { min(width, height) / 100 }
    func clamp(_ lo: CGFloat, _ vmins: CGFloat, _ hi: CGFloat) -> CGFloat { min(hi, max(lo, vmins * vmin)) }

    /// Where the rocket stands: 24% of the height from the bottom.
    var launchY: CGFloat { height * 0.76 }
    var rocketWidth: CGFloat { clamp(84, 15, 136) }
    var rocketHeight: CGFloat { rocketWidth * 200 / 120 }
    /// The rocket box sits 22% of its height below the launch line.
    var rocketCenterY: CGFloat { launchY + 0.22 * rocketHeight - rocketHeight / 2 }
    /// Where particles puff out of the rocket.
    var rocketPoint: CGPoint { CGPoint(x: width / 2, y: rocketCenterY - rocketHeight / 2 + 0.55 * rocketHeight) }
}

private struct World: View {
    var count: Int
    var builtUpTo: Int
    var layout: SkyLayout

    var body: some View {
        let L = layout
        ZStack(alignment: .topLeading) {
            Ground(layout: L)
            ForEach(1...max(1, builtUpTo), id: \.self) { n in
                ForEach(Array(decorations(at: n).enumerated()), id: \.offset) { _, d in
                    Deco(d: d, layout: L)
                }
            }
            ForEach(Array(stride(from: 1, through: count, by: 1)), id: \.self) { n in
                NumberStar(n: n)
                    .position(
                        x: L.width / 2 + (n % 2 == 1 ? 1 : -1) * CGFloat(88 + (n % 3) * 14),
                        y: L.launchY - (CGFloat(n) * SkyLayout.step + 40) - 75 / 2
                    )
                    .transition(.scale(scale: 0).combined(with: .opacity).animation(.spring(response: 0.55, dampingFraction: 0.55)))
            }
        }
        .frame(width: L.width, height: L.height, alignment: .topLeading)
    }
}

private struct Ground: View {
    var layout: SkyLayout

    var body: some View {
        let L = layout
        ZStack(alignment: .topLeading) {
            // The hills: from 10% below the bottom up to 24% above the launch line.
            Image("groundHills")
                .resizable()
                .frame(width: L.width, height: L.height * 0.48)
                .position(x: L.width / 2, y: L.height * 1.1 - L.height * 0.24)
            prop("tree1", L.clamp(48, 9, 84), aspect: 90 / 70, left: 0.06)
            prop("tree2", L.clamp(40, 7, 66), aspect: 90 / 70, left: 0.24)
            prop("house", L.clamp(70, 13, 120), aspect: 100 / 110, left: 0.74)
            prop("flower1", L.clamp(20, 3.5, 32), aspect: 1, left: 0.36)
            prop("flower2", L.clamp(20, 3.5, 32), aspect: 1, left: 0.63)
            let pad = L.clamp(110, 22, 190)
            Image("pad")
                .resizable()
                .frame(width: pad, height: pad * 40 / 160)
                .position(x: L.width / 2, y: L.launchY + 16 - pad * 40 / 160 / 2)
        }
    }

    /// A prop standing on the launch line, its left edge at a share of the width.
    private func prop(_ name: String, _ w: CGFloat, aspect: CGFloat, left: CGFloat) -> some View {
        Image(name)
            .resizable()
            .frame(width: w, height: w * aspect)
            .position(x: layout.width * left + w / 2, y: layout.launchY + 6 - w * aspect / 2)
    }
}

/// One piece of scenery, drifting from side to side.
private struct Deco: View {
    var d: Decoration
    var layout: SkyLayout
    @State private var drifted = false

    /// (width, aspect) from counting.css and the drawings' view boxes.
    private var box: (CGFloat, CGFloat) {
        switch d.art {
        case "cloud": ([90, 130, 170][max(0, d.size - 1)], 60 / 120)
        case "bird": (34, 20 / 40)
        case "hotAir": (84, 120 / 90)
        case "kite": (70, 110 / 70)
        case "plane": (150, 60 / 150)
        case "satellite": (120, 60 / 120)
        case "moon": (130, 1)
        case "ufo": (110, 60 / 110)
        case "saturn": (190, 120 / 200)
        case "comet": (140, 50 / 160)
        case "astronaut": (90, 110 / 90)
        case "galaxy": (180, 120 / 160)
        default:
            d.art.hasPrefix("balloon") ? (38, 90 / 40) : (90, 1) // planets
        }
    }

    var body: some View {
        let b = box
        let w = min(b.0, layout.width * 0.34)
        let h = w * b.1
        Image(d.art)
            .resizable()
            .frame(width: w, height: h)
            .opacity(d.art == "cloud" && d.size == 1 ? 0.85 : 1)
            .shadow(color: shadow, radius: d.art == "moon" ? 30 : 10, y: d.art == "moon" ? 0 : 6)
            .modifier(Flap(on: d.art == "bird"))
            .offset(x: drifted ? d.drift : 0)
            .position(x: layout.width * d.left / 100, y: layout.launchY - d.height * SkyLayout.step - h / 2)
            .onAppear {
                withAnimation(.easeInOut(duration: d.duration).repeatForever(autoreverses: true)) { drifted = true }
            }
    }

    private var shadow: Color {
        switch d.art {
        case "cloud": Color(red: 40 / 255, green: 90 / 255, blue: 160 / 255).opacity(0.15)
        case "moon": Color(red: 1, green: 240 / 255, blue: 190 / 255).opacity(0.6)
        default: .clear
        }
    }
}

/// Birds flap their wings.
private struct Flap: ViewModifier {
    var on: Bool
    @State private var down = false

    func body(content: Content) -> some View {
        if on {
            content
                .scaleEffect(x: 1, y: down ? 0.5 : 1)
                .onAppear { withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) { down = true } }
        } else {
            content
        }
    }
}

/// The rocket: bobs while flying, kicks up on every number, dances at the end.
private struct Rocket: View {
    var width: CGFloat
    var count: Int
    var fuel: Double
    var flying: Bool
    var celebrating: Bool
    @State private var kickAt = Date.distantPast

    var body: some View {
        let height = width * 200 / 120
        let flameW = width * 0.46
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            let m = motion(t: t, now: tl.date)
            ZStack(alignment: .top) {
                Image("flame")
                    .resizable()
                    .frame(width: flameW, height: flameW * 90 / 60)
                    // Flicker.
                    .scaleEffect(x: 1 - 0.14 * wave(t, 0.24), y: 1 + 0.12 * wave(t, 0.24), anchor: .top)
                    .shadow(color: Color(red: 1, green: 170 / 255, blue: 40 / 255).opacity(0.8), radius: 12)
                    .scaleEffect(x: m.flameX, y: m.flameY, anchor: .top)
                    .animation(.easeOut(duration: 0.25), value: flying)
                    .offset(y: height * 0.66)
                Image("rocket")
                    .resizable()
                    .frame(width: width, height: height)
                    .shadow(color: Color(red: 20 / 255, green: 30 / 255, blue: 80 / 255).opacity(0.25), radius: 14, y: 8)
            }
            .frame(width: width, height: height, alignment: .top)
            .scaleEffect(x: m.kickScaleX, y: m.kickScaleY)
            .rotationEffect(.degrees(m.angle))
            .offset(y: m.y)
        }
        .onChange(of: count) { old, new in if new > old { kickAt = Date() } }
    }

    /// 0 → 1 → 0, smoothly, once per `period`.
    private func wave(_ t: Double, _ period: Double) -> Double { (1 - cos(2 * .pi * t / period)) / 2 }

    private struct Motion {
        var y = 0.0, angle = 0.0, kickScaleX = 1.0, kickScaleY = 1.0, flameX = 0.0, flameY = 0.0
    }

    private func motion(t: Double, now: Date) -> Motion {
        var m = Motion()
        if celebrating {
            // Party: rock from side to side, hopping.
            let s = sin(2 * .pi * t / 0.9)
            m.angle = -12 * s
            m.y = -14 * abs(s)
            m.flameX = 1.1
            m.flameY = 1.1
        } else if flying {
            // Bob.
            let p = wave(t, 3.2)
            m.y = -4 + 10 * p
            m.angle = -1.5 + 3 * p
            m.flameX = 1
            m.flameY = 0.3 + 0.7 * max(0, min(1, fuel))
        }
        // Kick: up and stretched at 30% of half a second, then back.
        let k = now.timeIntervalSince(kickAt) / 0.5
        if flying && k < 1 {
            let a = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7
            let e = a * a * (3 - 2 * a)
            m.y -= 18 * e
            m.kickScaleX = 1 + 0.08 * e
            m.kickScaleY = 1 + 0.12 * e
            m.flameX = max(m.flameX, 1 + 0.25 * e)
            m.flameY = max(m.flameY, m.flameY + (1.45 - m.flameY) * e)
        }
        return m
    }
}

/// A star with the number, left behind at the height where it was said.
private struct NumberStar: View {
    var n: Int

    var body: some View {
        let side: Double = n % 2 == 1 ? 1 : -1
        ZStack {
            StarShape()
                .fill(Palette.count(n))
                .overlay(StarShape().stroke(.white, style: StrokeStyle(lineWidth: 6 * 78 / 100, lineJoin: .round)))
                .shadow(color: .black.opacity(0.15), radius: 0, y: 4)
            Text(String(n))
                .font(.digits(n >= 100 ? 19 : 25))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.22), radius: 0, y: 2)
                .offset(y: 4)
        }
        .frame(width: 78, height: 75)
        .rotationEffect(.degrees(side * Double(6 + (n % 4) * 3)))
    }
}

/// STAR_PATH from Sky.ts, in its 100 × 96 view box.
struct StarShape: Shape {
    private static let points: [(CGFloat, CGFloat)] = [
        (50, 4), (62, 36), (96, 37), (69, 58), (79, 92), (50, 72), (21, 92), (31, 58), (4, 37), (38, 36),
    ]

    func path(in rect: CGRect) -> Path {
        Path { p in
            for (i, (x, y)) in Self.points.enumerated() {
                let pt = CGPoint(x: rect.minX + x / 100 * rect.width, y: rect.minY + y / 96 * rect.height)
                if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            p.closeSubpath()
        }
    }
}

/// The sky's gradient, blending smoothly as the count changes.
private struct SkyBackground: View, Animatable {
    var count: Double
    var animatableData: Double {
        get { count }
        set { count = newValue }
    }

    var body: some View {
        let c = skyColors(at: count)
        LinearGradient(colors: [Color(c.top), Color(c.bottom)], startPoint: .top, endPoint: .bottom)
    }
}

/// Twinkling stars for space (the web's tiled star pattern, scattered).
private struct StarField: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 15)) { tl in
            let twinkle = 0.8 + 0.2 * cos(2 * .pi * tl.date.timeIntervalSinceReferenceDate / 6)
            Canvas { ctx, size in
                var rng = SkyRandom(seed: 7)
                let n = Int(size.width * size.height / 5000)
                for i in 0..<n {
                    let x = rng.next() * size.width
                    let y = rng.next() * size.height
                    let r = 1 + rng.next() * 0.9
                    if i % 9 == 0 {
                        // A small four-pointed sparkle in pale gold.
                        var p = Path()
                        let s = r * 4
                        p.move(to: CGPoint(x: x, y: y - s))
                        p.addLine(to: CGPoint(x: x + s * 0.25, y: y - s * 0.25))
                        p.addLine(to: CGPoint(x: x + s, y: y))
                        p.addLine(to: CGPoint(x: x + s * 0.25, y: y + s * 0.25))
                        p.addLine(to: CGPoint(x: x, y: y + s))
                        p.addLine(to: CGPoint(x: x - s * 0.25, y: y + s * 0.25))
                        p.addLine(to: CGPoint(x: x - s, y: y))
                        p.addLine(to: CGPoint(x: x - s * 0.25, y: y - s * 0.25))
                        p.closeSubpath()
                        ctx.fill(p, with: .color(Color(hex: 0xFFF6C4).opacity(twinkle)))
                    } else {
                        ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r)), with: .color(.white.opacity(twinkle)))
                    }
                }
            }
        }
    }
}
