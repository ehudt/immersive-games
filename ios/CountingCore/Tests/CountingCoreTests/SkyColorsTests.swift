import XCTest
@testable import CountingCore

/// The same cases as the "sky" tests in scenery.test.ts.
final class SkyColorsTests: XCTestCase {
    func testStaysADaySkyUntil150ThenDarkensIntoSpaceBy300() {
        XCTAssertEqual(skyColors(0).top, RGB(0x4FC3FF))
        XCTAssertEqual(skyColors(0).bottom, RGB(0xD6F3FF))
        XCTAssertEqual(skyColors(150).top, RGB(0x2A86E0))
        XCTAssertEqual(skyColors(150).bottom, RGB(0xA8DCFF))
        XCTAssertEqual(skyColors(300).top, RGB(0x060922))
        XCTAssertEqual(skyColors(500).bottom, RGB(0x1A1450))
    }

    func testBlendsBetweenStops() {
        // rgb(53,115,216) / rgb(212,206,232) and rgb(51,70,173) / rgb(205,143,202) on the web.
        XCTAssertEqual(skyColors(at: 167.5).top, RGB(0x3573D8))
        XCTAssertEqual(skyColors(at: 167.5).bottom, RGB(0xD4CEE8))
        XCTAssertEqual(skyColors(at: 202.5).top, RGB(0x3346AD))
        XCTAssertEqual(skyColors(at: 202.5).bottom, RGB(0xCD8FCA))
    }

    func testBringsOutTheStarsFrom150() {
        XCTAssertEqual([100.0, 150, 190, 230, 300].map { starsOpacity($0) }, [0, 0, 0.5, 1, 1])
    }
}
