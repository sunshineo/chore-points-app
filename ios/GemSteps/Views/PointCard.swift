import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 255) / 255,
                  green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: 1)
    }
}

enum Appearance {
    static let indigo = Color(hex: 0x4f39f6)
    static let green = Color(hex: 0x00bc7d)
    static let rose = Color(hex: 0xff2056)
    static let pairs: [(UInt32, UInt32)] = [
        (0xfb64b6, 0xf6339a), (0xc27aff, 0xad46ff), (0x7c86ff, 0x615fff),
        (0x50a2ff, 0x2b7fff), (0x00d3f2, 0x00b8db), (0x00d5be, 0x00bba7),
        (0x05df72, 0x00c950), (0xfdc700, 0xf0b100), (0xff8904, 0xff6900), (0xff6467, 0xfb2c36)
    ]
}

struct PointCard: View {
    let item: CatalogItem
    let index: Int
    let count: Int
    let disabled: Bool
    let action: () -> Void
    @Environment(\.dynamicTypeSize) private var textSize

    private var imageBox: CGSize {
        guard item.isReward, item.image != nil else { return CGSize(width: 56, height: 56) }
        switch item.id {
        case "reward-tv": return CGSize(width: 116, height: 100)
        case "reward-ipad": return CGSize(width: 100, height: 100)
        case "reward-car-tv": return CGSize(width: 124, height: 88)
        default: return CGSize(width: 88, height: 88)
        }
    }

    var body: some View {
        let pair = Appearance.pairs[(item.isReward ? item.id.utf16.count : index) % 10]
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 16)
                    .fill(LinearGradient(colors: [Color(hex: pair.0), Color(hex: pair.1)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay { RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.3)) }
                VStack(spacing: 0) {
                    Group {
                        if let image = item.image {
                            Image(image).resizable().scaledToFit()
                                .frame(width: item.id == "reward-game" ? 56 : item.id == "reward-ipad" ? 84 : imageBox.width,
                                       height: item.id == "reward-game" ? 56 : item.id == "reward-ipad" ? 84 : imageBox.height)
                        } else { Text(item.emoji).font(.system(size: 48)).frame(height: item.isReward ? 56 : 48) }
                    }
                    .frame(width: imageBox.width, height: item.image != nil ? imageBox.height : item.isReward ? 56 : 48)
                    Text(item.title).font(.custom("Arial-BoldMT", size: 14, relativeTo: .subheadline))
                        .multilineTextAlignment(.center).lineLimit(textSize.isAccessibilitySize ? nil : 2)
                        .frame(maxWidth: 150).padding(.horizontal, 8).padding(.top, 8)
                        .shadow(color: .black.opacity(item.isReward ? 0 : 0.3), radius: 2, y: 1)
                    Text("\(item.isReward ? "-" : "+")\(item.points) 分")
                        .font(.custom("Arial-BoldMT", size: item.isReward ? 12 : 16, relativeTo: .subheadline))
                        .padding(.horizontal, item.isReward ? 12 : 16).padding(.vertical, item.isReward ? 2 : 6)
                        .frame(minHeight: item.isReward ? 20 : 36)
                        .background(.white.opacity(item.isReward ? (disabled ? 0.2 : 0.35) : count > 0 ? 0.4 : 0.3), in: Capsule())
                        .padding(.top, item.isReward ? 4 : 8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .zIndex(item.isReward ? 1 : 0)
                Text("\(count)").font(.custom("Arial-BoldMT", size: 16))
                    .frame(width: 36, height: 36)
                    .background(item.isReward ? (disabled ? Color(hex: 0x6b7280) : Appearance.rose) : (count > 0 ? Appearance.green : Color(hex: 0x6b7280)), in: Circle())
                    .padding(8)
            }
            .foregroundStyle(.white).frame(width: 165, height: textSize.isAccessibilitySize ? 240 : 165)
            .shadow(color: .black.opacity(0.1), radius: 7, y: 5)
            .compositingGroup()
            .opacity(disabled ? 0.55 : 1)
        }
        .buttonStyle(CardButtonStyle()).disabled(disabled)
        .accessibilityLabel(item.title)
        .accessibilityValue("\(item.isReward ? "兑换" : "完成") \(count) 次，\(item.points) 分")
        .accessibilityIdentifier(item.id)
    }
}

struct CardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
    }
}

/// Web tasks wrap fixed tiles; rewards distribute min-150 tracks with fixed 165 tiles.
struct CardLayout: Layout {
    let rewards: Bool

    private func columns(_ width: CGFloat) -> Int {
        max(1, Int((width + 12) / (rewards ? 162 : 177)))
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 342
        let cols = columns(width)
        let height = subviews.map { $0.sizeThatFits(.unspecified).height }.max() ?? 165
        let rows = (subviews.count + cols - 1) / cols
        return CGSize(width: width, height: CGFloat(rows) * (height + 12) - (rows > 0 ? 12 : 0))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let cols = columns(bounds.width)
        let height = subviews.map { $0.sizeThatFits(.unspecified).height }.max() ?? 165
        let stride = rewards ? (bounds.width + 12) / CGFloat(cols) : 177
        for (index, view) in subviews.enumerated() {
            view.place(at: CGPoint(x: bounds.minX + CGFloat(index % cols) * stride,
                                   y: bounds.minY + CGFloat(index / cols) * (height + 12)),
                       anchor: .topLeading, proposal: ProposedViewSize(width: 165, height: height))
        }
    }
}
