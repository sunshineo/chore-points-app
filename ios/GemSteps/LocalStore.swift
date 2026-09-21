import Foundation
import SwiftData

@MainActor
final class LocalStore {
    let container: ModelContainer
    private(set) var context: ModelContext
    private let templates: [CatalogItem]

    init(url: URL? = nil, allowsSave: Bool = true,
         templates: [CatalogItem] = Catalog.tasks + Catalog.rewards) throws {
        self.templates = templates
        let configuration: ModelConfiguration
        if let url {
            configuration = ModelConfiguration(url: url, allowsSave: allowsSave, cloudKitDatabase: .none)
        } else {
            configuration = ModelConfiguration(allowsSave: allowsSave, cloudKitDatabase: .none)
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
