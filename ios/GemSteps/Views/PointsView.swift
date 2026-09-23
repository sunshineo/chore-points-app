import SwiftUI
import Combine

struct PointsView: View {
    @Environment(\.locale) private var locale
    @Bindable var state: AppState
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
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
        .sheet(isPresented: $state.managementOpen) {
            CatalogManagementView(state: state)
        }
        .sheet(isPresented: $state.childrenOpen) {
            ChildrenView(state: state)
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
                    if state.visibleItems.isEmpty {
                        ContentUnavailableView {
                            Label(state.undo ? "Nothing to undo" : "No active items", systemImage: "checklist")
                        } description: {
                            Text(state.undo ? "Completed tasks and redeemed rewards appear here today." : "Enable a template or add your own item in Manage.")
                        } actions: {
                            if !state.undo { Button("Manage") { state.managementOpen = true } }
                        }
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: count), spacing: 12) {
                        ForEach(Array(state.visibleItems.enumerated()), id: \.element.id) { index, item in
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
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            balance(points)
                            Spacer()
                            LanguageMenu()
                        }
                        day(points)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    summaryRow(points)
                }
                actions
            }
        }
    }

    private func summaryRow(_ points: PointsState) -> some View {
        HStack(spacing: 8) {
            balance(points)
            Spacer(minLength: 0)
            day(points).lineLimit(1).minimumScaleFactor(0.7)
            LanguageMenu()
        }
    }

    private var actions: some View {
        let layout = dynamicTypeSize.isAccessibilitySize && UIDevice.current.userInterfaceIdiom == .phone
            ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 12))
        return layout {
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
            Button {
                state.errorMessage = nil
                state.managementOpen = true
            } label: {
                Image(systemName: "slider.horizontal.3").frame(minWidth: 32, minHeight: 32)
            }
            .accessibilityLabel("Manage tasks and rewards")
            .accessibilityIdentifier("manage-open")
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
            Button {
                state.errorMessage = nil
                state.childrenOpen = true
            } label: {
                HStack(spacing: 4) {
                    Text(verbatim: state.currentChildLabel(locale: locale)).lineLimit(1)
                    Image(systemName: "chevron.down").font(.caption)
                }
                .font(.headline)
                .frame(minHeight: 44)
                .fixedSize(horizontal: true, vertical: false)
            }
            .buttonStyle(.plain)
            .disabled(!state.canSwitchChild)
            .accessibilityLabel(locale.interfaceText("Switch child") + ": " + state.currentChildLabel(locale: locale))
            .accessibilityIdentifier("child-switcher")
            HStack(spacing: 8) {
                Text("\(points.balance)")
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .contentTransition(.numericText(value: Double(points.balance)))
                    .animation(reduceMotion ? nil : .default, value: points.balance)
                Image(systemName: "star.fill")
                    .foregroundStyle(.yellow)
                    .accessibilityHidden(true)
            }
            .font(.largeTitle.bold())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Total points: \(points.balance)")
            .accessibilityIdentifier("points-balance")
        }
    }
}

struct ChildrenView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @Bindable var state: AppState
    @State private var removing: ChildProfile?

    var body: some View {
        NavigationStack {
            List {
                if let error = state.errorMessage {
                    Text(locale.interfaceText(String.LocalizationValue(error))).foregroundStyle(.red)
                }
                Section {
                    if state.children.isEmpty {
                        Button { dismiss() } label: {
                            HStack {
                                Text(verbatim: state.currentChildLabel(locale: locale)).foregroundStyle(.primary)
                                Spacer()
                                Image(systemName: "checkmark").accessibilityLabel("Current child")
                                Image(systemName: "trash").foregroundStyle(.tertiary)
                                    .frame(width: 44, height: 44).accessibilityHidden(true)
                            }
                            .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                    }
                    ForEach(state.sortedChildren) { child in
                        HStack {
                            Button {
                                if state.switchChild(child.id) { dismiss() }
                            } label: {
                                HStack {
                                    Text(verbatim: state.childLabel(child, locale: locale)).foregroundStyle(.primary)
                                    Spacer()
                                    if child.id == state.currentChildID {
                                        Image(systemName: "checkmark").accessibilityLabel("Current child")
                                    }
                                }
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("select-child-" + child.id.uuidString)

                            Button(role: .destructive) { removing = child } label: {
                                Image(systemName: "trash").frame(width: 44, height: 44)
                            }
                            .buttonStyle(.borderless)
                            .disabled(state.children.count <= 1 || !state.canSwitchChild)
                            .accessibilityLabel(locale.interfaceText("Remove child") + " " + state.childLabel(child, locale: locale))
                            .accessibilityIdentifier("remove-child-" + child.id.uuidString)
                        }
                    }
                }
                Section {
                    Button("Add child", systemImage: "plus") {
                        state.errorMessage = nil
                        state.addChild()
                    }
                    .disabled(state.saving || !state.canAddChild)
                    .accessibilityIdentifier("add-child")
                    if !state.canAddChild { Text("Up to 9 children are supported.").foregroundStyle(.secondary) }
                }
            }
            .alert("Remove child?", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }), presenting: removing) { child in
                Button("Remove", role: .destructive) { state.removeChild(child.id); removing = nil }
                Button("Cancel", role: .cancel) { removing = nil }
            } message: { child in
                Text(locale.interfaceText("Remove") + " " + state.childLabel(child, locale: locale) + "? " + locale.interfaceText("This permanently deletes this child’s points, history, tasks and rewards. Other children are not affected."))
            }
            .navigationTitle("Switch child")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
