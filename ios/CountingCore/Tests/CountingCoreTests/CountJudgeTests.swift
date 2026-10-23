// Port of src/games/counting/CountJudge.test.ts.
import XCTest
@testable import CountingCore

private func heard(_ counted: [Int], _ wrong: Int? = nil) -> Heard { Heard(counted: counted, wrong: wrong) }

final class CountJudgeTests: XCTestCase {
    func testCountsAlongInterimAndFinalResults() {
        let j = CountJudge()
        XCTAssertEqual(j.hear(["אחת"], final: false).counted, [1])
        XCTAssertEqual(j.hear(["אחת שתיים"], final: false).counted, [2])
        XCTAssertEqual(j.hear(["אחת שתיים שלוש"], final: true).counted, [3])
        XCTAssertEqual(j.count, 3)
    }

    func testIgnoresEchoesOfCumulativeTranscripts() {
        let j = CountJudge()
        for t in ["1", "1 2", "1 2 3", "1 2 3 4"] { XCTAssertNil(j.hear([t], final: true).wrong) }
        XCTAssertEqual(j.count, 4)
    }

    func testReportsASkippedNumberOnlyWhenFinal() {
        let j = CountJudge()
        j.hear(["אחת שתיים שלוש"], final: true)
        XCTAssertEqual(j.hear(["חמש"], final: false), heard([]))
        XCTAssertEqual(j.hear(["חמש"], final: true), heard([], 5))
        XCTAssertEqual(j.count, 3)
    }

    func testCatchesAWrongDecade() {
        let j = CountJudge()
        j.count = 28
        XCTAssertEqual(j.hear(["עשרים ותשע"], final: true).counted, [29])
        // "עשרים ועשר" is 20 then 10 — already said, so ignored; the timer ends it.
        XCTAssertEqual(j.hear(["עשרים ועשר"], final: true), heard([]))
        XCTAssertEqual(j.hear(["ארבעים"], final: true).wrong, 40)
    }

    func testCountsThroughTheNineTenElevenAndNineteenTwentyAmbiguities() {
        let j = CountJudge()
        j.hear(["אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר אחת עשרה"], final: true)
        XCTAssertEqual(j.count, 11)
        j.hear(["שתים עשרה שלוש עשרה ארבע עשרה חמש עשרה שש עשרה שבע עשרה שמונה עשרה תשע עשרה עשרים"], final: true)
        XCTAssertEqual(j.count, 20)
    }

    func testForgivesAClippedFirstWord() {
        XCTAssertEqual(CountJudge().hear(["שתיים שלוש"], final: true).counted, [1, 2, 3])
    }

    func testForgivesOneNumberLostWhenTheRecognizerRestarts() {
        let j = CountJudge()
        j.hear(["1 2 3 4 5"], final: true)
        // Same session: a skip is a mistake.
        XCTAssertEqual(CountJudge().hear(["1 2 3 5"], final: true).wrong, 5)
        j.newSession()
        XCTAssertEqual(j.hear(["שבע שמונה"], final: true), heard([6, 7, 8]))
        // Only the first number of the session, and only one.
        XCTAssertEqual(j.hear(["עשר"], final: true).wrong, 10)
        j.newSession()
        XCTAssertEqual(j.hear(["אחת עשרה"], final: true).wrong, 11)
    }

    func testTreatsALowConfidenceWrongNumberAsMisheard() {
        let j = CountJudge()
        j.hear(["1 2 3"], final: true, confidence: 0.9)
        XCTAssertEqual(j.hear(["שבע"], final: true, confidence: 0.3), heard([]))
        XCTAssertEqual(j.hear(["שבע"], final: true, confidence: 0.8).wrong, 7)
        // 0 means the recognizer didn't say: judge normally.
        XCTAssertEqual(j.hear(["שבע"], final: true, confidence: 0).wrong, 7)
    }

    func testFollowsTheIPhoneLog() {
        let j = CountJudge()
        let steps: [([String], Bool, Double, [Int])] = [
            (["\u{200F}אחרת"], false, 0, []),
            (["\u{200F}אחת", "\u{200F}אכלת", "\u{200F}אחרת"], true, 0.21, [1]),
            (["\u{200F}אחת"], false, 0, []),
            (["\u{200F}אחת ש"], false, 0, []),
            (["\u{200F}אחת שתיים"], false, 0, [2]),
            (["\u{200F}אחת2 ש"], false, 0, []),
            (["\u{200F}123"], false, 0, [3]),
            (["\u{200F}123 ש"], false, 0, []),
            (["\u{200F}1233"], false, 0, []),
            (["\u{200F}1233"], true, 0.98, []),
            (["\u{200F}12334"], false, 0, [4]),
        ]
        for (alts, isFinal, conf, counted) in steps {
            XCTAssertEqual(j.hear(alts, final: isFinal, confidence: conf), heard(counted), "\(alts)")
        }
        XCTAssertEqual(j.count, 4)
    }

    func testFollowsTheSecondIPhoneLog() {
        let j = CountJudge()
        let steps: [(String, [Int])] = [
            ("\u{200F}אחד", [1]),
            ("\u{200F}אחד ש", []),
            ("\u{200F}אחד שתיים", [2]),
            ("\u{200F}123", [3]),
            ("\u{200F}1234", [4]),
            ("\u{200F}12345", [5]),
            ("\u{200F}123456", [6]),
            ("\u{200F}123456 ש", []),
            ("\u{200F}1234568", []),
        ]
        for (text, counted) in steps { XCTAssertEqual(j.hear([text], final: false), heard(counted), text) }
        // 7 was skipped: caught as soon as the recognizer finalizes it.
        XCTAssertEqual(j.hear(["\u{200F}1234568"], final: true, confidence: 0.99), heard([], 8))
    }

    func testCounts10WhenIOSWritesNineTenAs19() {
        for (count, text) in [(8, "19"), (9, "19"), (8, "\u{200F}12345678 19"), (9, "\u{200F}1234567819")] {
            let j = CountJudge()
            j.hear([(1...count).map(String.init).joined(separator: " ")], final: true)
            XCTAssertNil(j.hear([text], final: true, confidence: 0.9).wrong, text)
            XCTAssertEqual(j.count, 10, text)
        }
    }

    func testFollowsTheThirdIPhoneLog() {
        let j = CountJudge()
        let steps: [(String, Bool, Double, [Int])] = [
            ("\u{200F}אחת", false, 0, [1]),
            ("\u{200F}אחת ש", false, 0, []),
            ("\u{200F}אחת שתיים", false, 0, [2]),
            ("\u{200F}אחת2 ש", false, 0, []),
            ("\u{200F}123", false, 0, [3]),
            ("\u{200F}1234", false, 0, [4]),
            ("\u{200F}12345", false, 0, [5]),
            ("\u{200F}123456", false, 0, [6]),
            ("\u{200F}1234567", false, 0, [7]),
            ("\u{200F}1234567 ש", false, 0, []),
            ("\u{200F}12345678", false, 0, [8]),
            ("\u{200F}123456789", false, 0, [9]),
            ("\u{200F}12345678 19", false, 0, [10]),
            ("\u{200F}12345678 19:10", false, 0, []),
            ("\u{200F}12345678 19:10", true, 0.97, []),
            ("\u{200F}12345678 19:10 11", false, 0, [11]),
        ]
        for (text, isFinal, conf, counted) in steps {
            XCTAssertEqual(j.hear([text], final: isFinal, confidence: conf), heard(counted), text)
        }
    }

    func testIgnoresImpossibleWrongNumbersButNotNearSlips() {
        let j = CountJudge()
        j.count = 2
        XCTAssertNil(j.hear(["1999"], final: true).wrong)
        j.count = 29
        XCTAssertEqual(j.hear(["ארבעים"], final: true).wrong, 40)
    }

    func testPicksTheAlternativeThatFitsTheCount() {
        let j = CountJudge()
        j.count = 5
        XCTAssertEqual(j.hear(["שבע", "שש"], final: true), heard([6]))
    }

    func testGivesMoreTimeForTheFirstAndForLongNumbers() {
        XCTAssertGreaterThan(patienceMs(0), patienceMs(5))
        XCTAssertGreaterThan(patienceMs(150), patienceMs(5))
        XCTAssertGreaterThan(patienceMs(5, .xlong), patienceMs(5, .normal))
        XCTAssertEqual(patienceMs(5), 12000)
    }
}
