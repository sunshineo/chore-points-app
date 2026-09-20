import SwiftUI

struct CelebrationView: View {
    let celebration: Celebration
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var started = Date()

    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation) { context in
                let elapsed = context.date.timeIntervalSince(started)
                ZStack {
                    Color.white.opacity(0.88).ignoresSafeArea()
                    if !reduceMotion {
                        ForEach(0..<16, id: \.self) { index in
                            let delay = Double((index * 17) % 80) / 100
                            let duration = 1.5 + Double((index * 29) % 100) / 100
                            let progress = max(0, min(1, (elapsed - delay) / duration))
                            let size = CGFloat(20 + (index * 31) % 20)
                            Group {
                                if let image = celebration.image { Image(image).resizable().scaledToFit() }
                                else { Text(celebration.emoji).font(.system(size: size)) }
                            }
                            .frame(width: size, height: size)
                            .rotationEffect(.degrees(progress * 360))
                            .opacity(elapsed < delay ? 1 : 1 - progress)
                            .position(x: geometry.size.width * CGFloat((index * 37 + 11) % 100) / 100 + size / 2,
                                      y: -40 + size / 2 + 500 * progress * progress)
                        }
                    }
                    Text("\(celebration.value > 0 ? "+" : "")\(celebration.value)")
                        .font(.custom("Arial-BoldMT", size: 96))
                        .foregroundStyle(celebration.value > 0 ? Appearance.green : Appearance.rose)
                        .shadow(color: .black.opacity(0.25), radius: 5, y: 2)
                        .opacity(reduceMotion ? 1 : min(1, elapsed / 0.18) * max(0, min(1, (1.8 - elapsed) / 0.396)))
                        .scaleEffect(reduceMotion ? 1 : 0.85 + min(elapsed / 1.8, 1) * 0.25 + (elapsed < 0.7 ? sin(elapsed / 0.7 * .pi) * 0.08 : 0))
                        .offset(y: reduceMotion ? 0 : (elapsed < 0.7 ? -12 * sin(elapsed / 0.7 * .pi) : 0))
                }.frame(width: geometry.size.width, height: geometry.size.height).clipped()
            }
        }
        .contentShape(Rectangle()).onTapGesture { }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(celebration.value > 0 ? "加" : "减") \(abs(celebration.value)) 分")
    }
}
