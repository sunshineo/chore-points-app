import XCTest
import SwiftData
import AVFoundation
@testable import GemSteps

final class LocalStoreTests: XCTestCase {
    @MainActor func testSuccessfulActionBlocksReentryAndUndoStaysSilent() async throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = try LocalStore(url: folder.appendingPathComponent("test.sqlite"))
        let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
        let app = AppState(store: store, date: date)
        XCTAssertTrue(app.perform(itemID: "seed-task-handwash", date: date))
        XCTAssertEqual(app.points?.balance, 1)
        XCTAssertEqual(app.celebration?.image, "handwash-faucet")
        XCTAssertFalse(app.perform(itemID: "seed-task-handwash", date: date))
        XCTAssertFalse(app.perform(adjustment: 100, date: date))
        XCTAssertEqual(try store.context.fetchCount(FetchDescriptor<PointEntry>()), 1)
        await app.playCelebration(try XCTUnwrap(app.celebration?.id))
        XCTAssertNil(app.celebration)
        app.undo = true
        XCTAssertTrue(app.perform(itemID: "seed-task-handwash", date: date))
        XCTAssertNil(app.celebration)
        XCTAssertEqual(app.points?.balance, 0)
        XCTAssertFalse(app.perform(itemID: "seed-task-handwash", date: date))
        XCTAssertEqual(try store.context.fetchCount(FetchDescriptor<PointEntry>()), 2)
    }

    @MainActor func testAdjustmentWaitsForPresentationAndRewardKeepsItsImage() async throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = try LocalStore(url: folder.appendingPathComponent("test.sqlite"))
        let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
        let app = AppState(store: store, date: date)
        var video = try XCTUnwrap(app.items.first { $0.id == "reward-video" })
        video.isActive = true
        XCTAssertTrue(app.saveItem(video))
        app.adjustmentOpen = true
        XCTAssertTrue(app.perform(adjustment: 30, date: date))
        let adjustment = try XCTUnwrap(app.celebration)
        // Time spent dismissing a form must not consume the celebration's lifetime.
        try await Task.sleep(for: .milliseconds(2100))
        XCTAssertEqual(app.celebration?.id, adjustment.id)
        XCTAssertFalse(app.perform(itemID: "reward-video", date: date))
        app.adjustmentOpen = false
        await app.playCelebration(adjustment.id)
        XCTAssertNil(app.celebration)
        XCTAssertTrue(app.perform(itemID: "reward-video", date: date))
        XCTAssertEqual(app.celebration?.image, "reward-tv-transparent")
        XCTAssertEqual(app.celebration?.title, "Reward redeemed")
        XCTAssertEqual(app.points?.balance, 15)
        // A stale presentation cannot dismiss the next celebration.
        await app.playCelebration(adjustment.id)
        XCTAssertNotNil(app.celebration)
        XCTAssertEqual(try store.context.fetchCount(FetchDescriptor<PointEntry>()), 2)
    }

    @MainActor func testOversizedAdjustmentPersistsActualDeduction() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appendingPathComponent("test.sqlite")
        let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
        do {
            let store = try LocalStore(url: url)
            try store.save(PointChange(kind: "adjustment", itemID: "manual-adjustment", points: 86), date: date)
            let app = AppState(store: store, date: date)
            XCTAssertTrue(app.perform(adjustment: -999, date: date))
            XCTAssertEqual(app.points?.balance, 0)
            XCTAssertEqual(app.points?.dailyNet, 0)
            XCTAssertEqual(app.celebration?.value, -86)
            let entries = try store.context.fetch(FetchDescriptor<PointEntry>())
            XCTAssertEqual(entries.map(\.points).sorted(), [-86, 86])
        }
        let reopened = try LocalStore(url: url)
        XCTAssertEqual(try reopened.load(dateKey: PacificDate.key(date)).balance, 0)
        let empty = AppState(store: reopened, date: date)
        XCTAssertTrue(empty.perform(adjustment: -999, date: date))
        XCTAssertEqual(empty.points?.balance, 0)
        XCTAssertEqual(empty.celebration?.value, 0)
    }

    func testReplacementSoundsAreBundledAndPlayable() throws {
        let bundle = try XCTUnwrap(Bundle(identifier: "me.gordon.GemSteps"))
        for name in ["points-earned", "reward-complete"] {
            let url = try XCTUnwrap(bundle.url(forResource: name, withExtension: "wav"))
            let player = try AVAudioPlayer(contentsOf: url)
            XCTAssertGreaterThan(player.duration, 0.1)
            XCTAssertLessThan(player.duration, 2)
            XCTAssertTrue(player.prepareToPlay())
        }
        XCTAssertNil(bundle.url(forResource: "ascending", withExtension: "wav"))
        XCTAssertNil(bundle.url(forResource: "descending", withExtension: "wav"))
    }

    @MainActor func testActionChecksDateBeforeUsingCountsAndRetainsHistoricalBalance() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = try LocalStore(url: folder.appendingPathComponent("test.sqlite"))
        let parser = ISO8601DateFormatter()
        let before = parser.date(from: "2026-09-21T06:59:59Z")!
        let after = parser.date(from: "2026-09-21T07:00:00Z")!
        try store.save(PointChange(kind: "task", itemID: "seed-task-handwash", points: 1), date: before)
        try store.save(PointChange(kind: "adjustment", itemID: "manual-adjustment", points: 11), date: before)
        let app = AppState(store: store, date: before)
        app.undo = true
        XCTAssertFalse(app.perform(itemID: "seed-task-handwash", date: after))
        XCTAssertEqual(app.points?.dateKey, "2026-09-21")
        XCTAssertEqual(app.points?.balance, 12)
        XCTAssertEqual(app.points?.dailyNet, 0)
        XCTAssertTrue(app.points?.counts.isEmpty == true)
        app.undo = false
        XCTAssertTrue(app.perform(itemID: "reward-sticker", date: after))
        XCTAssertEqual(app.points?.balance, 7)
        XCTAssertEqual(app.points?.dailyNet, -5)
        XCTAssertEqual(app.celebration?.emoji, "⭐")
        XCTAssertNil(app.celebration?.image)
        app.refreshDate(before)
        XCTAssertEqual(app.points?.balance, 7)
        XCTAssertEqual(app.points?.dailyNet, 12)
        XCTAssertEqual(app.points?.counts["seed-task-handwash"], 1)
    }

    @MainActor func testBatchedStartupAtOneYearOfFiftyEntriesPerDay() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appendingPathComponent("test.sqlite")
        let start = ISO8601DateFormatter().date(from: "2025-09-20T19:00:00Z")!
        do {
            let store = try LocalStore(url: url)
            for day in 0..<365 {
                let date = PacificDate.calendar.date(byAdding: .day, value: day, to: start)!
                for _ in 0..<50 {
                    store.context.insert(PointEntry(change: PointChange(kind: "task", itemID: "seed-task-face", points: 1), date: date))
                }
                try store.context.save()
            }
        }
        let begun = Date()
        let reopened = try LocalStore(url: url)
        let state = try reopened.load(dateKey: "2026-09-19")
        let elapsed = Date().timeIntervalSince(begun)
        XCTAssertEqual(state.balance, 18_250)
        XCTAssertEqual(state.dailyNet, 50)
        XCTAssertEqual(state.counts["seed-task-face"], 50)
        print("GemSteps startup: 18250 disk entries, open + projection = \(elapsed) seconds")
    }

    @MainActor func testDiskReopenEntriesAndDateRollback() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appendingPathComponent("test.sqlite")
        let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
        do {
            let store = try LocalStore(url: url)
            for change in [PointChange(kind: "adjustment", itemID: "manual-adjustment", points: 10),
                           PointChange(kind: "adjustment", itemID: "manual-adjustment", points: -8),
                           PointChange(kind: "task", itemID: "seed-task-face", points: 1),
                           PointChange(kind: "task", itemID: "seed-task-face", points: -1)] {
                try store.save(change, date: date)
            }
        }
        let reopened = try LocalStore(url: url)
        let state = try reopened.load(dateKey: "2026-09-20")
        XCTAssertEqual(state.balance, 2); XCTAssertEqual(state.dailyNet, 2)
        XCTAssertEqual(state.counts["seed-task-face"], 0)
        XCTAssertEqual(try reopened.context.fetchCount(FetchDescriptor<PointEntry>()), 4)
        let tomorrow = try reopened.day(dateKey: "2026-09-21", balance: state.balance)
        XCTAssertEqual(tomorrow.balance, 2); XCTAssertEqual(tomorrow.dailyNet, 0); XCTAssertTrue(tomorrow.counts.isEmpty)
        let back = try reopened.day(dateKey: "2026-09-20", balance: tomorrow.balance)
        XCTAssertEqual(back.dailyNet, 2)
        let app = AppState(store: reopened, date: date)
        XCTAssertFalse(app.undo); XCTAssertFalse(app.rewards); XCTAssertFalse(app.adjustmentOpen)
        XCTAssertNil(app.celebration); XCTAssertEqual(app.points?.balance, 2)
    }

    @MainActor func testReadOnlySaveRollsBackWithoutPublishing() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appendingPathComponent("test.sqlite")
        let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
        do { let store = try LocalStore(url: url); try store.save(PointChange(kind: "adjustment", itemID: "manual-adjustment", points: 10), date: date) }
        let readOnly = try LocalStore(url: url, allowsSave: false)
        let app = AppState(store: readOnly, date: date)
        XCTAssertFalse(app.perform(adjustment: 1, date: date))
        XCTAssertEqual(app.points?.balance, 10)
        XCTAssertNil(app.celebration); XCTAssertFalse(readOnly.context.hasChanges)
        XCTAssertEqual(try readOnly.context.fetchCount(FetchDescriptor<PointEntry>()), 1)
        XCTAssertNotNil(app.errorMessage)
    }

    @MainActor func testInvalidStoreIsNotReplaced() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".sqlite")
        let bytes = Data("not a sqlite database".utf8)
        try bytes.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        XCTAssertThrowsError(try LocalStore(url: url))
        XCTAssertEqual(try Data(contentsOf: url), bytes)
    }
}

// The exact pre-customization entity shape, for an actual on-disk migration test.
private enum OriginalSchema {
    @Model final class PointEntry {
        @Attribute(.unique) var id: UUID
        var occurredAt: Date
        var dateKey: String
        var kind: String
        var itemID: String
        var points: Int

        init(points: Int, date: Date) {
            id = UUID()
            occurredAt = date
            dateKey = PacificDate.key(date)
            kind = "task"
            itemID = "seed-task-brush"
            self.points = points
        }
    }
}

extension LocalStoreTests {
    @MainActor private func withDatabase(_ body: (URL) throws -> Void) throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        try body(folder.appendingPathComponent("test.sqlite"))
    }

    @MainActor func testFirstLaunchUpgradeAndAllInactiveRemainInactive() throws {
        try withDatabase { url in
            let original = Array(Catalog.tasks.filter(\.enabledByDefault).prefix(2))
            let newTemplate = try XCTUnwrap(Catalog.tasks.first { !original.map(\.id).contains($0.id) })
            do {
                let store = try LocalStore(url: url, templates: original)
                XCTAssertTrue(try store.catalog().allSatisfy(\.isActive))
                for item in try store.catalog() {
                    var disabled = item
                    disabled.isActive = false
                    try store.updateItem(disabled)
                }
            }
            let upgraded = try LocalStore(url: url, templates: original + [newTemplate])
            XCTAssertEqual(try upgraded.catalog().count, 3)
            XCTAssertTrue(try upgraded.catalog().allSatisfy { !$0.isActive })
            XCTAssertEqual(try upgraded.context.fetchCount(FetchDescriptor<CatalogInitialization>()), 1)
            let reopened = try LocalStore(url: url, templates: original + [newTemplate])
            XCTAssertTrue(try reopened.catalog().allSatisfy { !$0.isActive })
        }
        try withDatabase { url in
            let latestFreshInstall = try LocalStore(url: url)
            let items = try latestFreshInstall.catalog()
            XCTAssertEqual(items.count, 38)
            XCTAssertEqual(Set(items.filter { !$0.isReward && $0.isActive }.map(\.id)), [
                "seed-task-make-bed", "seed-task-evening-brush", "seed-task-clothes", "seed-task-handwash",
                "seed-task-tidy-toys", "seed-task-shoes", "seed-task-bedtime", "seed-task-reading"
            ])
            XCTAssertEqual(Set(items.filter { $0.isReward && $0.isActive }.map(\.id)), [
                "reward-sticker", "reward-family-game", "reward-craft", "reward-weekend-activity"
            ])
            var optional = try XCTUnwrap(items.first { $0.id == "seed-task-face" })
            XCTAssertFalse(optional.isActive)
            optional.isActive = true
            try latestFreshInstall.updateItem(optional)
            let reopened = try LocalStore(url: url)
            let saved = try XCTUnwrap(reopened.catalog().first { $0.id == optional.id })
            XCTAssertTrue(saved.isActive)
            XCTAssertEqual(saved.points, optional.points)
        }
    }

    @MainActor func testOriginalLedgerMigratesWithoutLosingIDsBalanceOrUndo() throws {
        try withDatabase { url in
            let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
            var ids: Set<UUID> = []
            try autoreleasepool {
                let old = try ModelContainer(for: OriginalSchema.PointEntry.self,
                                             configurations: ModelConfiguration(url: url, cloudKitDatabase: .none))
                let context = ModelContext(old)
                // Equal timestamps exercise the old ledger's missing sequence numbers.
                for points in [3, 3, -3] {
                    let entry = OriginalSchema.PointEntry(points: points, date: date)
                    ids.insert(entry.id)
                    context.insert(entry)
                }
                try context.save()
            }
            let store = try LocalStore(url: url)
            XCTAssertEqual(Set(try store.context.fetch(FetchDescriptor<PointEntry>()).map(\.id)), ids)
            XCTAssertEqual(try store.catalog().filter(\.isActive).count, 12)
            let state = try store.load(dateKey: PacificDate.key(date))
            XCTAssertEqual(state.balance, 3)
            XCTAssertEqual(state.counts["seed-task-brush"], 1)
            XCTAssertEqual(state.occurrences["seed-task-brush"]?.count, 1)
            let undo = try state.change(itemID: "seed-task-brush", undo: true)
            XCTAssertEqual(undo.points, -3)
            try store.save(undo, date: date)
            let reopened = try LocalStore(url: url)
            XCTAssertEqual(try reopened.load(dateKey: PacificDate.key(date)).balance, 0)
            XCTAssertTrue(try reopened.load(dateKey: PacificDate.key(date)).undoItems.isEmpty)
        }
    }

    @MainActor func testCustomLifecycleSnapshotsAndUndoSurviveDeletionAndReopen() throws {
        try withDatabase { url in
            let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
            let id = "custom-" + UUID().uuidString
            do {
                let store = try LocalStore(url: url)
                let first = CatalogItem(id: id, title: "给小白喂食", emoji: "🐰", points: 3, image: nil, isReward: false, isTemplate: false)
                try store.updateItem(first)
                var state = try store.load(dateKey: PacificDate.key(date))
                let change = try state.change(itemID: id, undo: false, items: store.catalog())
                try state.include(change, on: state.dateKey)
                try store.save(change, date: date)
                let edited = CatalogItem(id: id, title: "Feed the rabbit", emoji: "🥕", points: 8, image: nil, isReward: false, isTemplate: false)
                try store.updateItem(edited)
                let second = try state.change(itemID: id, undo: false, items: store.catalog())
                try store.save(second, date: date)
                var inactive = edited
                inactive.isActive = false
                try store.updateItem(inactive)
                XCTAssertThrowsError(try state.change(itemID: id, undo: false, items: store.catalog()))
                try store.deleteItem(id: id)
                XCTAssertFalse(try store.catalog().contains { $0.id == id })
            }
            let store = try LocalStore(url: url)
            var state = try store.load(dateKey: PacificDate.key(date))
            XCTAssertEqual(state.balance, 11)
            XCTAssertEqual(state.undoItems.first?.title, "Feed the rabbit")
            XCTAssertEqual(state.undoItems.first?.points, 8)
            let secondUndo = try state.change(itemID: id, undo: true, items: store.catalog())
            XCTAssertEqual(secondUndo.points, -8)
            try state.include(secondUndo, on: state.dateKey)
            try store.save(secondUndo, date: date)
            XCTAssertEqual(state.undoItems.first?.title, "给小白喂食")
            XCTAssertEqual(state.undoItems.first?.points, 3)
            let reopened = try LocalStore(url: url)
            let restored = try reopened.load(dateKey: PacificDate.key(date))
            XCTAssertEqual(restored.balance, 3)
            let firstUndo = try restored.change(itemID: id, undo: true, items: reopened.catalog())
            XCTAssertEqual(firstUndo.points, -3)
            try reopened.save(firstUndo, date: date)
            XCTAssertTrue(try reopened.load(dateKey: PacificDate.key(date)).undoItems.isEmpty)
            XCTAssertEqual(try reopened.context.fetchCount(FetchDescriptor<PointEntry>()), 4)
            let entries = try reopened.context.fetch(FetchDescriptor<PointEntry>())
            XCTAssertEqual(Set(entries.compactMap(\.titleSnapshot)), ["给小白喂食", "Feed the rabbit"])
            XCTAssertEqual(entries.filter { $0.reversedEntryID != nil }.count, 2)
        }
    }

    @MainActor func testTemplateEditsProtectedAndPointsPersistAcrossUpgrade() throws {
        try withDatabase { url in
            let store = try LocalStore(url: url)
            let template = Catalog.tasks[2]
            let modified = CatalogItem(id: template.id, title: template.title, emoji: template.emoji, points: 7,
                                       image: template.image, isReward: false, englishTitle: template.englishTitle)
            try store.updateItem(modified)
            XCTAssertThrowsError(try store.deleteItem(id: template.id))
            for forged in [
                CatalogItem(id: template.id, title: "Renamed", emoji: template.emoji, points: 7, image: nil, isReward: false),
                CatalogItem(id: template.id, title: template.title, emoji: "⭐", points: 7, image: nil, isReward: false),
                CatalogItem(id: template.id, title: template.title, emoji: template.emoji, points: 7, image: nil, isReward: true)
            ] { XCTAssertThrowsError(try store.updateItem(forged)) }
            let reopened = try LocalStore(url: url)
            XCTAssertEqual(try reopened.catalog().first(where: { $0.id == template.id })?.points, 7)
            XCTAssertEqual(try reopened.catalog().first(where: { $0.id == template.id })?.englishTitle, template.englishTitle)
        }
    }

    @MainActor func testCatalogSaveAndDeleteFailuresDoNotPublishOrPersist() throws {
        try withDatabase { url in
            let item = CatalogItem(id: "custom-" + UUID().uuidString, title: "Read", emoji: "📚", points: 2,
                                   image: nil, isReward: false, isTemplate: false)
            do { try LocalStore(url: url).updateItem(item) }
            let store = try LocalStore(url: url, allowsSave: false)
            let app = AppState(store: store)
            var disabled = item
            disabled.isActive = false
            XCTAssertFalse(app.saveItem(disabled))
            XCTAssertEqual(app.items.first(where: { $0.id == item.id })?.isActive, true)
            XCTAssertFalse(store.context.hasChanges)
            XCTAssertFalse(app.deleteItem(id: item.id))
            XCTAssertTrue(app.items.contains { $0.id == item.id })
            XCTAssertFalse(store.context.hasChanges)
            XCTAssertEqual(try LocalStore(url: url).catalog().first(where: { $0.id == item.id }), item)
        }
    }
}

extension LocalStoreTests {
    @MainActor func testInvalidCustomContentDoesNotWriteAnything() throws {
        try withDatabase { url in
            let store = try LocalStore(url: url)
            for (title, emoji, points) in [("  ", "⭐", 1), (String(repeating: "a", count: 101), "⭐", 1),
                                           ("Read", "", 1), ("Read", "ab", 1), ("Read", "⭐", 0),
                                           ("Read", "⭐", 1000), ("Read", "⭐", -1)] {
                let item = CatalogItem(id: "custom-" + UUID().uuidString, title: title, emoji: emoji, points: points,
                                       image: nil, isReward: false, isTemplate: false)
                XCTAssertThrowsError(try store.updateItem(item))
            }
            XCTAssertEqual(try store.context.fetchCount(FetchDescriptor<CustomItem>()), 0)
            XCTAssertFalse(store.context.hasChanges)
        }
    }

    @MainActor func testAppUndoListIncludesDeletedAndInactiveItemsAndRolloverClearsIt() throws {
        try withDatabase { url in
            let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
            let store = try LocalStore(url: url)
            let custom = CatalogItem(id: "custom-" + UUID().uuidString, title: "Read", emoji: "📚", points: 4,
                                      image: nil, isReward: false, isTemplate: false)
            try store.updateItem(custom)
            var state = try store.load(dateKey: PacificDate.key(date))
            for id in [custom.id, "seed-task-evening-brush"] {
                let change = try state.change(itemID: id, undo: false, items: store.catalog())
                try store.save(change, date: date)
                try state.include(change, on: state.dateKey)
            }
            let app = AppState(store: store, date: date)
            XCTAssertTrue(app.deleteItem(id: custom.id))
            var template = try XCTUnwrap(app.items.first { $0.id == "seed-task-evening-brush" })
            template.isActive = false
            XCTAssertTrue(app.saveItem(template))
            XCTAssertFalse(app.visibleItems.contains { $0.id == custom.id || $0.id == template.id })
            app.undo = true
            XCTAssertEqual(Set(app.visibleItems.map(\.id)), [custom.id, template.id])
            XCTAssertTrue(app.perform(itemID: custom.id, date: date))
            XCTAssertEqual(app.points?.balance, 2)
            XCTAssertTrue(app.perform(itemID: template.id, date: date))
            XCTAssertEqual(app.points?.balance, 0)
            app.refreshDate(date.addingTimeInterval(86400))
            XCTAssertTrue(app.visibleItems.isEmpty)
        }
    }
}

extension LocalStoreTests {
    @MainActor func testMixedOrderingSurvivesReopenEditsAndNewTemplates() throws {
        try withDatabase { url in
            let templates = Array(Catalog.tasks.filter(\.enabledByDefault).prefix(2)) + Array(Catalog.rewards.prefix(2))
            let custom = CatalogItem(id: "custom-" + UUID().uuidString, title: "Read", emoji: "📚", points: 4,
                                     image: nil, isReward: false, isTemplate: false)
            let desired = [templates[1].id, custom.id, templates[0].id]
            let rewardOrder = [templates[3].id, templates[2].id]
            do {
                let store = try LocalStore(url: url, templates: templates)
                try store.updateItem(custom)
                try store.reorderItems(ids: desired, isReward: false)
                try store.reorderItems(ids: rewardOrder, isReward: true)
                var inactive = custom
                inactive.isActive = false
                try store.updateItem(inactive)
            }
            let store = try LocalStore(url: url, templates: templates + [Catalog.tasks[2]])
            let app = AppState(store: store)
            XCTAssertEqual(app.items.filter { !$0.isReward }.map(\.id), desired + [Catalog.tasks[2].id])
            XCTAssertEqual(app.items.filter(\.isReward).map(\.id), rewardOrder)
            XCTAssertEqual(app.visibleItems.map(\.id), [templates[1].id, templates[0].id])
            XCTAssertFalse(try XCTUnwrap(app.items.first { $0.id == Catalog.tasks[2].id }).isActive)
            XCTAssertTrue(app.saveItem(custom))
            XCTAssertEqual(app.visibleItems.map(\.id), desired)
            XCTAssertTrue(app.deleteItem(id: custom.id))
            XCTAssertEqual(app.visibleItems.map(\.id), [templates[1].id, templates[0].id])
            let newCustom = CatalogItem(id: "custom-" + UUID().uuidString, title: "Water plants", emoji: "🌱", points: 2,
                                        image: nil, isReward: false, isTemplate: false)
            XCTAssertTrue(app.saveItem(newCustom))
            XCTAssertEqual(app.visibleItems.map(\.id), [newCustom.id, templates[1].id, templates[0].id])
        }
    }

    @MainActor func testInvalidAndFailedReorderLeaveExistingOrderUnchanged() throws {
        try withDatabase { url in
            let store = try LocalStore(url: url)
            let before = try store.catalog()
            let tasks = before.filter { !$0.isReward }.map(\.id)
            for invalid in [Array(tasks.dropLast()), tasks + [tasks[0]], tasks + [Catalog.rewards[0].id], ["missing"]] {
                XCTAssertThrowsError(try store.reorderItems(ids: invalid, isReward: false))
            }
            XCTAssertEqual(try store.catalog(), before)
            let readOnly = try LocalStore(url: url, allowsSave: false)
            let app = AppState(store: readOnly)
            XCTAssertFalse(app.reorderItems(ids: tasks.reversed(), isReward: false))
            XCTAssertEqual(app.items, before)
            XCTAssertFalse(readOnly.context.hasChanges)
            XCTAssertEqual(try LocalStore(url: url).catalog(), before)
        }
    }
}


extension LocalStoreTests {
    @MainActor func testChronologicalOrderReplacesLegacyOrderOnceWithoutChangingSettings() throws {
        try withDatabase { url in
            let taskIDs = Catalog.tasks.map(\.id)
            do {
                let store = try LocalStore(url: url)
                var item = try XCTUnwrap(store.catalog().first { $0.id == "seed-task-face" })
                item.isActive = true
                try store.updateItem(item)
                let configuration = try XCTUnwrap(store.context.fetch(FetchDescriptor<CatalogInitialization>()).first)
                configuration.orderedIDs = Array(taskIDs.reversed()) + Catalog.rewards.map(\.id)
                configuration.dailyTaskOrderApplied = nil
                try store.context.save()
            }
            let upgraded = try LocalStore(url: url)
            let items = try upgraded.catalog()
            XCTAssertEqual(items.filter { !$0.isReward }.map(\.id), taskIDs)
            XCTAssertTrue(try XCTUnwrap(items.first { $0.id == "seed-task-face" }).isActive)
            XCTAssertFalse(try XCTUnwrap(items.first { $0.id == "seed-task-brush" }).isActive)
            let app = AppState(store: upgraded)
            XCTAssertEqual(app.visibleItems.map(\.id), items.filter { !$0.isReward && $0.isActive }.map(\.id))
            let manualOrder = Array(taskIDs.reversed())
            try upgraded.reorderItems(ids: manualOrder, isReward: false)
            let reopened = try LocalStore(url: url)
            XCTAssertEqual(try reopened.catalog().filter { !$0.isReward }.map(\.id), manualOrder)
        }
    }
}
