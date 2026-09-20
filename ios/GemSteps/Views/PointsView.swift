import SwiftUI
import Combine

struct PointsView: View {
    @Bindable var state: AppState
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var textSize
    private let timer = Timer.publish(every: 10, on: .main, in: .common).autoconnect()

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                LinearGradient(colors: [Color(hex: 0xf8fafc), Color(hex: 0xeff6ff), Color(hex: 0xeef2ff)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
                if let points = state.points {
                    ScrollView {
                        VStack(spacing: 0) {
                            header(points, wide: geometry.size.width >= 640 && !textSize.isAccessibilitySize)
                            HStack(spacing: 12) {
                                tab("任务", emoji: "✅", rewards: false)
                                tab("奖励", emoji: "🎁", rewards: true)
                            }.padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 4)
                            CardLayout(rewards: state.rewards) {
                                ForEach(Array((state.rewards ? Catalog.rewards : Catalog.tasks).enumerated()), id: \.element.id) { index, item in
                                    let count = points.counts[item.id, default: 0]
                                    PointCard(item: item, index: index, count: count,
                                              disabled: state.undo ? count <= 0 : item.isReward && points.balance < item.points) {
                                        state.perform(itemID: item.id)
                                    }
                                }
                            }.padding(.trailing, state.rewards ? 4 : 0)
                                .padding(.horizontal, 24).padding(.bottom, 24)
                        }
                    }
                    .blur(radius: state.celebration != nil ? 8 : state.adjustmentOpen ? 4 : 0)
                    .allowsHitTesting(state.celebration == nil && !state.adjustmentOpen)
                    .accessibilityHidden(state.celebration != nil || state.adjustmentOpen)
                    if state.adjustmentOpen { AdjustmentView(state: state, wide: geometry.size.width >= 640) }
                    if let celebration = state.celebration {
                        CelebrationView(celebration: celebration).id(celebration.id).zIndex(2)
                    }
                } else {
                    ContentUnavailableView("无法读取积分", systemImage: "exclamationmark.triangle", description: Text(state.loadError ?? "加载失败"))
                }
            }
        }
        .onReceive(timer) { _ in if scenePhase == .active { state.refreshDate() } }
        .onChange(of: scenePhase) { _, phase in if phase == .active { state.refreshDate() } }
    }

    private func header(_ points: PointsState, wide: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if wide {
                HStack(spacing: 12) { balance(wide: true); Spacer(minLength: 0); date(points, wide: true); actions(wide: true) }
            } else {
                HStack(spacing: 12) { balance(wide: false); Spacer(minLength: 0); date(points, wide: false) }
                actions(wide: false)
            }
            if let error = state.errorMessage { Text(error).font(.system(size: 14)).foregroundStyle(Color(hex: 0xffe4e6)) }
            if state.undo { Text("撤销模式：点击可撤销的卡片会执行撤销").font(.system(size: 12)).foregroundStyle(.white.opacity(0.9)).padding(.top, 4) }
        }
        .padding(.horizontal, 24).padding(.vertical, 12).foregroundStyle(.white)
        .background(LinearGradient(colors: [Color(hex: 0x9810fa), Color(hex: 0x4f39f6), Color(hex: 0x155dfc)], startPoint: .topLeading, endPoint: .bottomTrailing))
    }

    private func balance(wide: Bool) -> some View {
        HStack(spacing: wide ? 16 : 12) {
            ZStack {
                Circle().fill(LinearGradient(colors: [Color(hex: 0xffdf20), Color(hex: 0xfacc15), Color(hex: 0xca8a04)], startPoint: .top, endPoint: .bottom))
                Circle().fill(LinearGradient(colors: [Color(hex: 0xfacc15), Color(hex: 0xf59e0b), Color(hex: 0xa16207)], startPoint: .top, endPoint: .bottom)).padding(8)
                Ellipse().fill(Color(hex: 0xfef08a).opacity(0.6)).frame(width: 12, height: 16).offset(x: -6, y: -8).blur(radius: 1)
                Text("★").font(.system(size: 18, weight: .bold)).foregroundStyle(Color(hex: 0x713f12).opacity(0.7))
            }.frame(width: 48, height: 48)
            Text("\(state.displayedPoints)").font(.custom("Arial-BoldMT", size: wide ? 72 : 48)).minimumScaleFactor(0.4).lineLimit(1)
                .accessibilityLabel("总积分 \(pointsBalance)")
                .frame(height: wide ? 72 : 48)
        }
    }
    private var pointsBalance: Int { state.points?.balance ?? 0 }
    private func date(_ points: PointsState, wide: Bool) -> some View {
        HStack(spacing: 8) {
            Text(PacificDate.label(points.dateKey)); Text(PacificDate.weekday(points.dateKey))
            Text("\(points.dailyNet > 0 ? "+" : "")\(points.dailyNet)")
                .font(.custom("Arial-BoldMT", size: wide ? 24 : 18))
                .foregroundStyle(points.dailyNet > 0 ? Color(hex: 0x6ee7b7) : points.dailyNet < 0 ? Color(hex: 0xfda4af) : .white)
        }.font(.custom("Arial-BoldMT", size: wide ? 16 : 12)).fixedSize(horizontal: true, vertical: false)
    }
    private func actions(wide: Bool) -> some View {
        HStack(spacing: 8) {
            Button(state.undo ? "退出撤销" : "撤销模式") { state.undo.toggle() }
                .foregroundStyle(state.undo ? Color(hex: 0xbe123c) : .white)
                .padding(.horizontal, wide ? 12 : 0).frame(maxWidth: wide ? nil : .infinity, minHeight: 44)
                .background(state.undo ? Color(hex: 0xffe4e6) : .white.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
            Button("± 临时加减") { state.adjustmentOpen = true }
                .padding(.horizontal, wide ? 12 : 0).frame(maxWidth: wide ? nil : .infinity, minHeight: 44)
                .background(.white.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
        }.font(.custom("Arial-BoldMT", size: 14, relativeTo: .subheadline)).buttonStyle(.plain)
    }
    private func tab(_ title: String, emoji: String, rewards: Bool) -> some View {
        Button { state.rewards = rewards } label: {
            HStack(spacing: 4) {
                Text(emoji).font(.system(size: 22))
                Text(title).font(.custom("Arial-BoldMT", size: 18, relativeTo: .headline))
            }
                .frame(maxWidth: .infinity, minHeight: 65)
                .foregroundStyle(state.rewards == rewards ? .white : Color(hex: 0x6b7280))
                .background(state.rewards == rewards ? Appearance.indigo : .white, in: RoundedRectangle(cornerRadius: 12))
                .overlay { if state.rewards != rewards { RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xe5e7eb), lineWidth: 2) } }
        }.buttonStyle(.plain).accessibilityAddTraits(state.rewards == rewards ? [.isSelected] : [])
    }
}
