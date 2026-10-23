import CoreText
import CountingCore
import SwiftUI

/// Colors and fonts from src/games/counting/counting.css.
enum Palette {
    static let plum = Color(hex: 0x2B2350)
    /// Secondary card text.
    static let sub = Color(hex: 0x4D4673)
    static let pink = Color(hex: 0xFF5D8F)
    static let sun = Color(hex: 0xFFB627)
    static let teal = Color(hex: 0x2EC4D6)
    static let buttonShadow = Color(hex: 0xC42D5E)
    static let secondary = Color(hex: 0xEEF1FF)
    static let secondaryShadow = Color(hex: 0xC6CBE8)

    static func count(_ n: Int) -> Color { Color(countColors[n % countColors.count]) }
}

extension Color {
    init(hex: UInt32) {
        self.init(RGB(hex))
    }

    init(_ c: RGB) {
        self.init(red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255)
    }
}

extension Font {
    /// Hebrew text: Varela Round, bundled.
    static func game(_ size: CGFloat) -> Font { .custom("Varela Round", size: size) }
    /// Big numbers: Fredoka, bundled (Latin digits only).
    static func digits(_ size: CGFloat) -> Font { .custom("Fredoka", size: size).weight(.bold) }
}

enum Fonts {
    /// Registers the bundled fonts, so no Info.plist list is needed.
    static func register() {
        for name in ["VarelaRound-Regular", "Fredoka"] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

/// The candy-pink button with a hard shadow, or the pale secondary one.
struct CandyButtonStyle: ButtonStyle {
    var secondary = false

    func makeBody(configuration: Configuration) -> some View {
        let down = configuration.isPressed
        configuration.label
            .font(.game(24).bold())
            .padding(.horizontal, 28)
            .padding(.vertical, 12)
            .foregroundStyle(secondary ? Palette.plum : .white)
            .background(
                Capsule().fill(
                    secondary
                        ? AnyShapeStyle(Palette.secondary)
                        : AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xFF86AB), Palette.pink, Color(hex: 0xF0457A)], startPoint: .top, endPoint: .bottom))
                )
            )
            .background(Capsule().fill(secondary ? Palette.secondaryShadow : Palette.buttonShadow).offset(y: down ? 2 : 5))
            .offset(y: down ? 3 : 0)
            .animation(.easeOut(duration: 0.08), value: down)
    }
}

/// The white rounded card the screens sit on, at most 560 pt wide.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 14) { content }
            .multilineTextAlignment(.center)
            .foregroundStyle(Palette.plum)
            .padding(24)
            .frame(maxWidth: 520)
            .background(RoundedRectangle(cornerRadius: 32).fill(.white.opacity(0.95)).shadow(color: .black.opacity(0.18), radius: 24, y: 10))
            .padding(.horizontal, 16)
    }
}

enum Strings {
    static let praise = ["כל הכבוד!", "מעולה!", "וואו!", "איזה יופי!", "מדהים!", "אלופים!", "יש!", "סחתיין!"]

    static let patience: [(Patience, String)] = [(.normal, "רגיל"), (.long, "ארוך"), (.xlong, "ארוך מאוד")]

    /// Title for the end screen, growing with the result.
    static func cheer(_ n: Int) -> String {
        if n >= 100 { return "אלופי העולם!" }
        if n >= 50 { return "פשוט מדהים!" }
        if n >= 20 { return "וואו, איזה יופי!" }
        if n >= 10 { return "כל הכבוד!" }
        return "יופי של ספירה!"
    }

    static func error(_ kind: SpeechErrorKind) -> String {
        switch kind {
        case .notAllowed: "צריך לאשר למשחק להשתמש במיקרופון ובזיהוי דיבור. פתחו את ההגדרות, אשרו, ונסו שוב."
        case .noMicrophone: "לא הצלחנו להפעיל את המיקרופון. נסו שוב."
        case .network: "זיהוי הדיבור צריך חיבור לאינטרנט. בדקו את החיבור ונסו שוב."
        case .language: "המכשיר הזה לא מזהה דיבור בעברית."
        case .other: "משהו השתבש בזיהוי הדיבור. נסו שוב."
        }
    }
}
