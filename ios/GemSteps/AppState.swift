import Foundation
import Observation

struct Celebration: Identifiable {
    let id = UUID()
    let value: Int
    // Keep a resource key so an already-presented result can change language.
    let title: String
    let emoji: String
    let image: String?
}

@MainActor @Observable
final class AppState {
    private(set) var points: PointsState?
    private(set) var loadError: String?
    private(set) var saving = false
    var errorMessage: String?
    var rewards = false
    var undo = false
    var adjustmentOpen = false
    private(set) var celebration: Celebration?
    private let store: LocalStore
    private let sound = PointSound()

    init(store: LocalStore, date: Date = PacificDate.now) {
        self.store = store
        do {
            points = try store.load(dateKey: PacificDate.key(date))
        } catch { loadError = "Please reopen the app. Your existing data has not been deleted." }
    }

    func refreshDate(_ date: Date = PacificDate.now) {
        guard let points, points.dateKey != PacificDate.key(date) else { return }
        do {
            self.points = try store.day(dateKey: PacificDate.key(date), balance: points.balance)
            errorMessage = nil
        } catch { errorMessage = "Unable to load today’s points. Please try again later." }
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
            if adjustment != nil || !undo {
                let item = (Catalog.tasks + Catalog.rewards).first { $0.id == itemID }
                celebration = Celebration(value: change.points,
                                          title: adjustment != nil ? "Points adjusted" : item?.isReward == true ? "Reward redeemed" : "Task completed!",
                                          emoji: item?.emoji ?? "⭐", image: item?.image)
            }
            return true
        } catch PointsError.insufficientBalance {
            // Extra visible undo feedback awaits the explicit section 5 decision.
            if adjustment != nil { errorMessage = "Not enough points" }
            return false
        } catch PointsError.noOccurrence { return false }
        catch {
            errorMessage = "Could not save. Please try again. Your points have not changed."
            return false
        }
    }

    /// Called when the celebration appears in the adjustment sheet or full-screen cover.
    func playCelebration(_ id: UUID) async {
        guard let celebration, celebration.id == id else { return }
        await sound.play(positive: celebration.value > 0)
        do { try await Task.sleep(for: .seconds(2)) } catch { }
        if self.celebration?.id == id { self.celebration = nil }
    }
}
