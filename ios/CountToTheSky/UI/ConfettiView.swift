import CountingCore
import SwiftUI

/// Confetti bursts (a first cut of src/games/counting/Confetti.ts): `burst`
/// throws pieces up from the middle of the screen, then gravity takes over.
@Observable
final class Confetti {
    fileprivate struct Piece {
        var x, y, vx, vy, spin, angle: Double
        var color: Color
        var born: Date
    }

    /// Pieces in flight. Not observed: the canvas moves them while it draws.
    @ObservationIgnored fileprivate var pieces: [Piece] = []
    @ObservationIgnored fileprivate var lastUpdate = Date()
    /// Something is in the air, so the timeline must run.
    fileprivate private(set) var active = false

    /// `x`, `y` in 0...1 of the view.
    func burst(_ n: Int, x: Double = 0.5, y: Double = 0.45) {
        let now = Date()
        for _ in 0..<n {
            let a = Double.random(in: -.pi...0)
            let v = Double.random(in: 0.5...1.4)
            pieces.append(Piece(
                x: x, y: y, vx: cos(a) * v * 0.6, vy: sin(a) * v,
                spin: .random(in: -8...8), angle: .random(in: 0...(2 * .pi)),
                color: Palette.count(.random(in: 0..<countColors.count)), born: now
            ))
        }
        lastUpdate = now
        active = true
    }

    func clear() {
        pieces = []
        active = false
    }

    fileprivate func step(to now: Date) {
        let dt = min(0.05, now.timeIntervalSince(lastUpdate))
        lastUpdate = now
        for i in pieces.indices {
            pieces[i].vy += 1.6 * dt
            pieces[i].vx *= 1 - 0.8 * dt
            pieces[i].x += pieces[i].vx * dt
            pieces[i].y += pieces[i].vy * dt
            pieces[i].angle += pieces[i].spin * dt
        }
        pieces.removeAll { $0.y > 1.1 || now.timeIntervalSince($0.born) > 5 }
        // Stop the timeline after this frame, outside of drawing.
        if pieces.isEmpty && active { Task { @MainActor in if self.pieces.isEmpty { self.active = false } } }
    }
}

struct ConfettiView: View {
    let confetti: Confetti

    var body: some View {
        TimelineView(.animation(paused: !confetti.active)) { timeline in
            Canvas { ctx, size in
                confetti.step(to: timeline.date)
                for p in confetti.pieces {
                    var c = ctx
                    c.translateBy(x: p.x * size.width, y: p.y * size.height)
                    c.rotate(by: .radians(p.angle))
                    c.fill(Path(CGRect(x: -5, y: -3, width: 10, height: 6)), with: .color(p.color))
                }
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}
