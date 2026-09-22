package me.gordon.gemsteps

import android.content.Context
import androidx.room.*
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import java.time.Instant

@Entity(tableName = "items")
data class StoredItem(
    @PrimaryKey val id: String,
    val title: String,
    val englishTitle: String?,
    val emoji: String,
    val points: Int,
    val reward: Boolean,
    val active: Boolean,
    val template: Boolean,
    val image: String?,
    val position: Int,
) {
    fun item() = Item(id, title, englishTitle, emoji, points, reward, active, template, image, position)
    companion object {
        fun from(i: Item) = StoredItem(i.id, i.title, i.englishTitle, i.emoji, i.points,
            i.reward, i.active, i.template, i.image, i.position)
    }
}

@Entity(tableName = "entries", indices = [Index(value = ["id"], unique = true), Index("day")])
data class StoredEntry(
    @PrimaryKey(autoGenerate = true) val sequence: Long = 0,
    val id: String,
    val timestamp: Long,
    val day: String,
    val kind: String,
    val points: Long,
    val reversedId: String?,
    // Snapshot has no foreign key: deleting an item must never delete its history.
    @Embedded(prefix = "snapshot_") val snapshot: StoredItem?,
) {
    fun entry() = Entry(id, timestamp, day, kind, snapshot?.item(), points, reversedId)
    companion object {
        fun from(e: Entry) = StoredEntry(id = e.id, timestamp = e.timestamp, day = e.day,
            kind = e.kind, points = e.points, reversedId = e.reversedId, snapshot = e.item?.let(StoredItem::from))
    }
}

@Entity(tableName = "metadata")
data class Metadata(@PrimaryKey val key: String, val value: String)

@Dao
interface GemDao {
    @Query("SELECT * FROM items ORDER BY position, id") suspend fun items(): List<StoredItem>
    @Query("SELECT * FROM entries ORDER BY sequence") suspend fun entries(): List<StoredEntry>
    @Query("SELECT value FROM metadata WHERE `key` = :key") suspend fun metadata(key: String): String?
    @Upsert suspend fun putItem(item: StoredItem)
    @Upsert suspend fun putMetadata(metadata: Metadata)
    @Insert suspend fun insertEntry(entry: StoredEntry)
    @Query("DELETE FROM items WHERE id = :id") suspend fun deleteItem(id: String)
}

@Database(entities = [StoredItem::class, StoredEntry::class, Metadata::class], version = 1, exportSchema = true)
abstract class GemDatabase : RoomDatabase() {
    abstract fun dao(): GemDao
    companion object {
        fun open(context: Context, name: String = "gemsteps.db") =
            Room.databaseBuilder(context, GemDatabase::class.java, name)
                .openHelperFactory { configuration ->
                    val callback = configuration.callback
                    val preservingCallback = object : SupportSQLiteOpenHelper.Callback(callback.version) {
                        override fun onCreate(db: SupportSQLiteDatabase) = callback.onCreate(db)
                        override fun onUpgrade(db: SupportSQLiteDatabase, old: Int, new: Int) = callback.onUpgrade(db, old, new)
                        override fun onDowngrade(db: SupportSQLiteDatabase, old: Int, new: Int) = callback.onDowngrade(db, old, new)
                        override fun onConfigure(db: SupportSQLiteDatabase) = callback.onConfigure(db)
                        override fun onOpen(db: SupportSQLiteDatabase) = callback.onOpen(db)
                        override fun onCorruption(db: SupportSQLiteDatabase) {
                            // Android's default callback deletes corrupt files. Keep the original for recovery.
                            throw android.database.sqlite.SQLiteDatabaseCorruptException("GemSteps database could not be read")
                        }
                    }
                    FrameworkSQLiteOpenHelperFactory().create(
                        SupportSQLiteOpenHelper.Configuration.builder(configuration.context)
                            .name(configuration.name).callback(preservingCallback).build())
                }.build()
        // Never use destructive migration or replace an unreadable database.
    }
}

data class Snapshot(val items: List<Item>, val points: PointsState)

class LocalStore(private val database: GemDatabase) {
    private val dao = database.dao()

    suspend fun initialize(templates: List<Item> = Catalog.templates) = database.withTransaction {
        val initialized = dao.metadata("catalogInitialized") != null
        val existing = dao.items()
        val known = existing.associateBy { it.id }
        var position = (existing.maxOfOrNull { it.position } ?: -1) + 1
        templates.forEach { template ->
            val old = known[template.id]
            if (old == null) {
                dao.putItem(StoredItem.from(template.copy(active = !initialized && template.active, position = position++)))
            } else {
                // Content follows the shipped catalog; user points, switches and ordering survive upgrades.
                dao.putItem(StoredItem.from(template.copy(points = old.points, active = old.active, position = old.position)))
            }
        }
        dao.putMetadata(Metadata("catalogInitialized", "1"))
    }

    private suspend fun snapshot(now: Instant): Snapshot = Snapshot(
        dao.items().map { it.item() }, PointsState.replay(dao.entries().map { it.entry() }, dateKey(now)))

    suspend fun load(now: Instant): Snapshot = database.withTransaction { snapshot(now) }

    suspend fun perform(id: String? = null, undo: Boolean = false, adjustment: Int? = null,
                        now: Instant): Pair<Snapshot, Entry> = database.withTransaction {
        val before = snapshot(now)
        val change = if (adjustment != null) before.points.adjustment(adjustment, now) else {
            val source = if (undo) before.points.undoItems else before.items
            val item = source.firstOrNull { it.id == id } ?: throw InvalidPoints()
            before.points.action(item, undo, now)
        }
        dao.insertEntry(StoredEntry.from(change))
        snapshot(now) to change
    }

    suspend fun save(item: Item) = database.withTransaction {
        require(item.points in 1..999)
        val existing = dao.items()
        val old = existing.firstOrNull { it.id == item.id }
        val template = Catalog.templates.firstOrNull { it.id == item.id }
        if (template != null) {
            require(old != null && item.template && item.title == template.title &&
                item.englishTitle == template.englishTitle && item.emoji == template.emoji &&
                item.image == template.image && item.reward == template.reward)
            dao.putItem(old.copy(points = item.points, active = item.active))
        } else {
            val clean = item.copy(title = item.title.trim(), emoji = item.emoji.trim())
            require(!clean.template && clean.englishTitle == null && clean.image == null)
            require(validCustomText(clean.title, clean.emoji))
            require(clean.id.startsWith("custom-"))
            java.util.UUID.fromString(clean.id.removePrefix("custom-"))
            require(old == null || old.reward == clean.reward)
            if (old == null) {
                existing.forEachIndexed { index, row -> dao.putItem(row.copy(position = index + 1)) }
            }
            dao.putItem(StoredItem.from(clean.copy(position = old?.position ?: 0)))
        }
    }

    suspend fun delete(id: String) = database.withTransaction {
        val old = dao.items().firstOrNull { it.id == id } ?: throw InvalidPoints()
        require(!old.template)
        dao.deleteItem(id)
    }

    suspend fun reorder(ids: List<String>, reward: Boolean) = database.withTransaction {
        val all = dao.items()
        val expected = all.filter { it.reward == reward }
        require(ids.size == expected.size && ids.toSet() == expected.map { it.id }.toSet())
        val ordered = ids + all.filter { it.reward != reward }.map { it.id }
        val byId = all.associateBy { it.id }
        ordered.forEachIndexed { index, id -> dao.putItem(byId.getValue(id).copy(position = index)) }
    }
}

fun graphemeCount(text: String): Int {
    val iterator = android.icu.text.BreakIterator.getCharacterInstance()
    iterator.setText(text)
    var count = 0
    iterator.first()
    while (iterator.next() != android.icu.text.BreakIterator.DONE) count++
    return count
}
fun validCustomText(title: String, emoji: String) =
    title.trim().isNotEmpty() && graphemeCount(title.trim()) <= 100 && graphemeCount(emoji.trim()) == 1
