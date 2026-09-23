import SwiftUI

struct AdjustmentView: View {
    @Environment(\.locale) private var locale
    @Bindable var state: AppState
    @State private var subtract = false
    @State private var digits = ""
    @State private var validation: String?
    @State private var submittedCelebration: Celebration?

    private var amount: Int { Int(digits) ?? 0 }
    private var submitted: Bool { submittedCelebration != nil }

    var body: some View {
        if #available(iOS 18.0, *) {
            panel.presentationSizing(.fitted)
        } else {
            panel
        }
    }

    private var panel: some View {
        VStack(spacing: 0) {
            HStack {
                if let child = state.currentChild {
                    Text(verbatim: state.childLabel(child, locale: locale)).font(.headline).lineLimit(1)
                }
                Spacer()
                Button { state.adjustmentOpen = false } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 44, height: 44)
                        .background(Color(uiColor: .tertiarySystemFill), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("adjustment-close")
                .keyboardShortcut(.cancelAction)
                .disabled(state.saving || submitted)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            ViewThatFits(in: .vertical) {
                keypad.fixedSize(horizontal: false, vertical: true)
                ScrollView { keypad }
            }
            .disabled(state.saving || submitted)
        }
        .frame(idealWidth: 438, maxWidth: 438)
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

    private var keypad: some View {
        VStack(spacing: 16) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
                modeButton(isSubtract: false)
                Text("\(subtract ? "−" : "+")\(amount)")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(modeColor(subtract))
                    .minimumScaleFactor(0.45)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(subtract ? locale.interfaceText("Points to subtract: \(amount)") : locale.interfaceText("Points to add: \(amount)"))
                    .accessibilityIdentifier("adjustment-amount")
                modeButton(isSubtract: true)
                ForEach(1...9, id: \.self) { digit in digitButton(digit) }
                digitButton(0)
                Button {
                    if !digits.isEmpty { digits.removeLast() }
                    validation = nil
                } label: {
                    Image(systemName: "delete.left")
                        .font(.title2)
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Delete last digit")
                .accessibilityIdentifier("adjustment-delete")
                confirmButton
            }
            if let validation {
                Text(locale.interfaceText(String.LocalizationValue(validation)))
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("adjustment-validation")
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 4)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity)
    }

    private var confirmButton: some View {
        Button { submit(amount) } label: {
            Image(systemName: "checkmark")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 64)
                .background(modeColor(subtract), in: RoundedRectangle(cornerRadius: 16))
                .opacity(amount == 0 ? 0.3 : 1)
        }
        .buttonStyle(.plain)
        .disabled(amount == 0)
        .accessibilityLabel(subtract ? locale.interfaceText("Confirm deduction. Points: \(amount)") : locale.interfaceText("Confirm addition. Points: \(amount)"))
        .accessibilityIdentifier("adjustment-confirm")
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
                .frame(maxWidth: .infinity, minHeight: 64)
                .background {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color(uiColor: .systemGray4))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(modeColor(isSubtract).opacity(selected ? 1 : 0.28))
                        }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isSubtract ? locale.interfaceText("Subtract points") : locale.interfaceText("Add points"))
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .accessibilityIdentifier(isSubtract ? "adjustment-minus" : "adjustment-plus")
    }

    private func digitButton(_ digit: Int) -> some View {
        Button {
            guard digits.count < 3 else { return }
            digits = digits == "0" ? "\(digit)" : digits + "\(digit)"
            validation = nil
        } label: {
            Text("\(digit)")
                .font(.system(.largeTitle, design: .rounded, weight: .medium))
                .frame(maxWidth: .infinity, minHeight: 64)
                .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(digit)")
        .accessibilityIdentifier("adjustment-value-\(digit)")
    }

    private func submit(_ value: Int) {
        guard !submitted, !state.saving else { return }
        guard (1...999).contains(value) else { return }
        if state.perform(adjustment: value * (subtract ? -1 : 1)) {
            validation = nil
            submittedCelebration = state.celebration
        } else {
            validation = state.errorMessage ?? "Could not save. Please try again. Your points have not changed."
        }
    }
}
