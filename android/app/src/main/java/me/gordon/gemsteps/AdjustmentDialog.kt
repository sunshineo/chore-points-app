package me.gordon.gemsteps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

@Composable
fun AdjustmentDialog(vm: GemViewModel) {
    var digits by rememberSaveable { mutableStateOf("") }
    var subtract by rememberSaveable { mutableStateOf(false) }
    val blocked = vm.busy || vm.celebration != null
    Dialog(onDismissRequest = { vm.setAdjustment(false) },
        properties = DialogProperties(usePlatformDefaultWidth = false,
            dismissOnBackPress = !blocked, dismissOnClickOutside = !blocked)) {
        Surface(Modifier.padding(24.dp).widthIn(max = 438.dp).fillMaxWidth()
            .testTag("adjustment-panel"), shape = RoundedCornerShape(28.dp)) {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp)
                .padding(top = 8.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End,
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Text(stringResource(R.string.child_number, vm.childNumber), Modifier.weight(1f))
                    CloseButton(Modifier.testTag("adjustment-close"), !blocked) { vm.setAdjustment(false) }
                }
                val amount = digits.toIntOrNull() ?: 0
                val color = if (subtract) Negative else Positive
                val amountLabel = stringResource(if (subtract) R.string.amount_subtract else R.string.amount_add, amount)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    KeyButton("+", Modifier.weight(1f).testTag("adjustment-plus"), !blocked,
                        if (!subtract) Positive else Positive.copy(alpha = .35f), stringResource(R.string.add_points)) { subtract = false }
                    Text("${if (subtract) "−" else "+"}$amount", Modifier.weight(1f).testTag("adjustment-amount").semantics { contentDescription = amountLabel },
                        color = color, fontSize = if (digits.length < 3) 36.sp else 26.sp,
                        fontWeight = FontWeight.Bold, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    KeyButton("−", Modifier.weight(1f).testTag("adjustment-minus"), !blocked,
                        if (subtract) Negative else Negative.copy(alpha = .35f), stringResource(R.string.subtract_points)) { subtract = true }
                }
                for (row in 0..2) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        for (column in 1..3) {
                            val digit = row * 3 + column
                            KeyButton(digit.toString(), Modifier.weight(1f).testTag("adjustment-value-$digit"), !blocked) {
                                if (digits.length < 3) digits = if (digits == "0") "$digit" else digits + digit
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KeyButton("0", Modifier.weight(1f).testTag("adjustment-value-0"), !blocked) {
                        if (digits.length < 3 && digits != "0") digits += "0"
                    }
                    FilledTonalButton(onClick = { digits = digits.dropLast(1) }, enabled = !blocked,
                        modifier = Modifier.weight(1f).heightIn(min = 64.dp).testTag("adjustment-delete"), shape = RoundedCornerShape(16.dp)) {
                        Icon(Icons.AutoMirrored.Filled.Backspace, stringResource(R.string.delete_digit))
                    }
                    Button(onClick = { vm.perform(adjustment = amount * if (subtract) -1 else 1) },
                        enabled = amount > 0 && !blocked,
                        modifier = Modifier.weight(1f).heightIn(min = 64.dp).testTag("adjustment-confirm"),
                        shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = color)) {
                        Icon(Icons.Default.Check, stringResource(if (subtract) R.string.confirm_subtract else R.string.confirm_add, amount))
                    }
                }
                ErrorText(vm.error)
            }
        }
    }
}

@Composable
private fun KeyButton(label: String, modifier: Modifier, enabled: Boolean,
                      color: Color = MaterialTheme.colorScheme.surfaceContainerHigh,
                      description: String = label, action: () -> Unit) {
    FilledTonalButton(onClick = action, enabled = enabled,
        modifier = modifier.heightIn(min = 64.dp), shape = RoundedCornerShape(16.dp),
        contentPadding = PaddingValues(4.dp),
        colors = ButtonDefaults.filledTonalButtonColors(containerColor = color,
            contentColor = if (label == "+" || label == "−") Color.White else MaterialTheme.colorScheme.onSurface)) {
        Text(label, fontSize = 30.sp, modifier = Modifier.semantics { contentDescription = description })
    }
}
