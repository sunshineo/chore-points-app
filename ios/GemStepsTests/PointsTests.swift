import XCTest
@testable import GemSteps

final class PointsTests: XCTestCase {
    func testReferenceSequenceAndRejections() throws {
        var state = PointsState(dateKey: "2026-09-20")
        func act(_ id: String, undo: Bool = false) throws {
            let change = try state.change(itemID: id, undo: undo)
            try state.include(change, on: state.dateKey)
        }
        try act("seed-task-face"); try act("seed-task-face"); try act("seed-task-reading")
        XCTAssertEqual(state.balance, 5)
        XCTAssertEqual(state.counts["seed-task-face"], 2)
        XCTAssertEqual(state.dailyNet, 5)
        try act("reward-sticker")
        XCTAssertEqual(state.balance, 0)
        XCTAssertThrowsError(try state.change(itemID: "seed-task-reading", undo: true)) { XCTAssertEqual($0 as? PointsError, .insufficientBalance) }
        XCTAssertThrowsError(try state.change(itemID: "reward-sticker", undo: false))
        XCTAssertEqual(state.counts["seed-task-reading"], 1)
        try act("reward-sticker", undo: true)
        try act("seed-task-face", undo: true)
        XCTAssertEqual(state.balance, 4)
        XCTAssertEqual(state.counts["reward-sticker"], 0)
        XCTAssertThrowsError(try state.change(itemID: "seed-task-math", undo: true))
        for amount in [-2, 10] { try state.include(state.adjustment(amount), on: state.dateKey) }
        XCTAssertEqual(state.balance, 12)
        XCTAssertEqual(state.counts["seed-task-face"], 1)
        XCTAssertEqual(state.dailyNet, 12)
        var next = PointsState(dateKey: "2026-09-21", balance: state.balance)
        XCTAssertThrowsError(try next.change(itemID: "seed-task-face", undo: true))
        try next.include(next.change(itemID: "reward-sticker", undo: false), on: next.dateKey)
        XCTAssertEqual(next.balance, 7); XCTAssertEqual(next.dailyNet, -5)
    }

    func testAllCatalogActionsAndNoDailyLimit() throws {
        var state = PointsState(dateKey: "2026-09-20", balance: 1000)
        XCTAssertEqual(Catalog.tasks.count, 28); XCTAssertEqual(Catalog.rewards.count, 10)
        XCTAssertEqual(Set((Catalog.tasks + Catalog.rewards).map(\.id)).count, 38)
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
        for value in [1, 100, 101, 999, -1, -100, -101, -999] { XCTAssertNoThrow(try state.adjustment(value)) }
        for value in [0, 1000, -1000, Int.min, Int.max] { XCTAssertThrowsError(try state.adjustment(value)) }
        XCTAssertEqual(try PointsState(dateKey: state.dateKey).adjustment(-999).points, 0)
        XCTAssertThrowsError(try PointsState(dateKey: state.dateKey, balance: Int.max).adjustment(1))
    }

    func testOversizedDeductionRecordsActualAmount() throws {
        var state = PointsState(dateKey: "2026-09-20", balance: 86, dailyNet: 10)
        let change = try state.adjustment(-999)
        XCTAssertEqual(change.points, -86)
        try state.include(change, on: state.dateKey)
        XCTAssertEqual(state.balance, 0)
        XCTAssertEqual(state.dailyNet, -76)
        XCTAssertTrue(state.counts.isEmpty)
        try state.include(state.adjustment(999), on: state.dateKey)
        XCTAssertEqual(state.balance, 999)
        try state.include(state.adjustment(-999), on: state.dateKey)
        XCTAssertEqual(state.balance, 0)
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
        XCTAssertEqual(PacificDate.weekday("2026-09-20", locale: Locale(identifier: "zh-Hans")), "周日")
    }

    func testLocalizedDatesAndBundledInterfaceResources() throws {
        XCTAssertEqual(PacificDate.label("2026-09-20", locale: Locale(identifier: "zh-Hans")), "9月20日")
        XCTAssertEqual(PacificDate.label("2026-09-20", locale: Locale(identifier: "en")), "Sep 20")
        XCTAssertEqual(PacificDate.weekday("2026-09-20", locale: Locale(identifier: "en")), "Sun")
        for (language, title, format) in [
            ("en", "Adjust", "Completed today: %lld. Points: %lld"),
            ("zh-Hans", "手动加减", "今天完成 %lld 次，%lld 分")
        ] {
            let path = try XCTUnwrap(Bundle.main.path(forResource: language, ofType: "lproj"))
            let bundle = try XCTUnwrap(Bundle(path: path))
            XCTAssertEqual(bundle.localizedString(forKey: "Manual Adjustment", value: nil, table: nil), title)
            let actual = bundle.localizedString(forKey: "Completed today: %lld. Points: %lld", value: nil, table: nil)
            XCTAssertEqual(actual, format)
            XCTAssertEqual(String(format: actual, Int64(2), Int64(3)), language == "en" ? "Completed today: 2. Points: 3" : "今天完成 2 次，3 分")
        }
    }


    func testLanguageSelectionAndLiveTextResolution() throws {
        for identifier in ["zh-Hans-CN", "zh-Hant-TW", "zh-HK"] {
            XCTAssertEqual(AppLanguage.initial(preferredLanguages: [identifier]), .chinese)
        }
        for languages in [["en-US"], ["ja-JP", "zh-Hans"], ["fr-FR"], []] {
            XCTAssertEqual(AppLanguage.initial(preferredLanguages: languages), .english)
        }
        let chinese = AppLanguage.chinese.locale()
        let english = AppLanguage.english.locale()
        XCTAssertEqual(chinese.interfaceText("Manual Adjustment"), "手动加减")
        XCTAssertEqual(english.interfaceText("Manual Adjustment"), "Adjust")
        let amount = 3
        XCTAssertEqual(chinese.interfaceText("Points to add: \(amount)"), "加 3 分")
        XCTAssertEqual(english.interfaceText("Points to add: \(amount)"), "Points to add: 3")
        let existingError = "Could not save. Please try again. Your points have not changed."
        XCTAssertEqual(chinese.interfaceText(String.LocalizationValue(existingError)), "保存失败，请重试。积分未改变。")
        XCTAssertEqual(english.interfaceText(String.LocalizationValue(existingError)), existingError)
        let suite = "GemSteps.LanguageTests." + UUID().uuidString
        let preferences = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { preferences.removePersistentDomain(forName: suite) }
        XCTAssertEqual(AppLanguage.initializePreference(in: preferences, preferredLanguages: ["zh-Hant"]), .chinese)
        XCTAssertEqual(AppLanguage.initializePreference(in: preferences, preferredLanguages: ["en-US"]), .chinese)
        let reopened = try XCTUnwrap(UserDefaults(suiteName: suite))
        XCTAssertEqual(AppLanguage(rawValue: reopened.string(forKey: AppLanguage.preferenceKey) ?? ""), .chinese)
    }

}

extension PointsTests {
    func testTemplatesAreBilingualAndCustomNamesAreLiteral() {
        for template in Catalog.tasks + Catalog.rewards {
            XCTAssertFalse(template.englishTitle?.isEmpty ?? true)
            XCTAssertEqual(template.title(locale: Locale(identifier: "zh-Hans")), template.title)
            XCTAssertEqual(template.title(locale: Locale(identifier: "en")), template.englishTitle)
        }
        let custom = CatalogItem(id: "custom-test", title: "Tasks", emoji: "⭐", points: 2,
                                 image: nil, isReward: false, isTemplate: false)
        XCTAssertEqual(custom.title(locale: Locale(identifier: "zh-Hans")), "Tasks")
        XCTAssertEqual(custom.title(locale: Locale(identifier: "en")), "Tasks")
    }

    func testRewardRefundUsesOriginalCostAfterPriceChangeAndDeletion() throws {
        var state = PointsState(dateKey: "2026-09-20", balance: 100)
        let reward = CatalogItem(id: "custom-reward", title: "Park", emoji: "🌳", points: 12,
                                 image: nil, isReward: true, isTemplate: false)
        let redemption = try state.change(itemID: reward.id, undo: false, items: [reward])
        try state.include(redemption, on: state.dateKey)
        XCTAssertEqual(state.balance, 88)
        let expensive = CatalogItem(id: reward.id, title: reward.title, emoji: reward.emoji, points: 50,
                                    image: nil, isReward: true, isTemplate: false)
        XCTAssertEqual(try state.change(itemID: reward.id, undo: true, items: [expensive]).points, 12)
        let refund = try state.change(itemID: reward.id, undo: true, items: [])
        XCTAssertEqual(refund.reversedEntryID, redemption.id)
        try state.include(refund, on: state.dateKey)
        XCTAssertEqual(state.balance, 100)
        XCTAssertThrowsError(try state.change(itemID: reward.id, undo: true, items: []))
    }
}
