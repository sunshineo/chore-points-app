package me.gordon.gemsteps

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PointsTest {
    private val now = Instant.parse("2026-09-21T19:00:00Z")
    private val task = Catalog.templates.first()
    private val reward = Catalog.templates.first { it.reward }
    private fun state(vararg entries: Entry) = PointsState.replay(entries.toList(), dateKey(now))

    @Test fun catalogMatchesIosDefaults() {
        assertEquals(28, Catalog.templates.count { !it.reward })
        assertEquals(10, Catalog.templates.count { it.reward })
        assertEquals(8, Catalog.templates.count { !it.reward && it.active })
        assertEquals(4, Catalog.templates.count { it.reward && it.active })
        assertEquals(38, Catalog.templates.map { it.id }.distinct().size)
        assertTrue(Catalog.templates.all { !it.englishTitle.isNullOrEmpty() && it.points in 1..999 })
    }

    @Test fun repeatedTasksAndLatestUndoUseOriginalPrice() {
        val a = state().action(task, false, now)
        val b = state(a).action(task.copy(points = 7), false, now)
        assertEquals(9L, state(a, b).balance)
        assertEquals(2, state(a, b).count(task.id))
        val undo = state(a, b).action(task.copy(points = 99), true, now)
        assertEquals(-7L, undo.points)
        assertEquals(b.id, undo.reversedId)
        assertEquals(2L, state(a, b, undo).balance)
        assertEquals(2, state(a, b, undo).undoItems.single().points)
    }

    @Test fun rewardUndoRefundsOriginalCost() {
        val credit = state().adjustment(50, now)
        val purchase = state(credit).action(reward, false, now)
        val undo = state(credit, purchase).action(reward.copy(points = 99, active = false), true, now)
        assertEquals(5L, undo.points)
        assertEquals(50L, state(credit, purchase, undo).balance)
        assertEquals(0, state(credit, purchase, undo).count(reward.id))
    }

    @Test(expected = InsufficientPoints::class) fun insufficientRewardIsRejected() {
        state().action(reward, false, now)
    }

    @Test(expected = InsufficientPoints::class) fun undoCannotMakeBalanceNegative() {
        val earn = state().action(task.copy(points = 5), false, now)
        val spend = state(earn).action(reward, false, now)
        state(earn, spend).action(task, true, now)
    }

    @Test fun deductionsClampAndRecordActualAmount() {
        val credit = state().adjustment(12, now)
        val debit = state(credit).adjustment(-999, now)
        assertEquals(-12L, debit.points)
        assertEquals(0L, state(credit, debit).balance)
        assertEquals(0L, state().adjustment(-1, now).points)
    }

    @Test fun invalidAmountsAndInactiveItemsAreRejected() {
        listOf(0, 1000, -1000).forEach { value ->
            assertThrows(InvalidPoints::class.java) { state().adjustment(value, now) }
        }
        assertThrows(InvalidPoints::class.java) { state().action(task.copy(active = false), false, now) }
        assertThrows(InvalidPoints::class.java) { state().action(task, true, now) }
    }

    @Test fun midnightRetainsBalanceAndClearsDay() {
        val entry = state().action(task, false, now)
        val next = PointsState.replay(listOf(entry), "2026-09-22")
        assertEquals(2L, next.balance)
        assertEquals(0L, next.dailyNet)
        assertTrue(next.undoItems.isEmpty())
    }

    @Test fun pacificDatesHandleDaylightSavingBoundaries() {
        assertEquals("2026-09-20", dateKey(Instant.parse("2026-09-21T06:59:59Z")))
        assertEquals("2026-09-21", dateKey(Instant.parse("2026-09-21T07:00:00Z")))
        assertEquals("2026-03-08", dateKey(Instant.parse("2026-03-08T10:00:00Z")))
        assertEquals("2026-11-01", dateKey(Instant.parse("2026-11-01T09:00:00Z")))
    }

    @Test fun overflowFailsInsteadOfWrapping() {
        assertThrows(ArithmeticException::class.java) { PointsState(dateKey(now), Long.MAX_VALUE).adjustment(1, now) }
    }

    @Test fun originalSnapshotRemainsAfterCatalogChanges() {
        val custom = task.copy(id = "custom-example", title = "Original", englishTitle = null, template = false)
        val entry = state().action(custom, false, now)
        assertEquals("Original", state(entry).undoItems.single().title)
        assertEquals("Original", custom.name(false))
    }
}
