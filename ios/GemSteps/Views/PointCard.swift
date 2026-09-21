import SwiftUI

// A small shared palette, independent of Web CSS values and item identifiers.
enum PointsColors {
    static let accent = Color.indigo
    static let cards: [Color] = [
        Color(red: 0.76, green: 0.23, blue: 0.48),
        Color(red: 0.58, green: 0.29, blue: 0.76),
        Color(red: 0.39, green: 0.36, blue: 0.78),
        Color(red: 0.18, green: 0.43, blue: 0.76),
        Color(red: 0.04, green: 0.46, blue: 0.59),
        Color(red: 0.05, green: 0.48, blue: 0.43),
        Color(red: 0.22, green: 0.48, blue: 0.25),
        Color(red: 0.67, green: 0.37, blue: 0.09),
    ]
}

struct PointCard: View {
    @Environment(\.locale) private var locale
    let item: CatalogItem
    let color: Color
    let count: Int
    let disabled: Bool
    let side: CGFloat
    @Environment(\.dynamicTypeSize) private var textSize
    let action: () -> Void

    private var score: some View {
        Text("\(item.isReward ? "−" : "+")\(item.points)")
            .padding(.horizontal, 12).padding(.vertical, 4)
            .background(.white.opacity(0.18), in: Capsule())
    }

    private var occurrences: some View {
        Text("Count: \(count)").foregroundStyle(.white)
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Group {
                    if let image = item.image {
                        Image(image).resizable().scaledToFit()
                    } else {
                        Text(item.emoji).font(.system(size: 52))
                    }
                }
                .frame(height: side * 0.36)
                .accessibilityHidden(true)
                Text(verbatim: item.title(locale: locale))
                    .font(.headline)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                score.font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
                if textSize.isAccessibilitySize {
                    occurrences.font(.subheadline)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: textSize.isAccessibilitySize ? side * 1.4 : side)
            .overlay(alignment: .topTrailing) {
                if !textSize.isAccessibilitySize {
                    Text("\(count)")
                        .font(.caption.bold())
                        .padding(8)
                        .background(count > 0 ? Color(red: 0.02, green: 0.40, blue: 0.27) : .black.opacity(0.22), in: Circle())
                        .padding(4)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: 16))
        .tint(color)
        .foregroundStyle(.white)
        .disabled(disabled)
        .accessibilityLabel(item.title(locale: locale))
        .accessibilityValue(item.isReward ? locale.interfaceText("Redeemed today: \(count). Points: \(item.points)") : locale.interfaceText("Completed today: \(count). Points: \(item.points)"))
        .accessibilityIdentifier(item.id)
    }
}
