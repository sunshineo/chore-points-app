package me.gordon.gemsteps

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.time.Instant
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class FamilyStoreTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val name = "family-test-${UUID.randomUUID()}.db"
    private val now = Instant.parse("2026-09-22T19:00:00Z")
    private lateinit var family: FamilyStore
    @Before fun setup() { family = FamilyStore(context, name) }
    @After fun cleanup() {
        family.close()
        context.databaseList().filter { it == name || it.startsWith("$name.child-") }.forEach { context.deleteDatabase(it) }
    }

    @Test fun originalDataDefaultsIsolationRestartAndRemoval() = runBlocking {
        val defaults = family.load(now).items
        val original = GemDatabase.open(context, name)
        assertNull(original.dao().metadata("family"))
        val custom = Item("custom-${UUID.randomUUID()}", "My task", emoji = "⭐", points = 7, reward = false)
        family.store.save(custom)
        family.store.perform(id = custom.id, now = now)
        val second = family.add(now)
        val secondID = family.selectedID
        assertEquals(defaults, second.items)
        assertEquals(0L, second.points.balance)
        assertTrue(second.points.undoItems.isEmpty())
        family.store.perform(adjustment = 30, now = now)
        family.store.perform(id = "reward-sticker", now = now)
        family.store.perform(id = "reward-sticker", undo = true, now = now)
        family.store.save(custom.copy(points = 9))
        assertEquals(defaults, family.add(now).items)
        val thirdID = family.selectedID
        val first = family.select(FamilyStore.ORIGINAL, now)
        assertEquals(7L, first.points.balance)
        assertEquals(7, first.items.first { it.id == custom.id }.points)
        assertEquals(0L, family.store.perform(id = custom.id, undo = true, now = now).first.points.balance)
        family.remove(FamilyStore.ORIGINAL, now)
        assertTrue(original.dao().entries().isEmpty())
        original.close()
        family.select(thirdID, now)
        val remaining = family.remove(thirdID, now)
        assertEquals(secondID, family.selectedID)
        assertEquals(30L, remaining.points.balance)
        assertEquals(listOf(2), family.children.map { it.number })
        try { family.remove(secondID, now); fail("Last child must be retained") } catch (_: IllegalStateException) { }
        family.close(); family = FamilyStore(context, name)
        assertEquals(30L, family.load(now).points.balance)
        assertEquals(secondID, family.selectedID)
        assertEquals(0L, family.add(now).points.balance)
        assertEquals(listOf(1, 2), family.children.map { it.number })
        assertEquals(30L, family.select(secondID, now.plusSeconds(86400)).points.balance)
        assertTrue(family.store.load(now.plusSeconds(86400)).points.undoItems.isEmpty())
    }

    @Test fun limitAndFailedCommitPreserveFamily() = runBlocking {
        family.load(now)
        repeat(8) { family.add(now) }
        val before = family.children
        val selected = family.selectedID
        try { family.add(now); fail("No child 10") } catch (_: IllegalStateException) { }
        assertEquals(before, family.children)
        assertEquals(selected, family.selectedID)
        val root = GemDatabase.open(context, name)
        root.openHelper.writableDatabase.execSQL("CREATE TRIGGER block_family BEFORE UPDATE ON metadata WHEN NEW.`key` = 'family' BEGIN SELECT RAISE(ABORT, 'test'); END")
        try { family.remove(selected, now); fail("Write should fail") } catch (_: android.database.sqlite.SQLiteException) { }
        assertEquals(before, family.children)
        assertEquals(selected, family.selectedID)
        assertTrue(context.getDatabasePath("$name.child-$selected").isFile)
        root.openHelper.writableDatabase.execSQL("DROP TRIGGER block_family")
        root.close()
    }

    @Test fun missingChildDatabaseDoesNotBecomeAnEmptyLedger() = runBlocking {
        family.load(now); family.add(now)
        val selected = family.selectedID
        family.close()
        context.deleteDatabase("$name.child-$selected")
        family = FamilyStore(context, name)
        try { family.load(now); fail("Missing data must be reported") } catch (_: IllegalStateException) { }
        assertFalse(context.getDatabasePath("$name.child-$selected").exists())
    }
}
