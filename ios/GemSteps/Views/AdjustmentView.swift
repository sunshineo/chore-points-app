import SwiftUI

struct AdjustmentView: View {
    @Bindable var state: AppState
    @State private var subtract = false
    @State private var validation: String?
    @State private var submittedCelebration: Celebration?

    private var submitted: Bool { submittedCelebration != nil }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button { state.adjustmentOpen = false } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 44, height: 44)
                        .background(Color(uiColor: .tertiarySystemFill), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("关闭")
                .accessibilityIdentifier("adjustment-close")
                .keyboardShortcut(.cancelAction)
                .disabled(state.saving || submitted)
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            ScrollView {
                VStack(spacing: 28) {
                    HStack(spacing: 24) {
                        modeButton(isSubtract: false)
                        modeButton(isSubtract: true)
                    }
                    .padding(.top, 8)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 3), spacing: 14) {
                        ForEach(1...10, id: \.self) { value in
                            if value == 10 {
                                Color.clear
                                    .accessibilityHidden(true)
                            }
                            Button { submit(value) } label: {
                                Text("\(value)")
                                    .font(.system(.largeTitle, design: .rounded, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    .frame(minHeight: 80)
                                    .aspectRatio(1, contentMode: .fit)
                                    .background(modeColor(subtract).gradient, in: RoundedRectangle(cornerRadius: 18))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(subtract ? "减" : "加") \(value) 分")
                            .accessibilityIdentifier("adjustment-value-\(value)")
                        }
                    }
                    .frame(maxWidth: 320)
                    if let validation {
                        Text(validation)
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("adjustment-validation")
                    }
                }
                .frame(maxWidth: 540)
                .padding(24)
                .frame(maxWidth: .infinity)
            }
            .disabled(state.saving || submitted)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .overlay {
            if let celebration = submittedCelebration {
                CelebrationView(celebration: celebration)
                    .task {
                        await state.playCelebration(celebration.id)
                        state.adjustmentOpen = false
                    }
            }
        }
        .interactiveDismissDisabled(state.saving || submitted)
    }

    private func modeColor(_ isSubtract: Bool) -> Color {
        isSubtract
            ? Color(red: 0.80, green: 0.18, blue: 0.22)
            : Color(red: 0.08, green: 0.53, blue: 0.30)
    }

    private func modeButton(isSubtract: Bool) -> some View {
        let selected = subtract == isSubtract
        return Button {
            subtract = isSubtract
            validation = nil
        } label: {
            Image(systemName: isSubtract ? "minus" : "plus")
                .resizable()
                .scaledToFit()
                .fontWeight(.heavy)
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .frame(width: 88, height: 88)
                .background(modeColor(isSubtract).gradient, in: RoundedRectangle(cornerRadius: 22))
                .overlay {
                    RoundedRectangle(cornerRadius: 27)
                        .strokeBorder(selected ? modeColor(isSubtract) : .clear, lineWidth: 3)
                        .padding(-6)
                }
                .opacity(selected ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isSubtract ? "减分" : "加分")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .accessibilityIdentifier(isSubtract ? "adjustment-minus" : "adjustment-plus")
    }

    private func submit(_ value: Int) {
        guard !submitted, !state.saving else { return }
        if subtract && value > (state.points?.balance ?? 0) {
            validation = "当前最多可减 \(state.points?.balance ?? 0) 分"
            return
        }
        if state.perform(adjustment: value * (subtract ? -1 : 1)) {
            validation = nil
            submittedCelebration = state.celebration
        } else {
            validation = state.errorMessage ?? "保存失败，请重试"
        }
    }
}
