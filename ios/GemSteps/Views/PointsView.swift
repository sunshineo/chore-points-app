import SwiftUI
import Combine

struct PointsView: View {
    @Environment(\.locale) private var locale
    @Bindable var state: AppState
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var presentedCelebration: Celebration?
    private let timer = Timer.publish(every: 10, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Group {
                if let points = state.points {
                    page(points)
                } else {
                    ContentUnavailableView("Unable to load points", systemImage: "exclamationmark.triangle", description: Text(locale.interfaceText(String.LocalizationValue(state.loadError ?? "Please reopen the app. Your existing data has not been deleted."))))
                }
            }
            .sheet(isPresented: $state.adjustmentOpen) {
                AdjustmentView(state: state)
            }
        }
        .tint(PointsColors.accent)
        .fullScreenCover(item: $presentedCelebration) { celebration in
            CelebrationView(celebration: celebration)
                .task { await state.playCelebration(celebration.id) }
        }
        .onChange(of: state.celebration?.id) { _, id in
            if id == nil { presentedCelebration = nil }
            else if !state.adjustmentOpen { presentedCelebration = state.celebration }
        }
        .onReceive(timer) { _ in if scenePhase == .active { state.refreshDate() } }
        .onChange(of: scenePhase) { _, phase in if phase == .active { state.refreshDate() } }
    }

    private func page(_ points: PointsState) -> some View {
        GeometryReader { geometry in
            // Phones retain two columns; iPad windows gain columns as space permits.
            let count = UIDevice.current.userInterfaceIdiom == .phone ? 2 : max(2, Int((geometry.size.width - 20) / 190))
            let side = max(1, (geometry.size.width - 32 - CGFloat(count - 1) * 12) / CGFloat(count))
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header(points)
                        .foregroundStyle(.white)
                        .tint(.white)
                        .padding(.vertical, 12)
                        .background {
                            LinearGradient(colors: [.purple, .indigo], startPoint: .topLeading, endPoint: .bottomTrailing)
                                .padding(.horizontal, -16)
                        }
                    if let error = state.errorMessage {
                        Text(locale.interfaceText(String.LocalizationValue(error))).foregroundStyle(.red).accessibilityIdentifier("points-error")
                    }
                    HStack(spacing: 12) {
                        sectionButton("Tasks", systemImage: "checkmark.circle", rewards: false)
                        sectionButton("Rewards", systemImage: "gift", rewards: true)
                    }
                    .accessibilityIdentifier("section-switcher")
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: count), spacing: 12) {
                        ForEach(Array((state.rewards ? Catalog.rewards : Catalog.tasks).enumerated()), id: \.element.id) { index, item in
                            let occurrences = points.counts[item.id, default: 0]
                            PointCard(item: item, color: PointsColors.cards[index % PointsColors.cards.count], count: occurrences,
                                      disabled: state.saving || (state.undo ? occurrences <= 0 : item.isReward && points.balance < item.points),
                                      side: side) {
                                state.perform(itemID: item.id)
                            }
                        }
                    }
                }.padding(16)
            }
        }
        .background {
            Color(uiColor: .systemGroupedBackground)
                .overlay(LinearGradient(colors: [.indigo.opacity(0.06), .purple.opacity(0.03)], startPoint: .top, endPoint: .bottom))
                .ignoresSafeArea()
        }
    }

    private func header(_ points: PointsState) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 24) {
                balance(points).fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: 0)
                day(points).fixedSize(horizontal: true, vertical: false)
                actions.fixedSize(horizontal: true, vertical: false)
                LanguageMenu()
            }
            VStack(spacing: 12) {
                ViewThatFits(in: .horizontal) {
                    summaryRow(points)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            balance(points)
                            Spacer()
                            LanguageMenu()
                        }
                        day(points)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
                actions
            }
        }
    }

    private func summaryRow(_ points: PointsState) -> some View {
        HStack(spacing: 8) {
            balance(points).fixedSize(horizontal: true, vertical: false)
            Spacer(minLength: 0)
            day(points).fixedSize(horizontal: true, vertical: false)
            LanguageMenu()
        }
    }

    private var actions: some View {
        HStack(spacing: 12) {
            Button {
                state.undo.toggle()
            } label: {
                Label(state.undo ? locale.interfaceText("Exit Undo") : locale.interfaceText("Undo Mode"), systemImage: "arrow.uturn.backward")
                    .frame(maxWidth: .infinity, minHeight: 32)
            }
            .accessibilityIdentifier("undo-mode")
            Button {
                state.adjustmentOpen = true
            } label: {
                Label("Manual Adjustment", systemImage: "plusminus")
                    .frame(maxWidth: .infinity, minHeight: 32)
            }
            .accessibilityLabel("Manually adjust points")
            .accessibilityIdentifier("adjustment-open")
        }
        .buttonStyle(.bordered)
    }

    @ViewBuilder
    private func sectionButton(_ title: LocalizedStringKey, systemImage: String, rewards: Bool) -> some View {
        let button = Button { state.rewards = rewards } label: {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .accessibilityIdentifier(rewards ? "section-rewards" : "section-tasks")
        .accessibilityAddTraits(state.rewards == rewards ? [.isSelected] : [])
        if state.rewards == rewards {
            button.buttonStyle(.borderedProminent)
        } else {
            button.buttonStyle(.bordered)
        }
    }

    private func day(_ points: PointsState) -> some View {
        HStack(spacing: 8) {
            Text(PacificDate.label(points.dateKey, locale: locale))
            Text(PacificDate.weekday(points.dateKey, locale: locale))
            Text("\(points.dailyNet > 0 ? "+" : "")\(points.dailyNet)")
                .font(.headline)
                .foregroundStyle(.white)
                .accessibilityLabel("Today’s points: \(points.dailyNet)")
        }
        .font(.subheadline).foregroundStyle(.white.opacity(0.9))
    }

    private func balance(_ points: PointsState) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "star.circle.fill")
                .foregroundStyle(.yellow)
                .accessibilityHidden(true)
            Text("\(points.balance)")
                .monospacedDigit()
                .contentTransition(.numericText(value: Double(points.balance)))
                .animation(reduceMotion ? nil : .default, value: points.balance)
        }
        .font(.largeTitle.bold())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Total points: \(points.balance)")
        .accessibilityIdentifier("points-balance")
    }
}
