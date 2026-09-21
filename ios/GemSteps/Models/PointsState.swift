import Foundation

enum PacificDate {
    #if DEBUG
    private static let launchTime = Date()
    #endif
    static var now: Date {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        if let index = args.firstIndex(of: "-gemsteps-date"), args.indices.contains(index + 1),
           let date = ISO8601DateFormatter().date(from: args[index + 1]) {
            return args.contains("-gemsteps-date-advances")
                ? date.addingTimeInterval(Date().timeIntervalSince(launchTime)) : date
        }
        #endif
        return Date()
    }

    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        return calendar
    }

    static func key(_ date: Date) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
    }

    // Match date text to the app language; keep the existing business time zone.
    static var displayLocale: Locale {
        Locale(identifier: Bundle.main.preferredLocalizations.first ?? "en")
    }

    static func label(_ key: String, locale: Locale = displayLocale) -> String {
        formatted(key, template: "MMMd", locale: locale)
    }

    static func weekday(_ key: String, locale: Locale = displayLocale) -> String {
        formatted(key, template: "EEE", locale: locale)
    }

    private static func formatted(_ key: String, template: String, locale: Locale) -> String {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)) else { return key }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter.string(from: date)
    }

}

struct PointChange {
    let kind: String
    let itemID: String
    let points: Int
}

enum PointsError: Error, Equatable {
    case invalidAmount, unknownItem, noOccurrence, insufficientBalance, overflow
}

struct PointsState {
    var dateKey: String
    var balance = 0
    var dailyNet = 0
    var counts: [String: Int] = [:]

    func change(itemID: String, undo: Bool) throws -> PointChange {
        guard let item = (Catalog.tasks + Catalog.rewards).first(where: { $0.id == itemID }) else {
            throw PointsError.unknownItem
        }
        if undo && counts[itemID, default: 0] <= 0 { throw PointsError.noOccurrence }
        let points = item.points * (item.isReward ? -1 : 1) * (undo ? -1 : 1)
        try validateBalance(points)
        return PointChange(kind: item.isReward ? "reward" : "task", itemID: itemID, points: points)
    }

    func adjustment(_ points: Int) throws -> PointChange {
        guard (-999...999).contains(points), points != 0 else { throw PointsError.invalidAmount }
        let actual = points < 0 ? -min(balance, -points) : points
        try validateBalance(actual)
        return PointChange(kind: "adjustment", itemID: "manual-adjustment", points: actual)
    }

    func validateBalance(_ points: Int) throws {
        let result = balance.addingReportingOverflow(points)
        guard !result.overflow else { throw PointsError.overflow }
        guard result.partialValue >= 0 else { throw PointsError.insufficientBalance }
    }

    mutating func include(_ change: PointChange, on key: String) throws {
        let total = balance.addingReportingOverflow(change.points)
        guard !total.overflow else { throw PointsError.overflow }
        balance = total.partialValue
        guard key == dateKey else { return }
        let daily = dailyNet.addingReportingOverflow(change.points)
        guard !daily.overflow else { throw PointsError.overflow }
        dailyNet = daily.partialValue
        if change.kind == "task" { counts[change.itemID, default: 0] += change.points > 0 ? 1 : -1 }
        if change.kind == "reward" { counts[change.itemID, default: 0] += change.points < 0 ? 1 : -1 }
    }
}
