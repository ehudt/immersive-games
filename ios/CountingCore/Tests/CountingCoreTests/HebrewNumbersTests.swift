// Port of src/core/speech/hebrewNumbers.test.ts.
import XCTest
@testable import CountingCore

final class ParseNumbersTests: XCTestCase {
    func testReadsDigits() {
        XCTAssertEqual(parseNumbers("1 2 3"), [1, 2, 3])
        XCTAssertEqual(parseNumbers("1, 2, 3."), [1, 2, 3])
        XCTAssertEqual(parseNumbers("99 100 101"), [99, 100, 101])
    }

    func testSplitsGluedDigitRunsWhenTheyCountUp() {
        XCTAssertEqual(parseNumbers("123"), [1, 2, 3])
        XCTAssertEqual(parseNumbers("91011", last: 8), [9, 10, 11])
        // A real number that is also the next count stays whole.
        XCTAssertEqual(parseNumbers("12", last: 11), [12])
        XCTAssertEqual(parseNumbers("123", last: 122), [123])
        XCTAssertEqual(parseNumbers("123 124", last: 122), [123, 124])
    }

    func testSplitsGluedRunsThatResendNumbersAlreadyCounted() {
        XCTAssertEqual(parseNumbers("\u{200F}123", last: 2), [1, 2, 3])
        XCTAssertEqual(parseNumbers("1233", last: 2), [1, 2, 3, 3])
        XCTAssertEqual(parseNumbers("12345", last: 3), [1, 2, 3, 4, 5])
        XCTAssertEqual(parseNumbers("אחת2 3", last: 1), [1, 2, 3])
    }

    func testKeepsASkipInsideAGluedRun() {
        XCTAssertEqual(parseNumbers("\u{200F}1234568", last: 6), [1, 2, 3, 4, 5, 6, 8])
        XCTAssertEqual(parseNumbers("12345689", last: 6), [1, 2, 3, 4, 5, 6, 8, 9])
    }

    func testReads19AsNineTenWhereThoseComeNext() {
        XCTAssertEqual(parseNumbers("19", last: 8), [9, 10])
        XCTAssertEqual(parseNumbers("19", last: 9), [9, 10])
        XCTAssertEqual(parseNumbers("\u{200F}12345678 19", last: 9), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        XCTAssertEqual(parseNumbers("\u{200F}1234567819", last: 9), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        XCTAssertEqual(parseNumbers("\u{200F}123456781911", last: 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
        XCTAssertEqual(parseNumbers("19", last: 18), [19])
        XCTAssertEqual(parseNumbers("18 19", last: 17), [18, 19])
    }

    func testLeavesOrdinaryNumbersWhole() {
        XCTAssertEqual(parseNumbers("15", last: 14), [15])
        XCTAssertEqual(parseNumbers("25", last: 24), [25])
        XCTAssertEqual(parseNumbers("1011", last: 9), [10, 11])
        XCTAssertEqual(parseNumbers("2021", last: 19), [20, 21])
        XCTAssertEqual(parseNumbers("100101", last: 99), [100, 101])
        XCTAssertEqual(parseNumbers("124", last: 123), [124])
    }

    func testReadsFeminineAndMasculineUnits() {
        XCTAssertEqual(parseNumbers("אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר"), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        XCTAssertEqual(parseNumbers("אחד שניים שלושה ארבעה חמישה שישה שבעה שמונה תשעה עשרה"), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    }

    func testReadsTeens() {
        XCTAssertEqual(parseNumbers("אחת עשרה", last: 10), [11])
        XCTAssertEqual(parseNumbers("שתים עשרה שלוש עשרה", last: 11), [12, 13])
        XCTAssertEqual(parseNumbers("חמישה עשר", last: 14), [15])
        XCTAssertEqual(parseNumbers("תשע עשרה", last: 18), [19])
    }

    func testResolvesNineTenFromContext() {
        XCTAssertEqual(parseNumbers("שמונה תשע עשר", last: 7), [8, 9, 10])
        XCTAssertEqual(parseNumbers("שמונה עשרה תשע עשרה", last: 17), [18, 19])
        XCTAssertEqual(parseNumbers("תשע עשר אחת עשרה", last: 8), [9, 10, 11])
    }

    func testReadsTensWithAnd() {
        XCTAssertEqual(parseNumbers("עשרים", last: 19), [20])
        XCTAssertEqual(parseNumbers("עשרים ואחת", last: 20), [21])
        XCTAssertEqual(parseNumbers("עשרים עשרים ואחת עשרים ושתיים", last: 19), [20, 21, 22])
        XCTAssertEqual(parseNumbers("תשעים ותשע", last: 98), [99])
        XCTAssertEqual(parseNumbers("עשרים ו-3", last: 22), [23])
        XCTAssertEqual(parseNumbers("20 ו-1", last: 20), [21])
    }

    func testKeepsAWrongDecadeAsWritten() {
        // After 29 a child says "עשרים ועשר": that is 20 and 10, not 30.
        XCTAssertEqual(parseNumbers("עשרים ותשע עשרים ועשר", last: 28), [29, 20, 10])
    }

    func testReadsASkippedNumberAsTheNumberSaid() {
        XCTAssertEqual(parseNumbers("עשרים ואחת", last: 19), [21])
        XCTAssertEqual(parseNumbers("אחת עשרה שתים עשרה ארבע עשרה", last: 10), [11, 12, 14])
    }

    func testReadsHundredsAndThousands() {
        XCTAssertEqual(parseNumbers("מאה", last: 99), [100])
        XCTAssertEqual(parseNumbers("מאה ואחת", last: 100), [101])
        XCTAssertEqual(parseNumbers("מאה ועשר", last: 109), [110])
        XCTAssertEqual(parseNumbers("מאה ושתים עשרה", last: 111), [112])
        XCTAssertEqual(parseNumbers("מאה עשרים ושלוש", last: 122), [123])
        XCTAssertEqual(parseNumbers("מאתיים", last: 199), [200])
        XCTAssertEqual(parseNumbers("שלוש מאות חמישים וחמש", last: 354), [355])
        XCTAssertEqual(parseNumbers("אלף", last: 999), [1000])
        XCTAssertEqual(parseNumbers("אלף ואחת", last: 1000), [1001])
        XCTAssertEqual(parseNumbers("שלושת אלפים מאתיים", last: 3199), [3200])
        XCTAssertEqual(parseNumbers("1,000 1,001", last: 999), [1000, 1001])
    }

    func testIgnoresOtherWordsAndNiqqud() {
        XCTAssertEqual(parseNumbers("אממ אחת, שתיים... שָׁלוֹשׁ!"), [1, 2, 3])
        XCTAssertEqual(parseNumbers("שלום מה נשמע"), [])
    }

    func testHandlesCumulativeTranscripts() {
        XCTAssertEqual(parseNumbers("אחת אחת שתיים אחת שתיים שלוש"), [1, 1, 2, 1, 2, 3])
    }
}

final class SoundAlikeTests: XCTestCase {
    func testAcceptsMisheardOrLispedWordsThatContinueTheCount() {
        XCTAssertEqual(parseNumbers("תשע אשר", last: 8), [9, 10])
        XCTAssertEqual(parseNumbers("סלוס", last: 2), [3])
        XCTAssertEqual(parseNumbers("ארבה חמס סס", last: 3), [4, 5, 6])
        XCTAssertEqual(parseNumbers("עסרים ואחת", last: 20), [21])
        XCTAssertEqual(parseNumbers("את שתיים", last: 0), [1, 2])
        XCTAssertEqual(parseNumbers("שיר", last: 9), [10])
    }

    func testAcceptsWordsOneSoundAway() {
        XCTAssertEqual(parseNumbers("שלום", last: 2), [3])
        XCTAssertEqual(parseNumbers("אחת שתיים שלום ארבע"), [1, 2, 3, 4])
        XCTAssertEqual(parseNumbers("שתיים שלו", last: 1), [2, 3])
        XCTAssertEqual(parseNumbers("שמונא", last: 7), [8])
        // "שלום" is close to both 3 and 30: whichever comes next.
        XCTAssertEqual(parseNumbers("שלום", last: 29), [30])
        XCTAssertEqual(parseNumbers("שלום", last: 5), [])
    }

    func testNeverReadsThemAsAWrongNumber() {
        // "רבה" sounds like 4, but after 2 it is just a word.
        XCTAssertEqual(parseNumbers("תודה רבה", last: 2), [])
        XCTAssertEqual(parseNumbers("שיר", last: 3), [])
    }

    func testMeasuresOneEdit() {
        XCTAssertTrue(oneEditApart("שלמ", "שלש"))
        XCTAssertTrue(oneEditApart("של", "שלש"))
        XCTAssertTrue(oneEditApart("שלשמ", "שלש"))
        XCTAssertFalse(oneEditApart("שמ", "שלש"))
        XCTAssertFalse(oneEditApart("כמש", "שלש"))
    }

    func testGivesSoundKeys() {
        XCTAssertEqual(soundKey("עשר"), soundKey("אשר"))
        XCTAssertEqual(soundKey("שלוש"), soundKey("שלש"))
        XCTAssertEqual(soundKey("שתיים"), soundKey("סתים"))
    }
}

final class SplitConsecutiveTests: XCTestCase {
    func testSplitsOnlyCountingRuns() {
        XCTAssertEqual(splitConsecutive("1234"), [1, 2, 3, 4])
        XCTAssertEqual(splitConsecutive("99100"), [99, 100])
        XCTAssertEqual(splitConsecutive("1233"), [1, 2, 3, 3])
        XCTAssertEqual(splitConsecutive("1234568"), [1, 2, 3, 4, 5, 6, 8])
        XCTAssertNil(splitConsecutive("15"))
        XCTAssertNil(splitConsecutive("7"))
    }
}
