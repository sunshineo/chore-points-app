import Foundation
import SwiftData

@Model
final class TemplateSetting {
    @Attribute(.unique) var templateID: String
    var points: Int
    var isActive: Bool

    init(template: CatalogItem, isActive: Bool) {
        templateID = template.id
        points = template.points
        self.isActive = isActive
    }
}

@Model
final class CatalogInitialization {
    @Attribute(.unique) var key: String
    var orderedIDs: [String]?
    var dailyTaskOrderApplied: Bool?
    init() { key = "catalog" }
}

@Model
final class CustomItem {
    @Attribute(.unique) var id: String
    var title: String
    var emoji: String
    var points: Int
    var isReward: Bool
    var isActive: Bool
    var createdAt: Date

    init(item: CatalogItem) {
        id = item.id
        title = item.title
        emoji = item.emoji
        points = item.points
        isReward = item.isReward
        isActive = item.isActive
        createdAt = Date()
    }

    var item: CatalogItem {
        CatalogItem(id: id, title: title, emoji: emoji, points: points, image: nil,
                    isReward: isReward, isActive: isActive, isTemplate: false)
    }
}

enum CatalogError: Error {
    case invalidItem, protectedTemplate, missingItem
}
