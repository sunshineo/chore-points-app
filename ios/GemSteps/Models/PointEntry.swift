import Foundation
import SwiftData

@Model
final class PointEntry {
    @Attribute(.unique) var id: UUID
    var occurredAt: Date
    var dateKey: String
    var kind: String
    var itemID: String
    var points: Int

    init(change: PointChange, date: Date) {
        id = UUID()
        occurredAt = date
        dateKey = PacificDate.key(date)
        kind = change.kind
        itemID = change.itemID
        points = change.points
    }

    var change: PointChange { PointChange(kind: kind, itemID: itemID, points: points) }
}
