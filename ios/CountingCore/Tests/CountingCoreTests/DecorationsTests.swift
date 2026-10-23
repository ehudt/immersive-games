import XCTest
@testable import CountingCore

/// Expected values come from running the web's rng() and decorate() in Node.
final class DecorationsTests: XCTestCase {
    func testRandomMatchesTheWeb() {
        for (seed, expected) in [(1, [0.546456075739, 0.459556290414, 0.247041697381]),
                                 (76, [0.912817906123, 0.524295408512, 0.279152756091]),
                                 (150, [0.843574318802, 0.755147115560, 0.167172738817])] {
            var r = SkyRandom(seed: seed)
            for e in expected { XCTAssertEqual(r.next(), e, accuracy: 1e-11, "seed \(seed)") }
        }
    }

    func testPlacesTheSameSceneryAsTheWeb() {
        let cases: [(Int, String, Int, Double, Double, Double, Double)] = [
            (5, "cloud", 3, 3.002464, 0.117124, -29.892502, 7.920195),
            (6, "kite", 0, 11.102487, 0.627812, -22.511149, 11.896003),
            (20, "cloud", 2, 81.702025, 0.876567, -18.753951, 10.198025),
            (107, "planet4", 0, 74.300077, 0.077264, -7.696497, 7.846476),
            (110, "planet3", 0, 15.868053, 0.357739, -7.130897, 10.404107),
            (124, "astronaut", 0, 23.878417, 0.515012, -6.179050, 11.729043),
        ]
        for (n, art, size, left, lift, drift, duration) in cases {
            let d = decorations(at: n)
            XCTAssertEqual(d.count, 1, "n=\(n)")
            guard let d = d.first else { continue }
            XCTAssertEqual(d.art, art, "n=\(n)")
            XCTAssertEqual(d.size, size, "n=\(n)")
            XCTAssertEqual(d.left, left, accuracy: 1e-5, "n=\(n)")
            XCTAssertEqual(d.height, Double(n) + lift, accuracy: 1e-5, "n=\(n)")
            XCTAssertEqual(d.drift, drift, accuracy: 1e-5, "n=\(n)")
            XCTAssertEqual(d.duration, duration, accuracy: 1e-5, "n=\(n)")
        }
        // Bands with nothing in them.
        XCTAssertEqual(decorations(at: 9), [])
        XCTAssertEqual(decorations(at: 70), [])
    }
}
