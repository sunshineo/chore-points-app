package me.gordon.gemsteps

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import kotlinx.coroutines.runBlocking
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.time.Instant
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class StoreTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private lateinit var database: GemDatabase
    private lateinit var store: LocalStore
    private val name = "test-${UUID.randomUUID()}.db"
    private val now = Instant.parse("2026-09-21T19:00:00Z")
    @Before fun setup() = runBlocking { database = GemDatabase.open(context, name); store = LocalStore(database); store.initialize() }
    @After fun teardown() { database.close(); context.deleteDatabase(name) }

    @Test fun deletedCustomRetainsSnapshotBalanceAndUndoAfterReopen() = runBlocking {
        val custom = Item("custom-${UUID.randomUUID()}", "测试", emoji = "⭐", points = 7, reward = false)
        store.save(custom)
        store.perform(id = custom.id, now = now)
        store.save(custom.copy(points = 99, active = false))
        store.delete(custom.id)
        database.close()
        database = GemDatabase.open(context, name); store = LocalStore(database)
        val reopened = store.load(now)
        assertEquals(7L, reopened.points.balance)
        assertFalse(reopened.items.any { it.id == custom.id })
        assertEquals(7, reopened.points.undoItems.single().points)
        assertEquals("测试", reopened.points.undoItems.single().title)
        val (undone, _) = store.perform(id = custom.id, undo = true, now = now)
        assertEquals(0L, undone.points.balance)
    }

    @Test fun defaultsAllDisabledAndNewTemplatesSurviveInitialization() = runBlocking {
        val initial = store.load(now)
        assertEquals(12, initial.items.count { it.active })
        initial.items.forEach { store.save(it.copy(active = false, points = 8)) }
        val newTemplate = Catalog.templates.first().copy(id = "future-template")
        store.initialize(Catalog.templates + newTemplate)
        val updated = store.load(now)
        assertTrue(updated.items.none { it.active })
        assertTrue(updated.items.filter { it.id != newTemplate.id }.all { it.points == 8 })
        assertEquals(newTemplate.id, updated.items.last().id)
    }

    @Test fun mixedOrderingAndInvalidChangesAreAtomic() = runBlocking {
        val custom = Item("custom-${UUID.randomUUID()}", "Custom", emoji = "👨‍👩‍👧‍👦", points = 3, reward = false)
        store.save(custom)
        val ids = store.load(now).items.filter { !it.reward }.map { it.id }.reversed()
        store.reorder(ids, false)
        store.initialize()
        assertEquals(ids, store.load(now).items.filter { !it.reward }.map { it.id })
        try { store.reorder(ids.drop(1), false); fail("Expected validation") } catch (_: IllegalArgumentException) {}
        assertEquals(ids, store.load(now).items.filter { !it.reward }.map { it.id })
        val template = Catalog.templates.first()
        try { store.save(template.copy(title = "Changed")); fail("Protected template") } catch (_: IllegalArgumentException) {}
        assertEquals(template.title, store.load(now).items.first { it.id == template.id }.title)
    }

    @Test fun failedTransactionDoesNotPublishLedgerEntry() = runBlocking {
        // Real SQLite trigger aborts the write, exercising Room transaction rollback.
        database.openHelper.writableDatabase.execSQL("CREATE TRIGGER reject_entry BEFORE INSERT ON entries BEGIN SELECT RAISE(ABORT, 'test failure'); END")
        try { store.perform(adjustment = 8, now = now); fail("Expected write failure") } catch (_: android.database.sqlite.SQLiteException) {}
        assertEquals(0L, store.load(now).points.balance)
        assertTrue(database.dao().entries().isEmpty())
        database.openHelper.writableDatabase.execSQL("DROP TRIGGER reject_entry")
        assertEquals(8L, store.perform(adjustment = 8, now = now).first.points.balance)
    }

    @Test fun midnightAndInsufficientBalanceDoNotLeakState() = runBlocking {
        val task = Catalog.templates.first()
        store.perform(id = task.id, now = now)
        try { store.perform(id = Catalog.templates.first { it.reward }.id, now = now); fail("Expected insufficient") } catch (_: InsufficientPoints) {}
        val next = store.load(now.plusSeconds(86400))
        assertEquals(2L, next.points.balance)
        assertTrue(next.points.undoItems.isEmpty())
        assertEquals(1, database.dao().entries().size)
    }

    @Test fun graphemeValidationSupportsEmojiAndRejectsMultipleIcons() {
        assertTrue(validCustomText("任务", "👨‍👩‍👧‍👦"))
        assertTrue(validCustomText("任务", "🛏️"))
        assertFalse(validCustomText("任务", "⭐⭐"))
        assertFalse(validCustomText(" ", "⭐"))
        assertFalse(validCustomText("a".repeat(101), "⭐"))
    }

    @Test fun unreadableDatabaseIsNotReplaced() = runBlocking {
        val corruptName = "corrupt-${UUID.randomUUID()}.db"
        val file = context.getDatabasePath(corruptName)
        val bytes = "not a database".repeat(512).toByteArray()
        file.writeBytes(bytes)
        val corrupt = GemDatabase.open(context, corruptName)
        try {
            try { LocalStore(corrupt).load(now); fail("Expected corrupt database") } catch (_: Exception) {}
            assertArrayEquals(bytes, file.readBytes())
        } finally { corrupt.close(); context.deleteDatabase(corruptName) }
    }
}
