package me.gordon.gemsteps

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val Accent = Color(0xFF5856B3)
val Positive = Color(0xFF14874D)
val Negative = Color(0xFFCC2E38)
val CardColors = listOf(0xFFC23B7A, 0xFF944AC2, 0xFF645CC7, 0xFF2E6EC2,
    0xFF0A7596, 0xFF0D7A6E, 0xFF387A40, 0xFFAB5E17).map { Color(it) }

@Composable fun isChinese() = LocalConfiguration.current.locales[0].language == "zh"

@Composable
fun ItemIcon(item: Item?, size: Dp, modifier: Modifier = Modifier) {
    val resource = when (item?.image) {
        "face_wash" -> R.drawable.face_wash
        "child_seat_harness" -> R.drawable.child_seat_harness
        "handwash_faucet" -> R.drawable.handwash_faucet
        "floss_pick" -> R.drawable.floss_pick
        "reward_tv_transparent" -> R.drawable.reward_tv_transparent
        else -> null
    }
    Box(modifier.size(size).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
        if (resource != null) Image(painterResource(resource), null, Modifier.fillMaxSize())
        else Text(item?.emoji ?: "⭐", fontSize = (size.value * .8f).sp, maxLines = 1)
    }
}

@Composable
fun ActionIcon(icon: ImageVector, description: String, modifier: Modifier = Modifier,
               enabled: Boolean = true, action: () -> Unit) {
    IconButton(onClick = action, modifier = modifier, enabled = enabled) {
        Icon(icon, description)
    }
}

@Composable
fun CloseButton(modifier: Modifier = Modifier, enabled: Boolean = true, close: () -> Unit) =
    ActionIcon(Icons.Default.Close, stringResource(R.string.close), modifier, enabled, close)

@Composable
fun ErrorText(error: Int?) {
    if (error != null) Text(stringResource(error), color = MaterialTheme.colorScheme.error,
        modifier = Modifier.fillMaxWidth().padding(12.dp))
}

@Composable
fun SectionPicker(rewards: Boolean, modifier: Modifier = Modifier, onSelect: (Boolean) -> Unit) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        listOf(false, true).forEach { reward ->
            val selected = reward == rewards
            FilledTonalButton(onClick = { onSelect(reward) },
                modifier = Modifier.weight(1f).heightIn(min = 48.dp).semantics { this.selected = selected },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = if (selected) Accent else Accent.copy(alpha = .12f),
                    contentColor = if (selected) Color.White else MaterialTheme.colorScheme.onSurface)) {
                Text(stringResource(if (reward) R.string.rewards else R.string.tasks),
                    style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
