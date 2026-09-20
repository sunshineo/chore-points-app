import Foundation

struct CatalogItem: Identifiable, Equatable {
    let id: String
    let title: String
    let emoji: String
    let points: Int
    let image: String?
    let isReward: Bool
}

enum Catalog {
    static let tasks: [CatalogItem] = [
        .init(id: "seed-task-morning-toilet", title: "起床后上厕所", emoji: "🚽", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-face", title: "洗脸", emoji: "🚿", points: 1, image: "face-wash", isReward: false),
        .init(id: "seed-task-brush", title: "刷牙", emoji: "🪥", points: 3, image: nil, isReward: false),
        .init(id: "seed-task-clothes", title: "自己穿衣服", emoji: "👕", points: 2, image: nil, isReward: false),
        .init(id: "seed-task-breakfast", title: "把早饭吃干净", emoji: "🍽️", points: 2, image: nil, isReward: false),
        .init(id: "seed-task-shoes", title: "自己穿鞋", emoji: "👟", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-backpack", title: "自己背书包", emoji: "🎒", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-mom-bye", title: "跟妈妈再见", emoji: "🙋", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-grandma-bye", title: "跟姥姥再见", emoji: "🙋", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-seatbelt", title: "自己上车系安全带", emoji: "🚗", points: 1, image: "child-seat-harness", isReward: false),
        .init(id: "seed-task-snack", title: "在学校吃完零食", emoji: "🥡", points: 2, image: nil, isReward: false),
        .init(id: "seed-task-after-school", title: "放学后进屋换鞋", emoji: "🩴", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-handwash", title: "洗手", emoji: "🧼", points: 1, image: "handwash-faucet", isReward: false),
        .init(id: "seed-task-grandma-hi", title: "跟姥姥问好", emoji: "🙋", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-mom-hi", title: "跟妈妈问好", emoji: "🙋", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-dinner", title: "晚饭吃干净", emoji: "🍽️", points: 2, image: nil, isReward: false),
        .init(id: "seed-task-dinner-fruit", title: "晚饭后吃水果", emoji: "🍎", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-floss", title: "用牙线", emoji: "🦷", points: 2, image: "floss-pick", isReward: false),
        .init(id: "seed-task-evening-toilet", title: "上厕所", emoji: "🚽", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-evening-brush", title: "晚上刷牙", emoji: "🪥", points: 1, image: nil, isReward: false),
        .init(id: "seed-task-rinse", title: "用漱口水", emoji: "🧴", points: 1, image: "mouthwash", isReward: false),
        .init(id: "seed-task-pyjamas", title: "自己换睡衣", emoji: "🩳", points: 1, image: "pink-nightgown", isReward: false),
        .init(id: "seed-task-sleep-alone", title: "自己睡觉", emoji: "😴", points: 2, image: nil, isReward: false),
        .init(id: "seed-task-bedtime", title: "准时上床睡觉", emoji: "🛌", points: 3, image: nil, isReward: false),
        .init(id: "seed-task-practice-piano", title: "练钢琴", emoji: "🎹", points: 5, image: nil, isReward: false),
        .init(id: "seed-task-math", title: "做数学题", emoji: "🧮", points: 5, image: nil, isReward: false),
        .init(id: "seed-task-handwriting", title: "练习写汉字", emoji: "✍️", points: 5, image: "chinese-writing-practice", isReward: false),
        .init(id: "seed-task-english", title: "拼写英文单词", emoji: "🔤", points: 5, image: nil, isReward: false),
        .init(id: "seed-task-ballet", title: "上芭蕾课", emoji: "🩰", points: 10, image: nil, isReward: false),
        .init(id: "seed-task-piano", title: "上钢琴课", emoji: "🎼", points: 10, image: nil, isReward: false),
        .init(id: "seed-task-swim", title: "上游泳课", emoji: "🏊", points: 10, image: nil, isReward: false),
        .init(id: "seed-task-chinese-class", title: "上中文课", emoji: "文", points: 10, image: nil, isReward: false),
    ]
    static let rewards: [CatalogItem] = [
        .init(id: "reward-ice-stick", title: "棒棒糖", emoji: "🍭", points: 5, image: nil, isReward: true),
        .init(id: "reward-popsicle", title: "冰棍儿", emoji: "🍧", points: 10, image: "reward-popsicle", isReward: true),
        .init(id: "reward-ice-cream", title: "冰淇淋", emoji: "🍦", points: 15, image: nil, isReward: true),
        .init(id: "reward-sweet", title: "甜点", emoji: "🍰", points: 15, image: nil, isReward: true),
        .init(id: "reward-tv", title: "15分钟看电视", emoji: "📺", points: 15, image: "reward-tv-transparent", isReward: true),
        .init(id: "reward-car-tv", title: "在车上看电视", emoji: "🚗", points: 15, image: "reward-car-tv-3-cropped", isReward: true),
        .init(id: "reward-game", title: "15分钟游戏", emoji: "🎮", points: 15, image: "reward-switch", isReward: true),
        .init(id: "reward-ipad", title: "15分钟 iPad", emoji: "📱", points: 20, image: "reward-ipad-transparent", isReward: true),
        .init(id: "reward-movie", title: "看电影", emoji: "🎬", points: 25, image: nil, isReward: true),
    ]
}
