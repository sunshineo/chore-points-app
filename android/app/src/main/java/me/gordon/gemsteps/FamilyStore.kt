package me.gordon.gemsteps

import android.content.Context
import androidx.room.withTransaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

data class ChildProfile(val id: String, val number: Int)

/** The original database owns the atomic family manifest; each new child has its own ledger. */
class FamilyStore(private val context: Context, private val name: String = "gemsteps.db") : AutoCloseable {
    private val original = GemDatabase.open(context, name)
    private val databases = mutableMapOf<String, GemDatabase>()
    private data class Manifest(val children: List<ChildProfile>, val selected: String, val removed: List<String> = emptyList())
    private var manifest: Manifest? = null
    var store = LocalStore(original); private set
    val children get() = manifest?.children?.sortedBy { it.number } ?: listOf(ChildProfile(ORIGINAL, 1))
    val selectedID get() = manifest?.selected ?: ORIGINAL
    private fun databaseName(id: String) = "$name.child-$id"

    private fun database(id: String): GemDatabase {
        if (id == ORIGINAL) return original
        require(children.any { it.id == id })
        return databases.getOrPut(id) {
            check(context.getDatabasePath(databaseName(id)).isFile) { "Missing child database" }
            GemDatabase.open(context, databaseName(id))
        }
    }

    suspend fun load(now: Instant): Snapshot = withContext(Dispatchers.IO) {
        val raw = original.dao().metadata("family")
        manifest = raw?.let(::decode)
        cleanup()
        val next = LocalStore(database(selectedID))
        next.initialize()
        val snapshot = next.load(now)
        store = next
        snapshot
    }

    private fun decode(raw: String): Manifest {
        val json = JSONObject(raw)
        require(json.getInt("version") == 1)
        val rows = json.getJSONArray("children")
        val children = (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            ChildProfile(row.getString("id"), row.getInt("number"))
        }
        val selected = json.getString("selected")
        val deleted = json.optJSONArray("removed") ?: JSONArray()
        val removed = (0 until deleted.length()).map { deleted.getString(it) }
        require(children.size in 1..9 && children.all { it.number in 1..9 })
        require(children.map { it.number }.toSet().size == children.size)
        require(children.map { it.id }.toSet().size == children.size && children.any { it.id == selected })
        (children.map { it.id } + removed).forEach { if (it != ORIGINAL) UUID.fromString(it) }
        require(removed.none { id -> children.any { it.id == id } })
        return Manifest(children, selected, removed)
    }

    private suspend fun commit(next: Manifest) {
        val json = JSONObject().put("version", 1).put("selected", next.selected)
            .put("children", JSONArray().apply { next.children.forEach {
                put(JSONObject().put("id", it.id).put("number", it.number))
            } }).put("removed", JSONArray(next.removed))
        original.withTransaction { original.dao().putMetadata(Metadata("family", json.toString())) }
        manifest = next
    }

    suspend fun select(id: String, now: Instant): Snapshot = withContext(Dispatchers.IO) {
        require(children.any { it.id == id })
        val next = LocalStore(database(id))
        next.initialize()
        val snapshot = next.load(now)
        manifest?.let { commit(it.copy(selected = id)) }
        store = next
        snapshot
    }

    suspend fun add(now: Instant): Snapshot = withContext(Dispatchers.IO) {
        check(children.size < 9)
        val number = (1..9).first { n -> children.none { it.number == n } }
        val child = ChildProfile(UUID.randomUUID().toString(), number)
        val db = GemDatabase.open(context, databaseName(child.id))
        try {
            val next = LocalStore(db)
            next.initialize()
            val snapshot = next.load(now)
            commit(Manifest(children + child, child.id, manifest?.removed ?: emptyList()))
            databases[child.id] = db
            store = next
            snapshot
        } catch (e: Exception) {
            db.close()
            context.deleteDatabase(databaseName(child.id))
            throw e
        }
    }

    suspend fun remove(id: String, now: Instant): Snapshot = withContext(Dispatchers.IO) {
        check(children.size > 1)
        require(children.any { it.id == id })
        val remaining = children.filter { it.id != id }
        val selected = if (selectedID == id) remaining.first().id else selectedID
        val next = LocalStore(database(selected))
        next.initialize()
        val snapshot = next.load(now)
        commit(Manifest(remaining, selected, (manifest?.removed ?: emptyList()) + id))
        store = next
        cleanup()
        snapshot
    }

    // Removal is committed before deleting files. Retry interrupted cleanup at the next launch.
    private suspend fun cleanup() {
        for (id in manifest?.removed ?: emptyList()) {
            try {
                if (id == ORIGINAL) original.withTransaction {
                    original.dao().clearEntries()
                    original.dao().clearItems()
                } else {
                    databases.remove(id)?.close()
                    context.deleteDatabase(databaseName(id))
                }
            } catch (e: kotlinx.coroutines.CancellationException) { throw e }
            catch (_: Exception) { /* A removed profile stays inaccessible even if cleanup must retry. */ }
        }
    }

    override fun close() { databases.values.forEach { it.close() }; original.close() }
    companion object { const val ORIGINAL = "original" }
}
