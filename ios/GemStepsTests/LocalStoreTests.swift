import XCTest
import SwiftData
@testable import GemSteps

final class LocalStoreTests: XCTestCase {
    @MainActor func testSuccessfulActionBlocksReentryAndUndoStaysSilent() async throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = try LocalStore(url: folder.appendingPathComponent("test.sqlite"))
        let date = ISO8601DateFormatter().date(from: "2026-09-20T19:00:00Z")!
        let app = AppState(store: store, date: date)
        XCTAssertTrue(app.perform(itemID: "seed-task-face", date: date))
        XCTAssertEqual(app.points?.balance, 1)
        XCTAssertEqual(app.celebration?.image, "face-wash")
        XCTAssertFalse(app.perform(itemID: "seed-task-face", date: date))
        XCTAssertFalse(app.perform(adjustment: 100, date: date))
        XCTAssertEqual(try store.context.fetchCount(FetchDescriptor<PointEntry>()), 1)
        try await Task.sleep(for: .milliseconds(2300))
        XCTAssertNil(app.celebration)
        app.undo = true
        XCTAssertTrue(app.perform(itemID: "seed-task-face", date: date))
        XCTAssertNil(app.celebration)
        XCTAssertEqual(app.points?.balance, 0)
        XCTAssertFalse(app.perform(itemID: "seed-task-face", date: date))
        XCTAssertEqual(try store.context.fetchCount(FetchDescriptor<PointEntry>()), 2)
    }

    @MainActor func testActionChecksDateBeforeUsingCountsAndRetainsHistoricalBalance() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = try LocalStore(url: folder.appendingPathComponent("test.sqlite"))
        let parser = ISO8601DateFormatter()
        let before = parser.date(from: "2026-09-21T06:59:59Z")!
        let after = parser.date(from: "2026-09-21T07:00:00Z")!
        try store.save(PointChange(kind: "task", itemID: "seed-task-face", points: 1), date: before)
        try store.save(PointChange(kind: "adjustment", itemID: "manual-adjustment", points: 11), date: before)
        let app = AppState(store: store, date: before)
        app.undo = true
        XCTAssertFalse(app.perform(itemID: "seed-task-face", date: after))
        XCTAssertEqual(app.points?.dateKey, "2026-09-21")
        XCTAssertEqual(app.points?.balance, 12)
        XCTAssertEqual(app.points?.dailyNet, 0)
        XCTAssertTrue(app.points?.counts.isEmpty == true)
        app.undo = false
        XCTAssertTrue(app.perform(itemID: "reward-ice-stick", date: after))
        XCTAssertEqual(app.points?.balance, 7)
        XCTAssertEqual(app.points?.dailyNet, -5)
        XCTAssertEqual(app.celebration?.emoji, "🍭")
        XCTAssertNil(app.celebration?.image)
        app.refreshDate(before)
        XCTAssertEqual(app.points?.balance, 7)
        XCTAssertEqual(app.points?.dailyNet, 12)
        XCTAssertEqual(app.points?.counts["seed-task-face"], 1)
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
        XCTAssertEqual(app.points?.balance, 10); XCTAssertEqual(app.displayedPoints, 10)
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
