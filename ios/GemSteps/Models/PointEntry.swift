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
    // Optional additions allow existing on-device ledgers to migrate in place.
    var sequence: Int?
    var reversedEntryID: UUID?
    var titleSnapshot: String?
    var englishTitleSnapshot: String?
    var emojiSnapshot: String?
    var imageSnapshot: String?

    init(change: PointChange, date: Date) {
        id = change.id
        occurredAt = date
        dateKey = PacificDate.key(date)
        kind = change.kind
        itemID = change.itemID
        points = change.points
        reversedEntryID = change.reversedEntryID
        titleSnapshot = change.title
        englishTitleSnapshot = change.englishTitle
        emojiSnapshot = change.emoji
        imageSnapshot = change.image
    }

    var change: PointChange {
        PointChange(kind: kind, itemID: itemID, points: points, id: id,
                    reversedEntryID: reversedEntryID, title: titleSnapshot,
                    englishTitle: englishTitleSnapshot, emoji: emojiSnapshot, image: imageSnapshot)
    }
}
