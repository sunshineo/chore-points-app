import Foundation
import Observation

struct Celebration: Identifiable {
    let id = UUID()
    let value: Int
    let emoji: String
    let image: String?
}

@MainActor @Observable
final class AppState {
    private(set) var points: PointsState?
    private(set) var loadError: String?
    private(set) var saving = false
    private(set) var displayedPoints = 0
    var errorMessage: String?
    var rewards = false
    var undo = false
    var adjustmentOpen = false
    private(set) var celebration: Celebration?
    private let store: LocalStore
    private let sound = PointSound()
    private var numberAnimation: Task<Void, Never>?

    init(store: LocalStore, date: Date = PacificDate.now) {
        self.store = store
        do {
            points = try store.load(dateKey: PacificDate.key(date))
            displayedPoints = points?.balance ?? 0
        } catch { loadError = "无法读取本地积分，请重新打开应用。原有数据未被清除。" }
    }

    func refreshDate(_ date: Date = PacificDate.now) {
        guard let points, points.dateKey != PacificDate.key(date) else { return }
        do {
            self.points = try store.day(dateKey: PacificDate.key(date), balance: points.balance)
            errorMessage = nil
        } catch { errorMessage = "无法读取当天积分，请稍后重试" }
    }

    @discardableResult
    func perform(itemID: String? = nil, adjustment: Int? = nil, date: Date = PacificDate.now) -> Bool {
        guard !saving, celebration == nil, points != nil else { return false }
        refreshDate(date)
        guard var candidate = points, candidate.dateKey == PacificDate.key(date) else { return false }
        saving = true
        defer { saving = false }
        do {
            let change: PointChange
            if let adjustment { change = try candidate.adjustment(adjustment) }
            else if let itemID { change = try candidate.change(itemID: itemID, undo: undo) }
            else { return false }
            try candidate.include(change, on: candidate.dateKey)
            try store.save(change, date: date)
            points = candidate
            errorMessage = nil
            animateBalance(candidate.balance)
            if adjustment != nil || !undo {
                let item = (Catalog.tasks + Catalog.rewards).first { $0.id == itemID }
                celebration = Celebration(value: change.points, emoji: item?.emoji ?? "⭐",
                                          image: item?.isReward == false ? item?.image : nil)
                let expires = ContinuousClock.now.advanced(by: .milliseconds(2200))
                Task { [weak self] in
                    try? await Task.sleep(until: expires, clock: .continuous)
                    self?.celebration = nil
                }
                let sound = sound
                Task { await sound.play(positive: change.points > 0) }
            }
            return true
        } catch PointsError.insufficientBalance {
            // Extra visible undo feedback awaits the explicit section 5 decision.
            if adjustment != nil { errorMessage = "积分不足" }
            return false
        } catch PointsError.noOccurrence { return false }
        catch {
            errorMessage = "保存失败，请重试。积分未改变。"
            return false
        }
    }

    private func animateBalance(_ end: Int) {
        numberAnimation?.cancel()
        let start = displayedPoints
        guard start != 0, start != end else { displayedPoints = end; return }
        numberAnimation = Task { [weak self] in
            let steps = min(abs(end - start), 30)
            for step in 1...steps {
                do { try await Task.sleep(for: .milliseconds(600 / steps)) } catch { return }
                self?.displayedPoints = Int((Double(start) + Double(end - start) * Double(step) / Double(steps)).rounded())
            }
        }
    }
}
