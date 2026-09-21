import Foundation

struct CatalogItem: Identifiable, Hashable {
    let id: String
    let title: String
    let emoji: String
    let points: Int
    let image: String?
    let isReward: Bool
    var englishTitle: String? = nil
    var isActive: Bool = true
    var isTemplate: Bool = true
    var enabledByDefault: Bool = true

    func title(locale: Locale) -> String {
        locale.language.languageCode?.identifier == "zh" ? title : (englishTitle ?? title)
    }
}

enum Catalog {
    static let tasks: [CatalogItem] = [
        .init(id: "seed-task-make-bed", title: "整理床铺", emoji: "🛏️", points: 2, image: nil, isReward: false, englishTitle: "Make my bed", enabledByDefault: true),
        .init(id: "seed-task-brush", title: "早上刷牙", emoji: "🪥", points: 2, image: nil, isReward: false, englishTitle: "Brush my teeth in the morning", enabledByDefault: false),
        .init(id: "seed-task-face", title: "洗脸", emoji: "🚿", points: 1, image: "face-wash", isReward: false, englishTitle: "Wash my face", enabledByDefault: false),
        .init(id: "seed-task-clothes", title: "穿好衣服", emoji: "👕", points: 1, image: nil, isReward: false, englishTitle: "Get dressed", enabledByDefault: true),
        .init(id: "seed-task-pack-bag", title: "整理书包", emoji: "🎒", points: 2, image: nil, isReward: false, englishTitle: "Pack my school bag", enabledByDefault: false),
        .init(id: "seed-task-shoes", title: "穿好鞋子", emoji: "👟", points: 1, image: nil, isReward: false, englishTitle: "Put on my shoes", enabledByDefault: true),
        .init(id: "seed-task-say-goodbye", title: "离开时说再见", emoji: "🙋", points: 1, image: nil, isReward: false, englishTitle: "Say goodbye when leaving", enabledByDefault: false),
        .init(id: "seed-task-buckle-up", title: "配合系好安全带", emoji: "🚗", points: 1, image: "child-seat-harness", isReward: false, englishTitle: "Cooperate with buckling up", enabledByDefault: false),
        .init(id: "seed-task-say-hello", title: "主动打招呼", emoji: "👋", points: 1, image: nil, isReward: false, englishTitle: "Say hello", enabledByDefault: false),
        .init(id: "seed-task-put-shoes-away", title: "回家把鞋放好", emoji: "👟", points: 1, image: nil, isReward: false, englishTitle: "Put away my shoes when I get home", enabledByDefault: false),
        .init(id: "seed-task-handwash", title: "洗手", emoji: "🧼", points: 1, image: "handwash-faucet", isReward: false, englishTitle: "Wash my hands", enabledByDefault: true),
        .init(id: "seed-task-homework", title: "完成约定的作业", emoji: "📝", points: 3, image: nil, isReward: false, englishTitle: "Finish the agreed homework", enabledByDefault: false),
        .init(id: "seed-task-writing", title: "练习书写", emoji: "✍️", points: 3, image: nil, isReward: false, englishTitle: "Practice handwriting", enabledByDefault: false),
        .init(id: "seed-task-math", title: "练习数学", emoji: "🧮", points: 3, image: nil, isReward: false, englishTitle: "Practice math", enabledByDefault: false),
        .init(id: "seed-task-words", title: "练习单词", emoji: "🔤", points: 3, image: nil, isReward: false, englishTitle: "Practice words", enabledByDefault: false),
        .init(id: "seed-task-instrument", title: "练习乐器", emoji: "🎵", points: 3, image: nil, isReward: false, englishTitle: "Practice an instrument", enabledByDefault: false),
        .init(id: "seed-task-extracurricular", title: "完成课外练习", emoji: "🎯", points: 3, image: nil, isReward: false, englishTitle: "Complete extracurricular practice", enabledByDefault: false),
        .init(id: "seed-task-tidy-toys", title: "收好玩具", emoji: "🧸", points: 2, image: nil, isReward: false, englishTitle: "Put away my toys", enabledByDefault: true),
        .init(id: "seed-task-put-things-away", title: "把用过的物品放回原处", emoji: "📦", points: 1, image: nil, isReward: false, englishTitle: "Put things back where they belong", enabledByDefault: false),
        .init(id: "seed-task-set-table", title: "帮忙摆餐具", emoji: "🍽️", points: 2, image: nil, isReward: false, englishTitle: "Help set the table", enabledByDefault: false),
        .init(id: "seed-task-clear-dishes", title: "饭后收好自己的餐具", emoji: "🥣", points: 2, image: nil, isReward: false, englishTitle: "Clear my dishes after a meal", enabledByDefault: false),
        .init(id: "seed-task-wipe-table", title: "擦桌子", emoji: "🧽", points: 2, image: nil, isReward: false, englishTitle: "Wipe the table", enabledByDefault: false),
        .init(id: "seed-task-pyjamas", title: "换好睡衣", emoji: "👕", points: 1, image: nil, isReward: false, englishTitle: "Put on my pajamas", enabledByDefault: false),
        .init(id: "seed-task-laundry-basket", title: "把脏衣服放进洗衣篮", emoji: "🧺", points: 1, image: nil, isReward: false, englishTitle: "Put dirty clothes in the laundry basket", enabledByDefault: false),
        .init(id: "seed-task-floss", title: "用牙线", emoji: "🦷", points: 2, image: "floss-pick", isReward: false, englishTitle: "Floss my teeth", enabledByDefault: false),
        .init(id: "seed-task-evening-brush", title: "晚上刷牙", emoji: "🪥", points: 2, image: nil, isReward: false, englishTitle: "Brush my teeth at night", enabledByDefault: true),
        .init(id: "seed-task-reading", title: "阅读或一起读书", emoji: "📚", points: 3, image: nil, isReward: false, englishTitle: "Read on my own or together", enabledByDefault: true),
        .init(id: "seed-task-bedtime", title: "按约定时间上床", emoji: "🛌", points: 2, image: nil, isReward: false, englishTitle: "Go to bed at the agreed time", enabledByDefault: true),
    ]
    static let rewards: [CatalogItem] = [
        .init(id: "reward-sticker", title: "选一张贴纸", emoji: "⭐", points: 5, image: nil, isReward: true, englishTitle: "Choose a sticker", enabledByDefault: true),
        .init(id: "reward-family-game", title: "决定下一次家庭游戏玩什么", emoji: "🎲", points: 10, image: nil, isReward: true, englishTitle: "Choose the next family game", enabledByDefault: true),
        .init(id: "reward-craft", title: "选择一次手工活动", emoji: "🎨", points: 10, image: nil, isReward: true, englishTitle: "Choose a craft activity", enabledByDefault: true),
        .init(id: "reward-weekend-activity", title: "选择周末的一项活动", emoji: "🌳", points: 20, image: nil, isReward: true, englishTitle: "Choose a weekend activity", enabledByDefault: true),
        .init(id: "reward-family-movie", title: "选一部家庭电影", emoji: "🎬", points: 20, image: nil, isReward: true, englishTitle: "Choose a family movie", enabledByDefault: false),
        .init(id: "reward-video", title: "看视频 15 分钟", emoji: "📺", points: 15, image: "reward-tv-transparent", isReward: true, englishTitle: "15 minutes of videos", enabledByDefault: false),
        .init(id: "reward-game", title: "电子游戏 15 分钟", emoji: "🎮", points: 15, image: nil, isReward: true, englishTitle: "15 minutes of video games", enabledByDefault: false),
        .init(id: "reward-book", title: "选一本新书", emoji: "📖", points: 30, image: nil, isReward: true, englishTitle: "Choose a new book", enabledByDefault: false),
        .init(id: "reward-small-gift", title: "选一份约定预算内的小礼物", emoji: "🎁", points: 40, image: nil, isReward: true, englishTitle: "Choose a small gift within the agreed budget", enabledByDefault: false),
        .init(id: "reward-outing", title: "安排一次特别出游", emoji: "🎡", points: 60, image: nil, isReward: true, englishTitle: "Plan a special outing", enabledByDefault: false),
    ]
}
