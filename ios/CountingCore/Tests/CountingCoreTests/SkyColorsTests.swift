import XCTest
@testable import CountingCore

final class SkyColorsTests: XCTestCase {
    func testStartsBlueAndEndsInSpace() {
        XCTAssertEqual(skyColors(0).top, RGB(0x4FC3FF))
        XCTAssertEqual(skyColors(100).top, RGB(0x060922))
        XCTAssertEqual(skyColors(500).bottom, RGB(0x1A1450))
    }

    func testBlendsBetweenStops() {
        // Halfway from 42 to 58: rgb(59,79,180) on the web.
        XCTAssertEqual(skyColors(50).top, RGB(0x3B4FB4))
    }
}
