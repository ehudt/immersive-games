import SwiftUI

/// Confetti, sparkles and fireworks (src/games/counting/Confetti.ts). The
/// timeline only runs while there are particles.
@Observable
final class Confetti {
    fileprivate enum ParticleShape { case rect, star, dot }

    fileprivate struct Particle {
        var x, y, vx, vy: Double
        var life = 0.0
        var maxLife, size: Double
        var color: Color
        var spin = (Double.random(in: 0..<1) - 0.5) * 12
        var angle = Double.random(in: 0..<1) * .pi
        var shape: ParticleShape
        var gravity, drag: Double
    }

    private static let colors: [Color] = ([0xFF5D8F, 0xFFB627, 0x2EC4D6, 0x7BD35A, 0xA374FF, 0xFF8A3D, 0xFFFFFF, 0xFFE066] as [UInt32]).map { Color(hex: $0) }

    /// Particles in flight. Not observed: the canvas moves them while it draws.
    @ObservationIgnored fileprivate var parts: [Particle] = []
    @ObservationIgnored fileprivate var last = Date()
    /// The view's size, in points (set by the view).
    @ObservationIgnored var size = CGSize(width: 390, height: 844)
    @ObservationIgnored private var timers: [Task<Void, Never>] = []
    /// Something is in the air, so the timeline must run.
    fileprivate private(set) var active = false

    private static func rnd() -> Double { .random(in: 0..<1) }
    private static func color() -> Color { colors.randomElement()! }

    /// Small sparkle puff (each counted number).
    func sparkle(x: Double, y: Double, n: Int = 14) {
        for _ in 0..<n {
            let a = Self.rnd() * .pi * 2
            let v = 80 + Self.rnd() * 220
            add(Particle(x: x, y: y, vx: cos(a) * v, vy: sin(a) * v, maxLife: 0.6 + Self.rnd() * 0.4, size: 4 + Self.rnd() * 5,
                         color: Self.color(), shape: Self.rnd() < 0.5 ? .star : .dot, gravity: 120, drag: 2.5))
        }
    }

    /// Confetti cannons from both bottom corners.
    func burst(_ n: Int = 90) {
        let w = size.width, h = size.height
        for i in 0..<n {
            let left = i % 2 == 0
            let a = (left ? -Double.pi / 3 : -2 * Double.pi / 3) + (Self.rnd() - 0.5) * 0.7
            let v = h * (0.9 + Self.rnd() * 0.8)
            add(Particle(x: left ? 0 : w, y: h, vx: cos(a) * v, vy: sin(a) * v, maxLife: 2.6 + Self.rnd(), size: 7 + Self.rnd() * 7,
                         color: Self.color(), shape: .rect, gravity: 520, drag: 1.4))
        }
    }

    /// Confetti falling from the top for a while.
    func rain(_ seconds: Double) {
        let count = Int(seconds * 12)
        for i in 0..<count {
            later(Double(i) * seconds / Double(count)) { [weak self] in
                guard let self else { return }
                for _ in 0..<4 {
                    self.add(Particle(x: Self.rnd() * self.size.width, y: -20, vx: (Self.rnd() - 0.5) * 60, vy: 60 + Self.rnd() * 80,
                                      maxLife: 6, size: 7 + Self.rnd() * 6, color: Self.color(),
                                      shape: Self.rnd() < 0.8 ? .rect : .star, gravity: 40, drag: 0.6))
                }
            }
        }
    }

    /// A few fireworks bursting over the sky.
    func fireworks(_ count: Int) {
        for i in 0..<count {
            later(Double(i) * 0.38 + Self.rnd() * 0.2) { [weak self] in
                guard let self else { return }
                let x = self.size.width * (0.15 + Self.rnd() * 0.7)
                let y = self.size.height * (0.12 + Self.rnd() * 0.35)
                let color = Self.colors[Int(Self.rnd() * Double(Self.colors.count - 1))]
                for k in 0..<46 {
                    let a = Double(k) / 46 * .pi * 2
                    let v = 160 + Self.rnd() * 90
                    self.add(Particle(x: x, y: y, vx: cos(a) * v, vy: sin(a) * v, maxLife: 1.2 + Self.rnd() * 0.5,
                                      size: 3.5 + Self.rnd() * 2.5, color: color, shape: .dot, gravity: 90, drag: 1.6))
                }
            }
        }
    }

    func clear() {
        parts = []
        timers.forEach { $0.cancel() }
        timers = []
        active = false
    }

    private func later(_ seconds: Double, _ fn: @escaping @MainActor () -> Void) {
        timers.append(Task { @MainActor in
            try? await Task.sleep(for: .seconds(seconds))
            if !Task.isCancelled { fn() }
        })
    }

    private func add(_ p: Particle) {
        if parts.isEmpty { last = Date() }
        parts.append(p)
        if !active { active = true }
    }

    fileprivate func step(to now: Date) {
        let dt = min(0.05, max(0, now.timeIntervalSince(last)))
        last = now
        let bottom = size.height + 40
        parts = parts.compactMap { p in
            var p = p
            p.life += dt
            guard p.life < p.maxLife && p.y < bottom else { return nil }
            let k = exp(-p.drag * dt)
            p.vx *= k
            p.vy = p.vy * k + p.gravity * dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.angle += p.spin * dt
            return p
        }
        // Stop the timeline after this frame, outside of drawing.
        if parts.isEmpty && active { Task { @MainActor in if self.parts.isEmpty { self.active = false } } }
    }
}

struct ConfettiView: View {
    let confetti: Confetti

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation(paused: !confetti.active)) { timeline in
                Canvas { ctx, _ in
                    confetti.step(to: timeline.date)
                    for p in confetti.parts {
                        var c = ctx
                        c.opacity = min(1, 2.5 * (1 - p.life / p.maxLife))
                        c.translateBy(x: p.x, y: p.y)
                        c.rotate(by: .radians(p.angle))
                        let shading = GraphicsContext.Shading.color(p.color)
                        switch p.shape {
                        case .rect:
                            let h = p.size / 2 + abs(sin(p.angle * 2)) * p.size * 0.4
                            c.fill(Path(CGRect(x: -p.size / 2, y: -p.size / 4, width: p.size, height: h)), with: shading)
                        case .dot:
                            c.fill(Path(ellipseIn: CGRect(x: -p.size / 2, y: -p.size / 2, width: p.size, height: p.size)), with: shading)
                        case .star:
                            c.fill(star(p.size), with: shading)
                        }
                    }
                }
            }
            .onAppear { confetti.size = geo.size }
            .onChange(of: geo.size) { _, s in confetti.size = s }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityHidden(true)
    }

    private func star(_ size: Double) -> Path {
        let r = size / 2
        return Path { p in
            for i in 0..<10 {
                let a = Double(i) / 10 * .pi * 2 - .pi / 2
                let rr = i % 2 == 1 ? r * 0.45 : r
                let pt = CGPoint(x: cos(a) * rr, y: sin(a) * rr)
                if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            p.closeSubpath()
        }
    }
}
