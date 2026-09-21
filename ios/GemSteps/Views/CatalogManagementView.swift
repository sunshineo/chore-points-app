import SwiftUI

struct CatalogManagementView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @Bindable var state: AppState
    @State private var rewards = false
    @State private var draft: CatalogItem?
    @State private var path: [CatalogItem] = []

    init(state: AppState) {
        self.state = state
        _rewards = State(initialValue: state.rewards)
    }

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if let error = state.errorMessage {
                    Text(locale.interfaceText(String.LocalizationValue(error))).foregroundStyle(.red)
                }
                itemList
            }
            .contentMargins(.top, 8, for: .scrollContent)
            .environment(\.editMode, .constant(.active))
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: CatalogItem.self) { item in
                CatalogItemEditor(state: state, item: item)
                    .environment(\.editMode, .constant(.inactive))
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Item type", selection: $rewards) {
                        Text("Tasks").tag(false)
                        Text("Rewards").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 220)
                    .accessibilityIdentifier("manage-kind")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    closeButton
                        .accessibilityIdentifier("manage-close")
                }
                ToolbarItem(placement: .bottomBar) { Spacer() }
                if #available(iOS 26.0, *) {
                    ToolbarItem(placement: .bottomBar) { addButton }
                        .sharedBackgroundVisibility(.hidden)
                } else {
                    ToolbarItem(placement: .bottomBar) { addButton }
                }
            }
            .sheet(item: $draft) { item in
                NavigationStack {
                    CatalogItemEditor(state: state, item: item, isNew: true)
                }
            }
        }
    }

    private var addButton: some View {
        Button {
            draft = CatalogItem(id: "custom-" + UUID().uuidString, title: "", emoji: rewards ? "🎁" : "⭐",
                                points: 1, image: nil, isReward: rewards, isTemplate: false)
        } label: {
            HStack {
                Image(systemName: "plus")
                Text(rewards ? "Add reward" : "Add task")
            }
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(PointsColors.accent, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("add-item")
    }

    @ViewBuilder
    private var closeButton: some View {
        if #available(iOS 26.0, *) {
            Button(role: .close) { dismiss() }
        } else {
            Button("Close", systemImage: "xmark") { dismiss() }
                .labelStyle(.iconOnly)
        }
    }

    @ViewBuilder
    private var itemList: some View {
        let matching = state.items.filter { $0.isReward == rewards }
        if !matching.isEmpty {
            Section {
                ForEach(matching) { item in
                    HStack(spacing: 4) {
                        HStack(spacing: 6) {
                            Text(item.emoji).font(.title3).accessibilityHidden(true)
                            Text(verbatim: item.title(locale: locale))
                                .lineLimit(1)
                                .truncationMode(.tail)
                            Text("—").foregroundStyle(.secondary).accessibilityHidden(true)
                            Text("\(item.points)")
                                .foregroundStyle(item.isActive ? Color.green : Color.secondary)
                                .monospacedDigit()
                                .fixedSize()
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(item.title(locale: locale) + ", " + locale.interfaceText("Points: \(item.points)"))
                        Button {
                            path.append(item)
                        } label: {
                            Image(systemName: "pencil")
                                .frame(width: 44, height: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel(locale.interfaceText("Edit item") + ": " + item.title(locale: locale))
                        .accessibilityIdentifier("edit-" + item.id)
                        Toggle("Active", isOn: Binding(get: {
                            state.items.first(where: { $0.id == item.id })?.isActive ?? false
                        }, set: { active in
                            var updated = item
                            updated.isActive = active
                            state.saveItem(updated)
                        }))
                        .labelsHidden()
                        .accessibilityLabel(locale.interfaceText("Active") + ": " + item.title(locale: locale))
                        .accessibilityIdentifier("active-" + item.id)
                        .fixedSize()
                    }
                    .foregroundStyle(item.isActive ? Color.primary : Color.secondary)
                    .tint(item.isActive ? PointsColors.accent : Color.gray)
                    .saturation(item.isActive ? 1 : 0)
                    .listRowBackground(
                        Color(uiColor: .secondarySystemGroupedBackground)
                            .overlay(Color.gray.opacity(item.isActive ? 0 : 0.12))
                    )
                }
                .onMove { offsets, destination in
                    var ids = matching.map(\.id)
                    ids.move(fromOffsets: offsets, toOffset: destination)
                    state.reorderItems(ids: ids, isReward: rewards)
                }
            }
        }
    }
}

struct CatalogItemEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @Bindable var state: AppState
    let item: CatalogItem
    let isNew: Bool
    @State private var title: String
    @State private var emoji: String
    @State private var amount: String
    @State private var active: Bool
    @State private var deleting = false

    init(state: AppState, item: CatalogItem, isNew: Bool = false) {
        self.state = state
        self.item = item
        self.isNew = isNew
        _title = State(initialValue: item.title)
        _emoji = State(initialValue: item.emoji)
        _amount = State(initialValue: String(item.points))
        _active = State(initialValue: item.isActive)
    }

    private var valid: Bool {
        guard let value = Int(amount), (1...999).contains(value) else { return false }
        return item.isTemplate || (!title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && title.count <= 100 && emoji.trimmingCharacters(in: .whitespacesAndNewlines).count == 1)
    }

    var body: some View {
        Form {
            Section {
                if item.isTemplate {
                    LabeledContent("Name") { Text(verbatim: item.title(locale: locale)) }
                    LabeledContent("Icon") { Text(item.emoji) }
                } else {
                    LabeledContent("Name") {
                        TextField("Name", text: $title, axis: .vertical)
                            .multilineTextAlignment(.trailing)
                            .accessibilityIdentifier("item-name")
                    }
                    LabeledContent("Icon") {
                        TextField("Icon", text: $emoji)
                            .multilineTextAlignment(.trailing)
                            .accessibilityIdentifier("item-icon")
                    }
                }
            } footer: {
                Text(item.isTemplate ? "Template names and icons are fixed. Names follow the app language." : "Use one emoji or character as the icon. Your text stays the same in every language.")
            }
            Section {
                LabeledContent("Points") {
                    TextField("Points", text: $amount)
                        .multilineTextAlignment(.trailing)
                        .keyboardType(.numberPad)
                        .accessibilityIdentifier("item-points")
                }
                Toggle("Active", isOn: $active)
                    .accessibilityIdentifier("item-active")
            } footer: {
                Text("Enter 1–999 points. Changes apply to future actions. Inactive items are hidden from the daily list.")
            }
            if let error = state.errorMessage {
                Text(locale.interfaceText(String.LocalizationValue(error))).foregroundStyle(.red)
            }
            if !item.isTemplate && !isNew {
                Section {
                    Button("Delete item", role: .destructive) { deleting = true }
                        .accessibilityIdentifier("delete-item")
                }
            }
        }
        .navigationTitle(isNew ? (item.isReward ? "Add reward" : "Add task") : "Edit item")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isNew {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    guard valid, let points = Int(amount) else { return }
                    let updated = CatalogItem(id: item.id, title: title, emoji: emoji, points: points,
                                              image: item.image, isReward: item.isReward, englishTitle: item.englishTitle,
                                              isActive: active, isTemplate: item.isTemplate)
                    if state.saveItem(updated) { dismiss() }
                }
                .disabled(!valid)
                .accessibilityIdentifier("save-item")
            }
        }
        .onAppear { state.errorMessage = nil }
        .confirmationDialog("Delete this item?", isPresented: $deleting, titleVisibility: .visible) {
            Button("Delete item", role: .destructive) {
                if state.deleteItem(id: item.id) { dismiss() }
            }
        } message: {
            Text("Past points are kept. Today’s actions can still be undone in Undo Mode.")
        }
    }
}
