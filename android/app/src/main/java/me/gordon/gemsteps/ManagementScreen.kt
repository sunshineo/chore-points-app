package me.gordon.gemsteps

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.util.UUID

@Composable
fun ManagementScreen(vm: GemViewModel) {
    var rewards by rememberSaveable { mutableStateOf(vm.rewards) }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var newItem by rememberSaveable { mutableStateOf(false) }
    val all = vm.snapshot?.items ?: emptyList()
    val matching = all.filter { it.reward == rewards }
    var orderedIds by remember(matching) { mutableStateOf(matching.map { it.id }) }
    var dragging by remember { mutableStateOf<String?>(null) }
    var originalIds by remember { mutableStateOf(emptyList<String>()) }
    LaunchedEffect(vm.busy, matching) {
        if (!vm.busy && dragging == null) orderedIds = matching.map { it.id }
    }
    val byId = matching.associateBy { it.id }
    val listState = rememberLazyListState()
    val threshold = with(LocalDensity.current) { 64.dp.toPx() }
    val chinese = isChinese()
    val moveUp = stringResource(R.string.move_up)
    val moveDown = stringResource(R.string.move_down)
    fun move(id: String, delta: Int): Boolean {
        val ids = orderedIds.toMutableList()
        val from = ids.indexOf(id)
        val to = from + delta
        if (from < 0 || to !in ids.indices) return false
        ids.add(to, ids.removeAt(from))
        orderedIds = ids
        return true
    }
    fun moveAndSave(id: String, delta: Int): Boolean {
        if (vm.busy) return false
        if (!move(id, delta)) return false
        vm.reorder(orderedIds, rewards)
        return true
    }
    BackHandler(enabled = editingId == null) { if (!vm.busy) vm.showManagement(false) }
    Scaffold(modifier = Modifier.safeDrawingPadding(), topBar = {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, top = 8.dp, end = 4.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically) {
            SectionPicker(rewards, Modifier.weight(1f)) { if (!vm.busy && dragging == null) rewards = it }
            CloseButton(Modifier.testTag("manage-close"), !vm.busy) { vm.showManagement(false) }
        }
    }, bottomBar = {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.End) {
            Button(onClick = { newItem = true; editingId = "custom-${UUID.randomUUID()}"; vm.clearError() },
                enabled = !vm.busy, modifier = Modifier.testTag("add-item")) {
                Icon(Icons.Default.Add, null)
                Spacer(Modifier.width(6.dp))
                Text(stringResource(if (rewards) R.string.add_reward else R.string.add_task))
            }
        }
    }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).testTag("management-list"), state = listState) {
            if (vm.error != null) item { ErrorText(vm.error) }
            items(orderedIds, key = { it }) { id ->
                val item = byId[id] ?: return@items
                val name = item.name(chinese)
                val reorderLabel = stringResource(R.string.reorder_named, name)
                var reorderMenu by remember { mutableStateOf(false) }
                Surface(color = if (dragging == id) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth().animateItem()) {
                    Column(Modifier.padding(horizontal = 12.dp)) {
                        Row(Modifier.fillMaxWidth().heightIn(min = 64.dp), verticalAlignment = Alignment.CenterVertically) {
                            ItemIcon(item, 28.dp, Modifier.alpha(if (item.active) 1f else .4f))
                            Spacer(Modifier.width(6.dp))
                            Text(name, modifier = Modifier.weight(1f).alpha(if (item.active) 1f else .45f),
                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(" — ", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(item.points.toString(), color = if (item.active) Positive else MaterialTheme.colorScheme.onSurfaceVariant)
                            ActionIcon(Icons.Default.Edit, stringResource(R.string.edit_named, name),
                                Modifier.testTag("edit-$id"), !vm.busy) { newItem = false; editingId = id; vm.clearError() }
                            val activeLabel = stringResource(R.string.active_named, name)
                            Switch(checked = item.active, onCheckedChange = { vm.save(item.copy(active = it)) },
                                enabled = !vm.busy, modifier = Modifier.testTag("active-$id").semantics { contentDescription = activeLabel })
                            Box {
                                ActionIcon(Icons.Default.DragHandle, reorderLabel,
                                    Modifier.testTag("reorder-$id").semantics {
                                        customActions = listOf(
                                            CustomAccessibilityAction(moveUp) { moveAndSave(id, -1) },
                                            CustomAccessibilityAction(moveDown) { moveAndSave(id, 1) })
                                    }.pointerInput(id, vm.busy) {
                                        if (!vm.busy) {
                                            var accumulated = 0f
                                            detectDragGestures(onDragStart = {
                                                dragging = id; originalIds = orderedIds; accumulated = 0f
                                            }, onDragCancel = {
                                                orderedIds = originalIds; dragging = null
                                            }, onDragEnd = {
                                                dragging = null
                                                if (orderedIds != originalIds) vm.reorder(orderedIds, rewards)
                                            }) { change, amount ->
                                                change.consume()
                                                accumulated += amount.y
                                                if (kotlin.math.abs(accumulated) >= threshold) {
                                                    val delta = if (accumulated > 0) 1 else -1
                                                    if (move(id, delta)) accumulated -= threshold * delta
                                                }
                                            }
                                        }
                                    }, !vm.busy) { reorderMenu = true }
                                DropdownMenu(reorderMenu, { reorderMenu = false }) {
                                    DropdownMenuItem(text = { Text(moveUp) }, enabled = orderedIds.indexOf(id) > 0,
                                        onClick = { reorderMenu = false; moveAndSave(id, -1) })
                                    DropdownMenuItem(text = { Text(moveDown) }, enabled = orderedIds.indexOf(id) < orderedIds.lastIndex,
                                        onClick = { reorderMenu = false; moveAndSave(id, 1) })
                                }
                            }
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }
    editingId?.let { id ->
        val item = all.firstOrNull { it.id == id } ?: Item(id = id, title = "", emoji = if (rewards) "🎁" else "⭐", points = 1, reward = rewards)
        ItemEditor(vm, item, newItem) { editingId = null }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ItemEditor(vm: GemViewModel, item: Item, isNew: Boolean, close: () -> Unit) {
    var title by rememberSaveable(item.id) { mutableStateOf(item.title) }
    var emoji by rememberSaveable(item.id) { mutableStateOf(item.emoji) }
    var amount by rememberSaveable(item.id) { mutableStateOf(item.points.toString()) }
    var active by rememberSaveable(item.id) { mutableStateOf(item.active) }
    var deleting by rememberSaveable { mutableStateOf(false) }
    val valid = (amount.toIntOrNull() ?: 0) in 1..999 && (item.template || validCustomText(title, emoji))
    Dialog(onDismissRequest = { if (!vm.busy) close() }, properties = DialogProperties(
        usePlatformDefaultWidth = false, dismissOnBackPress = !vm.busy, dismissOnClickOutside = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Scaffold(topBar = {
                TopAppBar(title = { Text(stringResource(if (!isNew) R.string.edit_item else if (item.reward) R.string.add_reward else R.string.add_task)) },
                    navigationIcon = { CloseButton(enabled = !vm.busy, close = close) },
                    actions = { TextButton(onClick = {
                        vm.save(item.copy(title = title, emoji = emoji, points = amount.toInt(), active = active), close)
                    }, enabled = valid && !vm.busy, modifier = Modifier.testTag("save-item")) { Text(stringResource(R.string.save)) } })
            }) { padding ->
                Column(Modifier.padding(padding).imePadding().verticalScroll(rememberScrollState())
                    .padding(20.dp).widthIn(max = 640.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (item.template) {
                        Text(item.name(isChinese()), style = MaterialTheme.typography.titleLarge)
                        ItemIcon(item, 48.dp)
                    } else {
                        OutlinedTextField(title, { title = it }, label = { Text(stringResource(R.string.name)) },
                            modifier = Modifier.fillMaxWidth().testTag("item-name"), enabled = !vm.busy)
                        OutlinedTextField(emoji, { emoji = it }, label = { Text(stringResource(R.string.icon)) },
                            modifier = Modifier.fillMaxWidth().testTag("item-icon"), enabled = !vm.busy, singleLine = true)
                    }
                    Text(stringResource(if (item.template) R.string.fixed_hint else R.string.custom_hint),
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(amount, { if (it.length <= 3 && it.all { c -> c in '0'..'9' }) amount = it },
                        label = { Text(stringResource(R.string.points)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth().testTag("item-points"), enabled = !vm.busy, singleLine = true)
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(R.string.active), Modifier.weight(1f))
                        Switch(active, { active = it }, enabled = !vm.busy, modifier = Modifier.testTag("item-active"))
                    }
                    Text(stringResource(R.string.points_hint), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    ErrorText(vm.error)
                    if (!item.template && !isNew) TextButton(onClick = { deleting = true }, enabled = !vm.busy,
                        modifier = Modifier.testTag("delete-item"), colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                        Text(stringResource(R.string.delete_item))
                    }
                }
            }
        }
    }
    if (deleting) AlertDialog(onDismissRequest = { deleting = false },
        title = { Text(stringResource(R.string.delete_question)) }, text = { Text(stringResource(R.string.delete_hint)) },
        confirmButton = { TextButton(onClick = { deleting = false; vm.delete(item.id, close) }, modifier = Modifier.testTag("confirm-delete")) { Text(stringResource(R.string.delete_item)) } },
        dismissButton = { TextButton(onClick = { deleting = false }) { Text(stringResource(R.string.cancel)) } })
}
