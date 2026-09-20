import SwiftUI

struct AdjustmentView: View {
    @Bindable var state: AppState
    let wide: Bool
    @State private var subtract = false
    @State private var amount = "1"
    @State private var validation: String?
    @FocusState private var focused: Bool

    var body: some View {
        ZStack(alignment: wide ? .center : .bottom) {
            Color(hex: 0x020617).opacity(0.55).ignoresSafeArea()
                .onTapGesture { close() }
            ViewThatFits(in: .vertical) {
                panel
                ScrollView { panel }.scrollBounceBehavior(.basedOnSize)
            }
            .frame(maxWidth: 448).padding(16)
        }
        .onAppear { focused = true }
        .accessibilityAddTraits(.isModal)
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("临时加减分").font(.custom("Arial-BoldMT", size: 24, relativeTo: .title2)).foregroundStyle(Color(hex: 0x0f172a)).frame(minHeight: 32)
                    Text("不关联任务或奖励，直接调整总积分").font(.custom("ArialMT", size: 14, relativeTo: .subheadline)).foregroundStyle(Color(hex: 0x64748b)).frame(minHeight: 20)
                }
                Spacer(minLength: 0)
                Button("×") { close() }.font(.system(size: 20, weight: .bold))
                    .frame(width: 40, height: 40).background(Color(hex: 0xf1f5f9), in: Circle())
                    .accessibilityLabel("关闭临时加减分").disabled(state.saving)
                    .keyboardShortcut(.cancelAction)
            }
            HStack(spacing: 12) { mode("＋ 加分", minus: false); mode("− 减分", minus: true) }.padding(.top, 20)
            Text("分值").font(.system(size: 14, weight: .bold)).frame(minHeight: 24).padding(.top, 20)
            TextField("分值", text: $amount).keyboardType(.numberPad).focused($focused)
                .font(.custom("Arial-BoldMT", size: 30, relativeTo: .title)).multilineTextAlignment(.center)
                .padding(.horizontal, 16).padding(.vertical, 12)
                .frame(minHeight: 64)
                .background(Color(hex: 0xeef2ff).opacity(0.6), in: RoundedRectangle(cornerRadius: 16))
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(Color(hex: focused ? 0x818cf8 : 0xe0e7ff), lineWidth: 2) }
                .foregroundStyle(Appearance.indigo).padding(.top, 8)
                .onChange(of: amount) { _, _ in validation = nil }.onSubmit { submit() }
            HStack(spacing: 8) {
                ForEach([1, 2, 3, 5, 10], id: \.self) { value in
                    Button("\(value)") { amount = String(value); validation = nil }
                        .font(.system(size: 14, weight: .bold)).frame(maxWidth: .infinity, minHeight: 36)
                        .foregroundStyle(amount == String(value) ? .white : Color(hex: 0x475569))
                        .background(amount == String(value) ? Appearance.indigo : Color(hex: 0xf1f5f9), in: RoundedRectangle(cornerRadius: 12))
                }
            }.padding(.top, 12)
            Text(validation ?? (subtract ? "当前共有 \(state.points?.balance ?? 0) 分" : " "))
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(validation == nil ? Color(hex: 0x64748b) : Appearance.rose)
                .frame(maxWidth: .infinity, minHeight: 24).padding(.top, 12)
                .accessibilityIdentifier("adjustment-validation")
            Button(state.saving ? "正在保存…" : "\(subtract ? "减" : "加") \(amount.isEmpty ? "0" : amount) 分") { submit() }
                .font(.custom("Arial-BoldMT", size: 18, relativeTo: .headline)).foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(subtract ? Appearance.rose : Appearance.green, in: RoundedRectangle(cornerRadius: 16))
                .padding(.top, 8).disabled(state.saving)
        }
        .foregroundStyle(Color(hex: 0x475569)).padding(wide ? 24 : 20)
        .background(.white, in: RoundedRectangle(cornerRadius: 32))
        .compositingGroup()
        .shadow(color: .black.opacity(0.25), radius: 24, y: 16).buttonStyle(CardButtonStyle())
    }

    private func mode(_ title: String, minus: Bool) -> some View {
        Button { subtract = minus; validation = nil } label: {
            Text(title).font(.custom("Arial-BoldMT", size: 18, relativeTo: .headline))
                .frame(maxWidth: .infinity, minHeight: 56)
                .foregroundStyle(subtract == minus ? (minus ? Appearance.rose : Color(hex: 0x047857)) : Color(hex: 0x64748b))
                .background(subtract == minus ? Color(hex: minus ? 0xfff1f2 : 0xecfdf5) : .white, in: RoundedRectangle(cornerRadius: 16))
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(subtract == minus ? (minus ? Appearance.rose : Appearance.green) : Color(hex: 0xe2e8f0), lineWidth: 2) }
                .opacity(minus && (state.points?.balance ?? 0) <= 0 ? 0.4 : 1)
        }.disabled(minus && (state.points?.balance ?? 0) <= 0)
    }
    private func close() { if !state.saving { state.adjustmentOpen = false } }
    private func submit() {
        guard let value = Double(amount.trimmingCharacters(in: .whitespaces)), value.isFinite,
              value >= 1, value <= 100, value.rounded() == value else {
            validation = "请输入 1–100 的整数"; return
        }
        let balance = state.points?.balance ?? 0
        if subtract && Int(value) > balance { validation = "当前最多可减 \(balance) 分"; return }
        if state.perform(adjustment: Int(value) * (subtract ? -1 : 1)) { close() }
        else { validation = state.errorMessage ?? "保存失败，请重试" }
    }
}
