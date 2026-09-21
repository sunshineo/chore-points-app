import SwiftUI

@main
struct GemStepsApp: App {
    @AppStorage(AppLanguage.preferenceKey) private var languagePreference = AppLanguage.english.rawValue
    @State private var state: AppState?
    @State private var openFailed = false

    init() {
        AppLanguage.initializePreference()
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if let state { PointsView(state: state) }
                else if openFailed {
                    ContentUnavailableView("Unable to load points", systemImage: "externaldrive.badge.exclamationmark",
                                           description: Text("Please reopen the app. Your existing data has not been deleted."))
                } else { ProgressView().accessibilityLabel("Loading points") }
            }
            .environment(\.locale, (AppLanguage(rawValue: languagePreference) ?? .english).locale())
            .task {
                guard state == nil, !openFailed else { return }
                do { state = AppState(store: try LocalStore()) }
                catch { openFailed = true }
            }
        }
    }
}
