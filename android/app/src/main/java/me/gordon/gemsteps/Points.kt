package me.gordon.gemsteps

import java.time.Instant
import java.time.ZoneId
import java.util.UUID

val businessZone: ZoneId = ZoneId.of("America/Los_Angeles")
fun dateKey(now: Instant): String = now.atZone(businessZone).toLocalDate().toString()

data class Item(
    val id: String,
    val title: String,
    val englishTitle: String? = null,
    val emoji: String,
    val points: Int,
    val reward: Boolean,
    val active: Boolean = true,
    val template: Boolean = false,
    val image: String? = null,
    val position: Int = 0,
) {
    fun name(chinese: Boolean) = if (chinese) title else englishTitle ?: title
}

data class Entry(
    val id: String = UUID.randomUUID().toString(),
    val timestamp: Long,
    val day: String,
    val kind: String,
    val item: Item?,
    val points: Long,
    val reversedId: String? = null,
)

class InsufficientPoints : IllegalStateException()
class InvalidPoints : IllegalArgumentException()

data class PointsState(
    val day: String,
    val balance: Long = 0,
    val dailyNet: Long = 0,
    val occurrences: Map<String, List<Entry>> = emptyMap(),
) {
    fun count(id: String) = occurrences[id]?.size ?: 0
    val undoItems: List<Item> get() = occurrences.values.mapNotNull { it.lastOrNull()?.item }
        .sortedBy { it.id }

    fun action(item: Item, undo: Boolean, now: Instant): Entry {
        if (undo) {
            val original = occurrences[item.id]?.lastOrNull() ?: throw InvalidPoints()
            validate(-original.points)
            return original.copy(id = UUID.randomUUID().toString(), timestamp = now.toEpochMilli(),
                day = dateKey(now), points = -original.points, reversedId = original.id)
        }
        if (!item.active || item.points !in 1..999) throw InvalidPoints()
        val amount = item.points.toLong() * if (item.reward) -1 else 1
        validate(amount)
        return Entry(timestamp = now.toEpochMilli(), day = dateKey(now),
            kind = if (item.reward) "reward" else "task", item = item, points = amount)
    }

    fun adjustment(amount: Int, now: Instant): Entry {
        if (amount == 0 || amount !in -999..999) throw InvalidPoints()
        val actual = if (amount < 0) -minOf(balance, -amount.toLong()) else amount.toLong()
        validate(actual)
        return Entry(timestamp = now.toEpochMilli(), day = dateKey(now), kind = "adjustment", item = null, points = actual)
    }

    private fun validate(amount: Long) {
        if (Math.addExact(balance, amount) < 0) throw InsufficientPoints()
    }

    companion object {
        fun replay(entries: List<Entry>, day: String): PointsState {
            var balance = 0L
            var net = 0L
            val outstanding = mutableMapOf<String, MutableList<Entry>>()
            for (entry in entries) {
                balance = Math.addExact(balance, entry.points)
                check(balance >= 0) { "Invalid ledger balance" }
                if (entry.day != day) continue
                net = Math.addExact(net, entry.points)
                val item = entry.item ?: continue
                val list = outstanding.getOrPut(item.id) { mutableListOf() }
                if (entry.reversedId != null) {
                    check(list.removeAll { it.id == entry.reversedId }) { "Invalid reversal" }
                } else {
                    list.add(entry)
                }
            }
            return PointsState(day, balance, net, outstanding)
        }
    }
}
