import SwiftUI

@main
struct GemStepsApp: App {
    @State private var state: AppState?
    @State private var openFailed = false

    var body: some Scene {
        WindowGroup {
            Group {
                if let state { PointsView(state: state) }
                else if openFailed {
                    ContentUnavailableView("Unable to load points", systemImage: "externaldrive.badge.exclamationmark",
                                           description: Text("Please reopen the app. Your existing data has not been deleted."))
                } else { ProgressView().accessibilityLabel("Loading points") }
            }
            .task {
                guard state == nil, !openFailed else { return }
                do { state = AppState(store: try LocalStore()) }
                catch { openFailed = true }
            }
        }
    }
}
