import SwiftUI

struct CelebrationView: View {
    @Environment(\.locale) private var locale
    let celebration: Celebration
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        GeometryReader { geometry in
            let imageSize = min(geometry.size.width * 0.55, geometry.size.height * 0.36, 300)
            VStack(spacing: 24) {
                Group {
                    if let image = celebration.image {
                        Image(image).resizable().scaledToFit()
                    } else {
                        Text(celebration.emoji).font(.system(size: imageSize * 0.8))
                    }
                }
                .frame(width: imageSize, height: imageSize)
                .scaleEffect(appeared || reduceMotion ? 1 : 0.5)
                .accessibilityHidden(true)
                Text("\(celebration.value > 0 ? "+" : "−")\(abs(celebration.value))")
                    .font(.system(size: 72, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .foregroundStyle(.tint)
            }
            .multilineTextAlignment(.center)
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .opacity(appeared ? 1 : 0)
            .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.6, bounce: 0.35), value: appeared)
        }
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
        .interactiveDismissDisabled()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(celebration.value >= 0 ? locale.interfaceText("\(locale.interfaceText(String.LocalizationValue(celebration.title))). Points added: \(abs(celebration.value))") : locale.interfaceText("\(locale.interfaceText(String.LocalizationValue(celebration.title))). Points subtracted: \(abs(celebration.value))"))
        .accessibilityIdentifier("celebration")
        .sensoryFeedback(.success, trigger: appeared)
        .onAppear { appeared = true }
    }
}
