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
        // The same cases as scenery.test.ts: n, art, size, width, left, height, drift, duration.
        let cases: [(Int, String, Int, Double, Double, Double, Double, Double)] = [
            (5, "cloud", 3, 0, 3.002464, 5.117124, -29.892502, 7.920195),
            (7, "bird", 0, 0, 75.00568, 7.851375, -27.827253, 6.117855),
            (10, "redBalloon", 0, 56, 81.641881, 10.89521, -4.095564, 7.951394),
            (90, "dragon", 0, 180, 79.156703, 91.085213, -5.595521, 6.944731),
            (169, "comet", 0, 0, 21.584544, 169.80121, 21.208634, 10.72742),
            (183, "planet3", 0, 0, 72.284889, 183.34251, 27.378021, 10.540636),
            (300, "sun", 0, 170, 77.636212, 301.128624, -7.101167, 6.76509),
        ]
        for (n, art, size, width, left, height, drift, duration) in cases {
            let d = decorations(at: n)
            XCTAssertEqual(d.count, 1, "n=\(n)")
            guard let d = d.first else { continue }
            XCTAssertEqual(d.art, art, "n=\(n)")
            XCTAssertEqual(d.size, size, "n=\(n)")
            XCTAssertEqual(d.width, width, "n=\(n)")
            XCTAssertEqual(d.left, left, accuracy: 1e-5, "n=\(n)")
            XCTAssertEqual(d.height, height, accuracy: 1e-5, "n=\(n)")
            XCTAssertEqual(d.drift, drift, accuracy: 1e-5, "n=\(n)")
            XCTAssertEqual(d.duration, duration, accuracy: 1e-5, "n=\(n)")
        }
        // Bands with nothing in them.
        XCTAssertEqual(decorations(at: 9), [])
        XCTAssertEqual(decorations(at: 47), [])
        XCTAssertEqual(decorations(at: 301), [])
    }

    func testHasAFriendEveryTenNumbersUpToThreeHundred() {
        XCTAssertEqual(milestones.map(\.count), Array(stride(from: 10, through: 300, by: 10)))
        XCTAssertEqual(Set(milestones.map(\.art)).count, 30)
        XCTAssertEqual(milestones.prefix(9).map(\.art),
                       ["redBalloon", "kite", "songbird", "rcPlane", "eagle", "hotAir", "cessna", "helicopter", "dragon"])
        XCTAssertEqual(milestone(at: 90)?.art, "dragon")
        XCTAssertNil(milestone(at: 95))
        XCTAssertNil(milestone(at: 310))
        for m in milestones {
            XCTAssertGreaterThanOrEqual(decorations(at: m.count)[0].left, 77)
            for d in decorations(at: m.count - 1) + decorations(at: m.count + 1) { XCTAssertLessThan(d.left, 25, "n=\(m.count)") }
        }
    }
}
