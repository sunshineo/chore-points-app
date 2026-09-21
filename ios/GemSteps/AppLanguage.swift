import SwiftUI

enum AppLanguage: String, CaseIterable {
    case chinese, english

    static let preferenceKey = "interfaceLanguage"

    static func initial(preferredLanguages: [String] = Locale.preferredLanguages) -> AppLanguage {
        let primary = preferredLanguages.first ?? "en"
        return Locale(identifier: primary).language.languageCode?.identifier == "zh" ? .chinese : .english
    }

    @discardableResult
    static func initializePreference(in defaults: UserDefaults = .standard,
                                     preferredLanguages: [String] = Locale.preferredLanguages) -> AppLanguage {
        if let saved = defaults.string(forKey: preferenceKey), let language = AppLanguage(rawValue: saved) {
            return language
        }
        let language = initial(preferredLanguages: preferredLanguages)
        defaults.set(language.rawValue, forKey: preferenceKey)
        return language
    }

    func locale() -> Locale {
        Locale(identifier: self == .chinese ? "zh-Hans" : "en")
    }

}

extension Locale {
    func interfaceText(_ value: String.LocalizationValue) -> String {
        let language = language.languageCode?.identifier == "zh" ? "zh-Hans" : "en"
        let bundle = Bundle.main.path(forResource: language, ofType: "lproj")
            .flatMap { Bundle(path: $0) } ?? .main
        return String(localized: value, bundle: bundle, locale: self)
    }
}

struct LanguageMenu: View {
    @AppStorage(AppLanguage.preferenceKey) private var preference = AppLanguage.english.rawValue

    var body: some View {
        Menu {
            Picker(selection: $preference) {
                Text(verbatim: "简体中文").tag(AppLanguage.chinese.rawValue)
                Text(verbatim: "English").tag(AppLanguage.english.rawValue)
            } label: {
                Text(verbatim: "语言 / Language")
            }
        } label: {
            Image(systemName: "globe")
                .font(.title3)
                .frame(width: 44, height: 44)
        }
        .accessibilityLabel(Text(verbatim: "语言 / Language"))
        .accessibilityIdentifier("language-menu")
    }
}
