import Foundation
import SwiftData

@MainActor
final class LocalStore {
    let container: ModelContainer
    private(set) var context: ModelContext

    init(url: URL? = nil, allowsSave: Bool = true) throws {
        let configuration: ModelConfiguration
        if let url {
            configuration = ModelConfiguration(url: url, allowsSave: allowsSave, cloudKitDatabase: .none)
        } else {
            configuration = ModelConfiguration(allowsSave: allowsSave, cloudKitDatabase: .none)
        }
        container = try ModelContainer(for: PointEntry.self, configurations: configuration)
        context = ModelContext(container)
        context.autosaveEnabled = false
    }

    func load(dateKey: String) throws -> PointsState {
        var state = PointsState(dateKey: dateKey)
        // Iterate in batches instead of materializing the entire historical ledger.
        try context.enumerate(FetchDescriptor<PointEntry>(), batchSize: 512) { entry in
            try state.include(entry.change, on: entry.dateKey)
        }
        guard state.balance >= 0, state.counts.values.allSatisfy({ $0 >= 0 }) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return state
    }

    func day(dateKey: String, balance: Int) throws -> PointsState {
        var state = PointsState(dateKey: dateKey)
        let descriptor = FetchDescriptor<PointEntry>(predicate: #Predicate { $0.dateKey == dateKey })
        try context.enumerate(descriptor, batchSize: 512) { entry in
            try state.include(entry.change, on: entry.dateKey)
        }
        state.balance = balance
        return state
    }

    func save(_ change: PointChange, date: Date) throws {
        context.insert(PointEntry(change: change, date: date))
        do { try context.save() }
        catch {
            context.rollback()
            // A failed SwiftData save can leave an inserted identity registered even
            // after rollback. Recreate this one writer from the committed store.
            context = ModelContext(container)
            context.autosaveEnabled = false
            throw error
        }
    }
}
