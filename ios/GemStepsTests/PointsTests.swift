import XCTest
@testable import GemSteps

final class PointsTests: XCTestCase {
    func testReferenceSequenceAndRejections() throws {
        var state = PointsState(dateKey: "2026-09-20")
        func act(_ id: String, undo: Bool = false) throws {
            let change = try state.change(itemID: id, undo: undo)
            try state.include(change, on: state.dateKey)
        }
        try act("seed-task-face"); try act("seed-task-face"); try act("seed-task-brush")
        XCTAssertEqual(state.balance, 5)
        XCTAssertEqual(state.counts["seed-task-face"], 2)
        XCTAssertEqual(state.dailyNet, 5)
        try act("reward-ice-stick")
        XCTAssertEqual(state.balance, 0)
        XCTAssertThrowsError(try state.change(itemID: "seed-task-brush", undo: true)) { XCTAssertEqual($0 as? PointsError, .insufficientBalance) }
        XCTAssertThrowsError(try state.change(itemID: "reward-ice-stick", undo: false))
        XCTAssertEqual(state.counts["seed-task-brush"], 1)
        try act("reward-ice-stick", undo: true)
        try act("seed-task-face", undo: true)
        XCTAssertEqual(state.balance, 4)
        XCTAssertEqual(state.counts["reward-ice-stick"], 0)
        XCTAssertThrowsError(try state.change(itemID: "seed-task-math", undo: true))
        for amount in [-2, 10] { try state.include(state.adjustment(amount), on: state.dateKey) }
        XCTAssertEqual(state.balance, 12)
        XCTAssertEqual(state.counts["seed-task-face"], 1)
        XCTAssertEqual(state.dailyNet, 12)
        var next = PointsState(dateKey: "2026-09-21", balance: state.balance)
        XCTAssertThrowsError(try next.change(itemID: "seed-task-face", undo: true))
        try next.include(next.change(itemID: "reward-ice-stick", undo: false), on: next.dateKey)
        XCTAssertEqual(next.balance, 7); XCTAssertEqual(next.dailyNet, -5)
    }

    func testAllCatalogActionsAndNoDailyLimit() throws {
        var state = PointsState(dateKey: "2026-09-20", balance: 1000)
        XCTAssertEqual(Catalog.tasks.count, 32); XCTAssertEqual(Catalog.rewards.count, 9)
        XCTAssertEqual(Set((Catalog.tasks + Catalog.rewards).map(\.id)).count, 41)
        for item in Catalog.tasks + Catalog.rewards {
            for _ in 0..<3 { try state.include(state.change(itemID: item.id, undo: false), on: state.dateKey) }
            XCTAssertEqual(state.counts[item.id], 3)
            for _ in 0..<3 { try state.include(state.change(itemID: item.id, undo: true), on: state.dateKey) }
            XCTAssertEqual(state.counts[item.id], 0)
            XCTAssertThrowsError(try state.change(itemID: item.id, undo: true))
        }
        XCTAssertEqual(state.balance, 1000); XCTAssertEqual(state.dailyNet, 0)
        XCTAssertThrowsError(try state.change(itemID: "forged", undo: false))
    }

    func testAdjustmentBoundsAndOverflow() throws {
        let state = PointsState(dateKey: "2026-09-20", balance: 100)
        for value in [1, 2, 3, 5, 10, 100, -1, -100] { XCTAssertNoThrow(try state.adjustment(value)) }
        for value in [0, 101, -101, Int.min, Int.max] { XCTAssertThrowsError(try state.adjustment(value)) }
        XCTAssertThrowsError(try PointsState(dateKey: state.dateKey).adjustment(-1))
        XCTAssertThrowsError(try PointsState(dateKey: state.dateKey, balance: Int.max).adjustment(1))
    }

    func testPacificMidnightsAndDST() {
        let parser = ISO8601DateFormatter()
        let cases = [
            ("2026-09-21T06:59:59Z", "2026-09-20"), ("2026-09-21T07:00:00Z", "2026-09-21"),
            ("2026-12-15T07:59:59Z", "2026-12-14"), ("2026-12-15T08:00:00Z", "2026-12-15"),
            ("2026-03-08T09:59:59Z", "2026-03-08"), ("2026-03-08T10:00:00Z", "2026-03-08"),
            ("2026-11-01T08:59:59Z", "2026-11-01"), ("2026-11-01T09:00:00Z", "2026-11-01")
        ]
        for (timestamp, key) in cases { XCTAssertEqual(PacificDate.key(parser.date(from: timestamp)!), key) }
        XCTAssertEqual(PacificDate.weekday("2026-09-20"), "周日")
    }
}
