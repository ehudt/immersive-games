import CountingCore
import SwiftUI

/**
 * The sky the rocket climbs through (src/games/counting/Sky.ts, simplified):
 * every counted number lifts it one step and leaves a colored star behind,
 * the hills drop away and the sky darkens into space. The web's drawn
 * decorations (clouds, balloons, a plane, Saturn…) come in a later pass.
 */
struct SkyView: View {
    var count: Int
    var fuel: Double
    var flying: Bool
    var celebrating: Bool

    /// Points of climb per counted number.
    private let step: CGFloat = 64

    var body: some View {
        GeometryReader { geo in
            let colors = skyColors(count)
            let rocketY = geo.size.height * 0.76
            ZStack {
                LinearGradient(colors: [Color(colors.top), Color(colors.bottom)], startPoint: .top, endPoint: .bottom)
                    .animation(.easeInOut(duration: 1.2), value: count)
                StarField()
                    .opacity(count >= 60 ? 1 : 0)
                    .animation(.easeInOut(duration: 1.5), value: count >= 60)

                // Hills and launch pad, sinking as the rocket climbs.
                Hills()
                    .frame(height: geo.size.height * 0.22)
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .offset(y: CGFloat(count) * step)

                // The trail of numbers already counted, newest next to the rocket.
                ForEach(max(1, count - 14)...max(1, count), id: \.self) { n in
                    if n <= count {
                        NumberStar(n: n)
                            .position(
                                x: geo.size.width / 2 + (n % 2 == 0 ? 1 : -1) * min(110, geo.size.width * 0.22),
                                y: rocketY + CGFloat(count - n) * step + 20
                            )
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .animation(.spring(duration: 0.5), value: count)

                Rocket(fuel: flying ? fuel : 0.3, celebrating: celebrating)
                    .position(x: geo.size.width / 2, y: rocketY)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

private struct Rocket: View {
    var fuel: Double
    var celebrating: Bool
    @State private var bob = false

    var body: some View {
        VStack(spacing: -6) {
            Text("🚀")
                .font(.system(size: 72))
                .rotationEffect(.degrees(-45))
            Flame()
                .frame(width: 26, height: 44)
                .scaleEffect(x: 1, y: 0.3 + 0.7 * max(0, min(1, fuel)), anchor: .top)
                .animation(.easeOut(duration: 0.2), value: fuel)
        }
        .offset(y: bob ? -6 : 6)
        .scaleEffect(celebrating ? 1.2 : 1)
        .animation(.spring(duration: 0.6), value: celebrating)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.4).repeatForever()) { bob = true }
        }
    }
}

private struct Flame: View {
    var body: some View {
        Ellipse()
            .fill(LinearGradient(colors: [Palette.sun, Color(hex: 0xFF8A3D), .red.opacity(0)], startPoint: .top, endPoint: .bottom))
    }
}

private struct NumberStar: View {
    var n: Int

    var body: some View {
        ZStack {
            Image(systemName: "star.fill")
                .font(.system(size: n >= 100 ? 58 : 50))
                .foregroundStyle(Palette.count(n))
                .shadow(color: .black.opacity(0.15), radius: 2, y: 2)
            Text(String(n))
                .font(.digits(n >= 100 ? 15 : 18))
                .foregroundStyle(.white)
                .offset(y: 2)
        }
        .rotationEffect(.degrees(Double((n % 2 == 0 ? 1 : -1) * (6 + (n % 4) * 3))))
    }
}

private struct Hills: View {
    var body: some View {
        ZStack(alignment: .bottom) {
            Ellipse().fill(Color(hex: 0x8BD96B)).scaleEffect(x: 1.6, y: 1).offset(x: -120, y: 60)
            Ellipse().fill(Color(hex: 0x6CC655)).scaleEffect(x: 1.6, y: 1).offset(x: 140, y: 80)
            // Launch pad.
            RoundedRectangle(cornerRadius: 6).fill(Color(hex: 0x7A7F99)).frame(width: 120, height: 16).offset(y: -40)
        }
        .clipped()
    }
}

private struct StarField: View {
    var body: some View {
        Canvas { ctx, size in
            var rng = SeededRandom(seed: 7)
            for _ in 0..<90 {
                let p = CGPoint(x: rng.next() * size.width, y: rng.next() * size.height)
                let r = 0.6 + rng.next() * 1.4
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .color(.white.opacity(0.8)))
            }
        }
    }
}

/// A small deterministic generator, so the stars stay put between redraws.
struct SeededRandom {
    private var state: UInt64

    init(seed: UInt64) { state = seed &* 0x9E37_79B9_7F4A_7C15 }

    mutating func next() -> CGFloat {
        state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        return CGFloat(state >> 11) / CGFloat(1 << 53)
    }
}
