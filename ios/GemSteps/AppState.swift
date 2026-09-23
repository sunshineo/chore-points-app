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
    var managementOpen = false
    var childrenOpen = false
    private(set) var children: [ChildProfile] = []
    private(set) var currentChildID: UUID?
    var currentChild: ChildProfile? { children.first { $0.id == currentChildID } }
    var canSwitchChild: Bool { !saving && celebration == nil && !adjustmentOpen && !managementOpen }
    private(set) var items: [CatalogItem] = []

    var visibleItems: [CatalogItem] {
        let source = undo ? (points?.undoItems ?? []) : items.filter(\.isActive)
        return source.filter { $0.isReward == rewards }
    }

    @discardableResult
    func reorderItems(ids: [String], isReward: Bool) -> Bool {
        do {
            try store.reorderItems(ids: ids, isReward: isReward)
            items = try store.catalog()
            errorMessage = nil
            return true
        } catch {
            errorMessage = "Could not save changes. Please try again."
            return false
        }
    }

    @discardableResult
    func saveItem(_ item: CatalogItem) -> Bool {
        do {
            try store.updateItem(item)
            items = try store.catalog()
            errorMessage = nil
            return true
        } catch {
            errorMessage = "Could not save changes. Please try again."
            return false
        }
    }

    @discardableResult
    func deleteItem(id: String) -> Bool {
        do {
            try store.deleteItem(id: id)
            items = try store.catalog()
            errorMessage = nil
            return true
        } catch {
            errorMessage = "Could not save changes. Please try again."
            return false
        }
    }
    private(set) var celebration: Celebration?
    private var store: LocalStore
    private var family: FamilyStore?
    private let sound = PointSound()

    init(store: LocalStore, date: Date = PacificDate.now) {
        self.store = store
        do {
            let family = try FamilyStore(original: store)
            let selection = try family.current(dateKey: PacificDate.key(date))
            self.family = family
            apply(selection)
        } catch { loadError = "Please reopen the app. Your existing data has not been deleted." }
    }

    private func apply(_ selection: FamilyStore.Selection) {
        store = selection.store
        items = selection.items
        points = selection.points
        children = family?.children ?? []
        currentChildID = family?.selectedID
        rewards = false
        undo = false
        errorMessage = nil
    }

    var canAddChild: Bool { children.count < FamilyStore.maximumChildren }

    var sortedChildren: [ChildProfile] {
        children.enumerated()
            .sorted { ($0.element.number ?? $0.offset + 1) < ($1.element.number ?? $1.offset + 1) }
            .map(\.element)
    }

    func currentChildLabel(locale: Locale) -> String {
        currentChild.map { childLabel($0, locale: locale) } ?? locale.interfaceText("Child \(1)")
    }

    func childLabel(_ child: ChildProfile, locale: Locale) -> String {
        let number = child.number ?? (children.firstIndex(where: { $0.id == child.id }) ?? 0) + 1
        return locale.interfaceText("Child \(number)")
    }

    @discardableResult
    func switchChild(_ id: UUID, date: Date = PacificDate.now) -> Bool {
        guard canSwitchChild, let family else { return false }
        do {
            apply(try family.select(id, dateKey: PacificDate.key(date)))
            childrenOpen = false
            return true
        } catch {
            errorMessage = "Could not open this child’s data. Your current child has not changed."
            return false
        }
    }

    @discardableResult
    func addChild(date: Date = PacificDate.now) -> Bool {
        guard !saving, celebration == nil, !adjustmentOpen, let family else { return false }
        saving = true
        defer { saving = false }
        do {
            apply(try family.add(dateKey: PacificDate.key(date)))
            childrenOpen = false
            managementOpen = false
            return true
        } catch ChildProfileError.limitReached {
            errorMessage = "Up to 9 children are supported."
            return false
        } catch {
            errorMessage = "Could not add the child. Your existing data has not changed. Please try again."
            return false
        }
    }

    @discardableResult
    func removeChild(_ id: UUID, date: Date = PacificDate.now) -> Bool {
        guard canSwitchChild, children.count > 1, let family else { return false }
        saving = true
        defer { saving = false }
        do {
            apply(try family.remove(id, dateKey: PacificDate.key(date)))
            return true
        } catch {
            errorMessage = "Could not remove the child. Please try again."
            return false
        }
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
            else if let itemID { change = try candidate.change(itemID: itemID, undo: undo, items: items) }
            else { return false }
            try candidate.include(change, on: candidate.dateKey)
            try store.save(change, date: date)
            points = candidate
            errorMessage = nil
            if adjustment != nil || !undo {
                let item = items.first { $0.id == itemID }
                celebration = Celebration(value: change.points,
                                          title: adjustment != nil ? "Points adjusted" : item?.isReward == true ? "Reward redeemed" : "Task completed!",
                                          emoji: item?.emoji ?? "⭐", image: item?.image)
            }
            return true
        } catch PointsError.insufficientBalance {
            errorMessage = "Not enough points"
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
