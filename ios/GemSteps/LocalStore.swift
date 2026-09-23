import Foundation
import SwiftData

@MainActor
final class LocalStore {
    let container: ModelContainer
    private(set) var context: ModelContext
    let templates: [CatalogItem]
    let url: URL
    let allowsSave: Bool

    init(url: URL? = nil, allowsSave: Bool = true,
         templates: [CatalogItem] = Catalog.tasks + Catalog.rewards) throws {
        self.templates = templates
        self.allowsSave = allowsSave
        let configuration: ModelConfiguration
        if let url {
            configuration = ModelConfiguration(url: url, allowsSave: allowsSave, cloudKitDatabase: .none)
        } else {
            configuration = ModelConfiguration(allowsSave: allowsSave, cloudKitDatabase: .none)
        }
        self.url = configuration.url
        if FileManager.default.fileExists(atPath: configuration.url.appendingPathExtension("children.json").path),
           !FileManager.default.fileExists(atPath: configuration.url.path) {
            throw CocoaError(.fileNoSuchFile)
        }
        container = try ModelContainer(for: PointEntry.self, TemplateSetting.self, CustomItem.self,
                                       CatalogInitialization.self, configurations: configuration)
        context = ModelContext(container)
        context.autosaveEnabled = false
        try initializeCatalog()
    }

    private func initializeCatalog() throws {
        let initialized = try context.fetchCount(FetchDescriptor<CatalogInitialization>()) > 0
        let known = Set(try context.fetch(FetchDescriptor<TemplateSetting>()).map(\.templateID))
        let newTemplates = templates.filter { !known.contains($0.id) }
        for template in newTemplates {
            context.insert(TemplateSetting(template: template, isActive: !initialized && template.enabledByDefault))
        }
        if !initialized {
            context.insert(CatalogInitialization())
        } else if !newTemplates.isEmpty,
                  let configuration = try context.fetch(FetchDescriptor<CatalogInitialization>()).first {
            let newIDs = newTemplates.map(\.id)
            let existingIDs = try catalog().map(\.id).filter { !newIDs.contains($0) }
            configuration.orderedIDs = existingIDs + newIDs
        }
        if let configuration = try context.fetch(FetchDescriptor<CatalogInitialization>()).first,
           configuration.dailyTaskOrderApplied != true {
            // Apply the chronological template order once, keeping custom items in their slots.
            let taskIDs = templates.filter { !$0.isReward }.map(\.id)
            let taskSet = Set(taskIDs)
            var remaining = taskIDs.makeIterator()
            configuration.orderedIDs = try catalog().map { item in
                taskSet.contains(item.id) ? remaining.next()! : item.id
            }
            configuration.dailyTaskOrderApplied = true
        }
        if context.hasChanges { try commit() }
    }

    func catalog() throws -> [CatalogItem] {
        let settings = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<TemplateSetting>()).map { ($0.templateID, $0) })
        let builtIn = templates.compactMap { template -> CatalogItem? in
            guard let setting = settings[template.id] else { return nil }
            return CatalogItem(id: template.id, title: template.title, emoji: template.emoji,
                               points: setting.points, image: template.image, isReward: template.isReward,
                               englishTitle: template.englishTitle, isActive: setting.isActive)
        }
        let custom = try context.fetch(FetchDescriptor<CustomItem>(sortBy: [SortDescriptor(\.createdAt), SortDescriptor(\.id)]))
        let items = builtIn + custom.map(\.item)
        let order = try context.fetch(FetchDescriptor<CatalogInitialization>()).first?.orderedIDs ?? []
        let positions = Dictionary(uniqueKeysWithValues: order.enumerated().map { ($0.element, $0.offset) })
        // Preserve original order for installations that have not saved an order yet.
        return items.enumerated().sorted {
            let left = positions[$0.element.id] ?? (order.count + $0.offset)
            let right = positions[$1.element.id] ?? (order.count + $1.offset)
            return left < right
        }.map(\.element)
    }

    func reorderItems(ids: [String], isReward: Bool) throws {
        let current = try catalog()
        let expected = current.filter { $0.isReward == isReward }.map(\.id)
        guard ids.count == expected.count, Set(ids) == Set(expected),
              let configuration = try context.fetch(FetchDescriptor<CatalogInitialization>()).first else {
            throw CatalogError.invalidItem
        }
        configuration.orderedIDs = ids + current.filter { $0.isReward != isReward }.map(\.id)
        try commit()
    }

    func updateItem(_ item: CatalogItem) throws {
        guard (1...999).contains(item.points) else { throw CatalogError.invalidItem }
        if let template = templates.first(where: { $0.id == item.id }) {
            guard item.isTemplate, item.title == template.title, item.englishTitle == template.englishTitle,
                  item.emoji == template.emoji, item.image == template.image, item.isReward == template.isReward else {
                throw CatalogError.protectedTemplate
            }
            guard let setting = try context.fetch(FetchDescriptor<TemplateSetting>()).first(where: { $0.templateID == item.id }) else {
                throw CatalogError.missingItem
            }
            setting.points = item.points
            setting.isActive = item.isActive
        } else {
            let title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
            let emoji = item.emoji.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !item.isTemplate, !title.isEmpty, title.count <= 100,
                  emoji.count == 1, item.englishTitle == nil, item.image == nil else { throw CatalogError.invalidItem }
            if let custom = try context.fetch(FetchDescriptor<CustomItem>()).first(where: { $0.id == item.id }) {
                // A task/reward's identity and kind remain stable for its ledger.
                guard custom.isReward == item.isReward else { throw CatalogError.invalidItem }
                custom.title = title
                custom.emoji = emoji
                custom.points = item.points
                custom.isActive = item.isActive
            } else {
                guard item.id.hasPrefix("custom-"), UUID(uuidString: String(item.id.dropFirst(7))) != nil else {
                    throw CatalogError.invalidItem
                }
                let clean = CatalogItem(id: item.id, title: title, emoji: emoji, points: item.points,
                                        image: nil, isReward: item.isReward, isActive: item.isActive, isTemplate: false)
                let existingIDs = try catalog().map(\.id)
                context.insert(CustomItem(item: clean))
                if let configuration = try context.fetch(FetchDescriptor<CatalogInitialization>()).first {
                    configuration.orderedIDs = [clean.id] + existingIDs
                }
            }
        }
        try commit()
    }

    func deleteItem(id: String) throws {
        guard !templates.contains(where: { $0.id == id }) else { throw CatalogError.protectedTemplate }
        guard let custom = try context.fetch(FetchDescriptor<CustomItem>()).first(where: { $0.id == id }) else {
            throw CatalogError.missingItem
        }
        context.delete(custom)
        if let configuration = try context.fetch(FetchDescriptor<CatalogInitialization>()).first {
            configuration.orderedIDs?.removeAll { $0 == id }
        }
        try commit()
    }

    private var ledgerOrder: [SortDescriptor<PointEntry>] {
        [SortDescriptor(\.sequence), SortDescriptor(\.occurredAt), SortDescriptor(\.id)]
    }

    func load(dateKey: String) throws -> PointsState {
        var state = PointsState(dateKey: dateKey)
        try context.enumerate(FetchDescriptor<PointEntry>(sortBy: ledgerOrder), batchSize: 512) { entry in
            try state.include(entry.change, on: entry.dateKey)
        }
        guard state.balance >= 0, state.counts.values.allSatisfy({ $0 >= 0 }) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return state
    }

    func day(dateKey: String, balance: Int) throws -> PointsState {
        var state = PointsState(dateKey: dateKey)
        let descriptor = FetchDescriptor<PointEntry>(predicate: #Predicate { $0.dateKey == dateKey }, sortBy: ledgerOrder)
        try context.enumerate(descriptor, batchSize: 512) { entry in
            try state.include(entry.change, on: entry.dateKey)
        }
        state.balance = balance
        return state
    }

    func save(_ change: PointChange, date: Date) throws {
        var descriptor = FetchDescriptor<PointEntry>(sortBy: [SortDescriptor(\.sequence, order: .reverse)])
        descriptor.fetchLimit = 1
        let last = try context.fetch(descriptor).first?.sequence ?? 0
        let entry = PointEntry(change: change, date: date)
        entry.sequence = last + 1
        context.insert(entry)
        try commit()
    }

    private func commit() throws {
        do { try context.save() }
        catch {
            context.rollback()
            context = ModelContext(container)
            context.autosaveEnabled = false
            throw error
        }
    }
}

struct ChildProfile: Identifiable, Codable, Equatable {
    let id: UUID
    var number: Int? = nil
}

enum ChildProfileError: Error {
    case limitReached, unavailable, lastChild
}

/// Each child uses the unchanged ledger schema. The atomic manifest is the only
/// activation point; until it exists, the original single-child store is untouched.
@MainActor
final class FamilyStore {
    static let maximumChildren = 9
    private struct Manifest: Codable {
        var version = 1
        var children: [ChildProfile]
        var selectedID: UUID
        var originalID: UUID?
        var removedIDs: [UUID]?
    }

    struct Selection {
        let store: LocalStore
        let items: [CatalogItem]
        let points: PointsState
    }

    private let original: LocalStore
    let manifestURL: URL
    private var manifest: Manifest?
    var children: [ChildProfile] { manifest?.children ?? [] }
    var selectedID: UUID? { manifest?.selectedID }

    init(original: LocalStore) throws {
        self.original = original
        manifestURL = original.url.appendingPathExtension("children.json")
        if FileManager.default.fileExists(atPath: manifestURL.path) {
            let saved = try JSONDecoder().decode(Manifest.self, from: Data(contentsOf: manifestURL))
            guard saved.version == 1, (1...Self.maximumChildren).contains(saved.children.count),
                  Set(saved.children.map(\.id)).count == saved.children.count,
                  saved.children.contains(where: { $0.id == saved.selectedID }) else {
                throw CocoaError(.fileReadCorruptFile)
            }
            let numbers = saved.children.enumerated().map { $0.element.number ?? $0.offset + 1 }
            guard Set(numbers).count == numbers.count,
                  numbers.allSatisfy({ (1...Self.maximumChildren).contains($0) }) else {
                throw CocoaError(.fileReadCorruptFile)
            }
            manifest = saved
            cleanupRemovedStores()
        }
    }

    private func directory(for id: UUID) -> URL {
        original.url.appendingPathExtension("children").appendingPathComponent(id.uuidString, isDirectory: true)
    }

    private func store(for id: UUID) throws -> LocalStore {
        guard children.contains(where: { $0.id == id }) else { throw ChildProfileError.unavailable }
        if id == (manifest?.originalID ?? children.first?.id) { return original }
        let url = directory(for: id).appendingPathComponent("points.store")
        // Never silently replace a missing child's ledger with an empty one.
        guard FileManager.default.fileExists(atPath: url.path) else { throw CocoaError(.fileNoSuchFile) }
        return try LocalStore(url: url, allowsSave: original.allowsSave, templates: original.templates)
    }

    private func selection(_ store: LocalStore, dateKey: String) throws -> Selection {
        Selection(store: store, items: try store.catalog(), points: try store.load(dateKey: dateKey))
    }

    func current(dateKey: String) throws -> Selection {
        try selection(selectedID.map { try store(for: $0) } ?? original, dateKey: dateKey)
    }

    private func commit(_ updated: Manifest) throws {
        guard original.allowsSave else { throw CocoaError(.fileWriteNoPermission) }
        try JSONEncoder().encode(updated).write(to: manifestURL, options: .atomic)
        manifest = updated
    }

    func select(_ id: UUID, dateKey: String) throws -> Selection {
        guard var updated = manifest else { throw ChildProfileError.unavailable }
        let result = try selection(store(for: id), dateKey: dateKey)
        updated.selectedID = id
        try commit(updated)
        return result
    }

    func remove(_ id: UUID, dateKey: String) throws -> Selection {
        guard var updated = manifest, updated.children.contains(where: { $0.id == id }) else {
            throw ChildProfileError.unavailable
        }
        guard updated.children.count > 1 else { throw ChildProfileError.lastChild }
        // Persist the original database owner before removing or reordering any profile.
        updated.originalID = updated.originalID ?? updated.children.first!.id
        for index in updated.children.indices {
            updated.children[index].number = updated.children[index].number ?? index + 1
        }
        updated.children.removeAll { $0.id == id }
        if updated.selectedID == id { updated.selectedID = updated.children[0].id }
        let result = try selection(store(for: updated.selectedID), dateKey: dateKey)
        updated.removedIDs = (updated.removedIDs ?? []) + [id]
        // Publish removal first; interrupted cleanup is retried on next launch.
        try commit(updated)
        cleanupRemovedStores()
        return result
    }

    private func cleanupRemovedStores() {
        guard original.allowsSave, let manifest else { return }
        for id in manifest.removedIDs ?? [] {
            do {
                if id == manifest.originalID {
                    for entry in try original.context.fetch(FetchDescriptor<PointEntry>()) { original.context.delete(entry) }
                    for item in try original.context.fetch(FetchDescriptor<CustomItem>()) { original.context.delete(item) }
                    for setting in try original.context.fetch(FetchDescriptor<TemplateSetting>()) { original.context.delete(setting) }
                    for config in try original.context.fetch(FetchDescriptor<CatalogInitialization>()) { original.context.delete(config) }
                    try original.context.save()
                } else if FileManager.default.fileExists(atPath: directory(for: id).path) {
                    try FileManager.default.removeItem(at: directory(for: id))
                }
            } catch {
                original.context.rollback()
                // The removed profile is already inaccessible; retry cleanup on launch.
            }
        }
    }

    func add(dateKey: String) throws -> Selection {
        guard original.allowsSave else { throw CocoaError(.fileWriteNoPermission) }
        guard children.count < Self.maximumChildren else { throw ChildProfileError.limitReached }
        // Validate the old ledger before linking it to a numbered profile.
        if manifest == nil { _ = try original.load(dateKey: dateKey) }
        let usedNumbers = Set(children.enumerated().map { $0.element.number ?? $0.offset + 1 })
        let number = manifest == nil ? 2 : (1...Self.maximumChildren).first { !usedNumbers.contains($0) }!
        let child = ChildProfile(id: UUID(), number: number)
        let folder = directory(for: child.id)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let newStore = try LocalStore(url: folder.appendingPathComponent("points.store"), templates: original.templates)
            let result = try selection(newStore, dateKey: dateKey)
            var updated = manifest ?? Manifest(children: [ChildProfile(id: UUID())], selectedID: child.id)
            updated.children.append(child)
            updated.selectedID = child.id
            try commit(updated)
            return result
        } catch {
            // This directory was created by this attempt and is never a published child's store.
            try? FileManager.default.removeItem(at: folder)
            throw error
        }
    }
}
