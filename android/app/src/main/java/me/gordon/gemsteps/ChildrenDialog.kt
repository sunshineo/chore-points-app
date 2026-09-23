package me.gordon.gemsteps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChildrenDialog(vm: GemViewModel) {
    var removing by remember { mutableStateOf<ChildProfile?>(null) }
    ModalBottomSheet(onDismissRequest = { vm.showChildren(false) },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).testTag("children-panel")) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.switch_child), Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                CloseButton(Modifier.testTag("children-close"), !vm.busy) { vm.showChildren(false) }
            }
            ErrorText(vm.error)
            LazyColumn(Modifier.weight(1f, fill = false)) {
                items(vm.children, key = { it.id }) { child ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = { vm.selectChild(child.id) }, enabled = vm.canChangeChild,
                            modifier = Modifier.weight(1f).testTag("select-child-${child.number}")) {
                            Text(stringResource(R.string.child_number, child.number), Modifier.weight(1f))
                            if (child.id == vm.selectedChildID) Icon(Icons.Default.Check,
                                stringResource(R.string.current_child))
                        }
                        IconButton(onClick = { removing = child }, enabled = vm.children.size > 1 && vm.canChangeChild,
                            modifier = Modifier.testTag("remove-child-${child.number}")) {
                            Icon(Icons.Default.Delete, stringResource(R.string.remove_child_number, child.number),
                                tint = if (vm.children.size > 1) MaterialTheme.colorScheme.error else LocalContentColor.current.copy(alpha = .38f))
                        }
                    }
                }
            }
            TextButton(onClick = vm::addChild, enabled = vm.children.size < 9 && vm.canChangeChild,
                modifier = Modifier.fillMaxWidth().testTag("add-child")) {
                Icon(Icons.Default.Add, null)
                Text(stringResource(R.string.add_child))
            }
            if (vm.children.size == 9) Text(stringResource(R.string.child_limit), Modifier.padding(bottom = 16.dp))
            Spacer(Modifier.height(16.dp))
        }
    }
    removing?.let { child ->
        AlertDialog(onDismissRequest = { removing = null },
            title = { Text(stringResource(R.string.remove_child_number, child.number)) },
            text = { Text(stringResource(R.string.remove_child_detail)) },
            confirmButton = {
                TextButton(onClick = { removing = null; vm.removeChild(child.id) },
                    modifier = Modifier.testTag("confirm-remove-child")) {
                    Text(stringResource(R.string.remove_child), color = MaterialTheme.colorScheme.error)
                }
            }, dismissButton = { TextButton(onClick = { removing = null }, modifier = Modifier.testTag("cancel-remove-child")) {
                Text(stringResource(R.string.cancel))
            } })
    }
}
