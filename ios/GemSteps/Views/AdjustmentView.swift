import SwiftUI

struct AdjustmentView: View {
    @Bindable var state: AppState
    @State private var subtract = false
    @State private var amount = "1"
    @State private var validation: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("调整方式", selection: $subtract) {
                        Text("加分").tag(false)
                        Text("减分").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: subtract) { _, _ in validation = nil }
                    TextField("分值（1–100）", text: $amount)
                        .keyboardType(.numberPad)
                        .focused($focused)
                        .accessibilityIdentifier("adjustment-amount")
                        .onChange(of: amount) { _, _ in validation = nil }
                        .onSubmit { submit() }
                } footer: {
                    Text("不关联任务或奖励。当前共有 \(state.points?.balance ?? 0) 分。")
                }
                Section("常用分值") {
                    ViewThatFits(in: .horizontal) {
                        HStack { presets }
                        VStack { presets }
                    }
                }
                if let validation {
                    Section {
                        Text(validation).foregroundStyle(.red)
                            .accessibilityIdentifier("adjustment-validation")
                    }
                }
            }
            .navigationTitle("临时加减分")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { state.adjustmentOpen = false }
                        .keyboardShortcut(.cancelAction)
                        .disabled(state.saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { submit() }
                        .disabled(state.saving)
                        .accessibilityIdentifier("adjustment-submit")
                }
            }
            .interactiveDismissDisabled(state.saving)
        }
    }

    private var presets: some View {
        ForEach([1, 2, 3, 5, 10], id: \.self) { value in
            Button("\(value)") {
                amount = String(value)
                validation = nil
                focused = false
            }
            .buttonStyle(.bordered)
            .frame(maxWidth: .infinity)
            .accessibilityLabel("选择 \(value) 分")
        }
    }

    private func submit() {
        guard let value = Int(amount.trimmingCharacters(in: .whitespaces)), (1...100).contains(value) else {
            validation = "请输入 1–100 的整数"
            return
        }
        if subtract && value > (state.points?.balance ?? 0) {
            validation = "当前最多可减 \(state.points?.balance ?? 0) 分"
            return
        }
        if state.perform(adjustment: value * (subtract ? -1 : 1)) {
            focused = false
            state.adjustmentOpen = false
        } else {
            validation = state.errorMessage ?? "保存失败，请重试"
        }
    }
}
