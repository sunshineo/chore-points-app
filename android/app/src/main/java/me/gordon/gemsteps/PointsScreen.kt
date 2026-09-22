package me.gordon.gemsteps

import androidx.activity.compose.BackHandler
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
fun GemStepsApp(vm: GemViewModel = viewModel()) {
    val colors = if (isSystemInDarkTheme()) darkColorScheme(primary = Accent,
        background = Color(0xFF17171D), surface = Color(0xFF222229))
    else lightColorScheme(primary = Accent, background = Color(0xFFF4F3F8), surface = Color.White)
    MaterialTheme(colorScheme = colors) {
        val lifecycle = LocalLifecycleOwner.current.lifecycle
        LaunchedEffect(lifecycle) {
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) { vm.refreshDay(); delay(10_000) }
            }
        }
        Surface(Modifier.fillMaxSize()) {
            when {
                vm.loadFailed -> Column(Modifier.fillMaxSize().padding(32.dp),
                    verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(stringResource(R.string.load_error), textAlign = TextAlign.Center)
                    Text(stringResource(R.string.load_error_detail), textAlign = TextAlign.Center)
                    Button(onClick = vm::reload) { Text(stringResource(R.string.retry)) }
                }
                vm.snapshot == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                vm.management -> ManagementScreen(vm)
                else -> PointsScreen(vm)
            }
        }
        if (vm.adjustmentOpen) AdjustmentDialog(vm)
        if (vm.celebration != null && !vm.adjustmentOpen) {
            Dialog(onDismissRequest = {}, properties = DialogProperties(
                dismissOnBackPress = false, dismissOnClickOutside = false, usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false)) {
                Celebration(vm.celebration!!, Modifier.fillMaxSize())
            }
        }
    }
}

@Composable
private fun PointsScreen(vm: GemViewModel) {
    val snapshot = vm.snapshot ?: return
    val state = snapshot.points
    val items = (if (vm.undo) state.undoItems else snapshot.items.filter { it.active })
        .filter { it.reward == vm.rewards }
    BackHandler(vm.undo) { vm.selectUndo(false) }
    BoxWithConstraints(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).safeDrawingPadding()) {
        val columns = if (maxWidth < 600.dp) 2 else maxOf(2, ((maxWidth.value - 20) / 190).toInt())
        val side = (maxWidth - 32.dp - 12.dp * (columns - 1)) / columns
        LazyVerticalGrid(columns = GridCells.Fixed(columns), contentPadding = PaddingValues(bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(horizontal = 16.dp).testTag("points-grid")) {
            item(span = { GridItemSpan(maxLineSpan) }) { Header(vm, state, maxWidth >= 800.dp) }
            item(span = { GridItemSpan(maxLineSpan) }) {
                SectionPicker(vm.rewards, Modifier.fillMaxWidth().padding(vertical = 4.dp), vm::selectRewards)
            }
            if (vm.error != null) item(span = { GridItemSpan(maxLineSpan) }) { ErrorText(vm.error) }
            if (items.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                Column(Modifier.fillMaxWidth().padding(vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Default.Checklist, null, Modifier.size(48.dp), tint = Accent)
                    Text(stringResource(if (vm.undo) R.string.nothing_undo else R.string.no_active), style = MaterialTheme.typography.titleLarge)
                    Text(stringResource(if (vm.undo) R.string.nothing_undo_hint else R.string.no_active_hint), textAlign = TextAlign.Center)
                    if (!vm.undo) Button(onClick = { vm.showManagement(true) }) { Text(stringResource(R.string.manage_action)) }
                }
            }
            itemsIndexed(items, key = { _, item -> item.id }) { index, item ->
                val enabled = !vm.busy && vm.celebration == null &&
                    (vm.undo || !item.reward || state.balance >= item.points)
                PointCard(item, state.count(item.id), CardColors[index % CardColors.size], side.value,
                    enabled) { vm.perform(id = item.id) }
            }
        }
    }
}

@Composable
private fun Header(vm: GemViewModel, state: PointsState, wide: Boolean) {
    val largeText = LocalConfiguration.current.fontScale >= 1.5f
    Column(Modifier.fillMaxWidth().background(
        Brush.linearGradient(listOf(Color(0xFF913CBA), Color(0xFF4B49AD))), RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp))
        .padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CompositionLocalProvider(LocalContentColor provides Color.White) {
            if (wide && !largeText) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Balance(state.balance)
                Spacer(Modifier.weight(1f))
                DayLabel(state)
                HeaderActions(vm, Modifier.width(360.dp))
                LanguageMenu()
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Balance(state.balance, Modifier.weight(1f))
                    if (!largeText) DayLabel(state)
                    LanguageMenu()
                }
                if (largeText) DayLabel(state)
                HeaderActions(vm, Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun Balance(balance: Long, modifier: Modifier = Modifier) {
    val label = stringResource(R.string.points_balance, balance)
    Row(modifier.testTag("points-balance").clearAndSetSemantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(Icons.Default.Stars, null, tint = Color(0xFFFFD966), modifier = Modifier.size(32.dp))
        Text(balance.toString(), fontSize = 34.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun DayLabel(state: PointsState) {
    val locale = LocalConfiguration.current.locales[0]
    val date = LocalDate.parse(state.day)
    val pattern = if (locale.language == "zh") "M月d日 E" else "MMM d E"
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(date.format(DateTimeFormatter.ofPattern(pattern, locale)), style = MaterialTheme.typography.labelLarge)
        val label = stringResource(R.string.today_points, state.dailyNet)
        Text((if (state.dailyNet > 0) "+" else "") + state.dailyNet,
            Modifier.semantics { contentDescription = label }, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun HeaderActions(vm: GemViewModel, modifier: Modifier) {
    val largeText = LocalConfiguration.current.fontScale >= 1.5f
    val adjustmentLabel = stringResource(R.string.adjustment_label)
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        val buttonColors = ButtonDefaults.filledTonalButtonColors(containerColor = Color.White.copy(alpha = .17f), contentColor = Color.White)
        FilledTonalButton(onClick = { vm.selectUndo(!vm.undo) }, modifier = Modifier.weight(1f).testTag("undo-mode"),
            contentPadding = PaddingValues(horizontal = 6.dp), shape = RoundedCornerShape(12.dp), colors = buttonColors) {
            if (!largeText) {
                Icon(Icons.AutoMirrored.Filled.Undo, null, Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
            }
            Text(stringResource(if (vm.undo) R.string.exit_undo else R.string.undo_mode), textAlign = TextAlign.Center)
        }
        FilledTonalButton(onClick = { vm.setAdjustment(true) }, modifier = Modifier.weight(1f).testTag("adjustment-open").semantics { contentDescription = adjustmentLabel },
            contentPadding = PaddingValues(horizontal = 6.dp), shape = RoundedCornerShape(12.dp), colors = buttonColors) {
            if (!largeText) {
                Text("±", fontSize = 18.sp)
                Spacer(Modifier.width(4.dp))
            }
            Text(stringResource(R.string.adjustment), textAlign = TextAlign.Center)
        }
        ActionIcon(Icons.Default.Tune, stringResource(R.string.manage), Modifier.testTag("manage-open")) { vm.showManagement(true) }
    }
}

@Composable
private fun LanguageMenu() {
    var expanded by remember { mutableStateOf(false) }
    Box {
        ActionIcon(Icons.Default.Language, stringResource(R.string.language), Modifier.testTag("language-menu")) { expanded = true }
        DropdownMenu(expanded, { expanded = false }) {
            listOf("简体中文" to "zh-Hans", "English" to "en").forEach { (label, tag) ->
                DropdownMenuItem(text = { Text(label) }, onClick = {
                    expanded = false
                    AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
                })
            }
        }
    }
}

@Composable
private fun PointCard(item: Item, count: Int, color: Color, side: Float, enabled: Boolean, action: () -> Unit) {
    val name = item.name(isChinese())
    val detail = stringResource(if (item.reward) R.string.redeemed_today else R.string.completed_today, count, item.points)
    val description = "$name, $detail"
    val largeText = LocalConfiguration.current.fontScale >= 1.5f
    Card(onClick = action, enabled = enabled, shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = color, contentColor = Color.White,
            disabledContainerColor = color.copy(alpha = .32f), disabledContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = .55f)),
        modifier = Modifier.fillMaxWidth().heightIn(min = (side * if (largeText) 1.4f else 1f).dp)
            .testTag(item.id).semantics { contentDescription = description }) {
        Box(Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ItemIcon(item, (side * .36f).dp)
                Text(name, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center,
                    maxLines = if (largeText) 4 else 2)
                Text("${if (item.reward) "−" else "+"}${item.points}",
                    Modifier.background(Color.White.copy(alpha = .18f), CircleShape).padding(horizontal = 12.dp, vertical = 3.dp),
                    style = MaterialTheme.typography.bodyMedium)
                if (largeText) Text(stringResource(R.string.count, count), style = MaterialTheme.typography.bodySmall)
            }
            if (!largeText) Box(Modifier.align(Alignment.TopEnd).padding(5.dp)
                .background(if (count > 0) Color(0xFF056645) else Color.Black.copy(alpha = .22f), CircleShape)
                .sizeIn(minWidth = 28.dp, minHeight = 28.dp), contentAlignment = Alignment.Center) {
                Text(count.toString(), color = Color.White, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(5.dp))
            }
        }
    }
}

@Composable
fun Celebration(entry: Entry, modifier: Modifier = Modifier) {
    var visible by remember(entry.id) { mutableStateOf(false) }
    LaunchedEffect(entry.id) { visible = true }
    val scale by animateFloatAsState(if (visible) 1f else .85f, tween(250), label = "celebration")
    val title = stringResource(when (entry.kind) {
        "task" -> R.string.task_complete
        "reward" -> R.string.reward_complete
        else -> R.string.adjusted
    })
    val description = stringResource(if (entry.points >= 0) R.string.celebration_add else R.string.celebration_subtract, title, kotlin.math.abs(entry.points))
    Surface(modifier.testTag("celebration"), color = MaterialTheme.colorScheme.background) {
        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
            val imageSize = minOf(maxWidth * .55f, maxHeight * .36f, 300.dp)
            Column(Modifier.fillMaxSize().padding(24.dp).scale(scale)
                .clearAndSetSemantics { contentDescription = description; liveRegion = LiveRegionMode.Polite },
                verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                ItemIcon(entry.item, imageSize)
                Spacer(Modifier.height(24.dp))
                Text("${if (entry.points > 0) "+" else "−"}${kotlin.math.abs(entry.points)}",
                    fontSize = 72.sp, fontWeight = FontWeight.Bold,
                    color = if (entry.points > 0) Positive else Negative, maxLines = 1)
            }
        }
    }
}
