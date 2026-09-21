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
                    ContentUnavailableView("无法加载积分", systemImage: "externaldrive.badge.exclamationmark",
                                           description: Text("请重新打开应用。原有数据未清除。"))
                } else { ProgressView().accessibilityLabel("正在加载积分") }
            }
            .task {
                guard state == nil, !openFailed else { return }
                do { state = AppState(store: try LocalStore()) }
                catch { openFailed = true }
            }
        }
    }
}
