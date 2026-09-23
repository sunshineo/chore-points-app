package me.gordon.gemsteps

import android.app.Application
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.SystemClock
import androidx.compose.runtime.*
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant

// State survives rotation; only durable ledger changes survive process death.
class GemViewModel(application: Application, private val saved: SavedStateHandle) : AndroidViewModel(application) {
    private val family = FamilyStore(application)
    private val store get() = family.store
    var children by mutableStateOf(listOf(ChildProfile(FamilyStore.ORIGINAL, 1))); private set
    var selectedChildID by mutableStateOf(FamilyStore.ORIGINAL); private set
    val childNumber get() = children.first { it.id == selectedChildID }.number
    var childrenOpen by mutableStateOf(false); private set
    val canChangeChild get() = !busy && celebration == null && !management && !adjustmentOpen
    fun showChildren(value: Boolean) {
        if (busy || (value && !canChangeChild)) return
        childrenOpen = value
        error = null
    }
    private fun applyFamily(updated: Snapshot) {
        snapshot = updated
        children = family.children
        selectedChildID = family.selectedID
    }
    fun addChild() = changeChild { family.add(Instant.now()) }
    fun selectChild(id: String) = changeChild { family.select(id, Instant.now()) }
    fun removeChild(id: String) = changeChild(close = false) { family.remove(id, Instant.now()) }
    private fun changeChild(close: Boolean = true, operation: suspend () -> Snapshot) {
        if (!canChangeChild) return
        busy = true
        viewModelScope.launch {
            try {
                applyFamily(operation())
                selectRewards(false)
                selectUndo(false)
                if (close) childrenOpen = false
                error = null
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { error = R.string.child_error }
            finally { busy = false }
        }
    }
    var snapshot by mutableStateOf<Snapshot?>(null); private set
    var busy by mutableStateOf(false); private set
    var loadFailed by mutableStateOf(false); private set
    var error by mutableStateOf<Int?>(null); private set
    var celebration by mutableStateOf<Entry?>(null); private set
    var rewards by mutableStateOf(saved["rewards"] ?: false)
        private set
    var undo by mutableStateOf(saved["undo"] ?: false)
        private set
    var management by mutableStateOf(saved["management"] ?: false)
        private set
    var adjustmentOpen by mutableStateOf(saved["adjustment"] ?: false)
        private set
    private var player: MediaPlayer? = null
    private var celebrationUntil = 0L

    init { reload() }
    fun selectRewards(value: Boolean) { rewards = value; saved["rewards"] = value }
    fun selectUndo(value: Boolean) { undo = value; saved["undo"] = value }
    fun showManagement(value: Boolean) { management = value; saved["management"] = value; error = null }
    fun setAdjustment(value: Boolean) {
        if (busy || celebration != null) return
        adjustmentOpen = value; saved["adjustment"] = value; error = null
    }
    fun clearError() { error = null }

    fun reload() {
        if (busy) return
        busy = true
        viewModelScope.launch {
            try {
                applyFamily(family.load(Instant.now()))
                loadFailed = false
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { loadFailed = true }
            finally { busy = false }
        }
    }

    fun refreshDay() {
        if (busy || snapshot == null || snapshot?.points?.day == dateKey(Instant.now())) return
        busy = true
        viewModelScope.launch {
            try { snapshot = store.load(Instant.now()) }
            catch (e: CancellationException) { throw e }
            catch (_: Exception) { error = R.string.day_error }
            finally { busy = false }
        }
    }

    fun perform(id: String? = null, adjustment: Int? = null) {
        if (busy || celebration != null || snapshot == null) return
        busy = true
        val wasUndo = undo && adjustment == null
        viewModelScope.launch {
            try {
                val (updated, entry) = store.perform(id, wasUndo, adjustment, Instant.now())
                snapshot = updated
                error = null
                if (adjustment != null) { adjustmentOpen = false; saved["adjustment"] = false }
                if (!wasUndo) {
                    celebration = entry
                    celebrationUntil = SystemClock.elapsedRealtime() + 2000
                    playSound(entry.points > 0)
                }
            } catch (e: CancellationException) { throw e }
            catch (_: InsufficientPoints) { error = R.string.insufficient }
            catch (_: Exception) { error = R.string.save_error }
            finally { busy = false }
            if (celebration != null) {
                delay((celebrationUntil - SystemClock.elapsedRealtime()).coerceAtLeast(0))
                celebration = null
            }
        }
    }

    fun save(item: Item, complete: () -> Unit = {}) = edit({ store.save(item) }, complete)
    fun delete(id: String, complete: () -> Unit) = edit({ store.delete(id) }, complete)
    fun reorder(ids: List<String>, reward: Boolean) = edit({ store.reorder(ids, reward) })

    private fun edit(operation: suspend () -> Unit, complete: () -> Unit = {}) {
        if (busy || celebration != null) return
        busy = true
        viewModelScope.launch {
            try {
                operation()
                snapshot = store.load(Instant.now())
                error = null
                complete()
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { error = R.string.catalog_error }
            finally { busy = false }
        }
    }

    private fun playSound(positive: Boolean) {
        player?.release()
        player = null
        try {
            val resource = if (positive) R.raw.points_earned else R.raw.reward_complete
            val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
            player = MediaPlayer.create(getApplication(), resource, attributes, 0)?.apply {
                setOnCompletionListener { it.release(); if (player === it) player = null }
                setOnErrorListener { mp, _, _ -> mp.release(); if (player === mp) player = null; true }
                start()
            }
        } catch (_: Exception) { player?.release(); player = null }
    }

    override fun onCleared() { player?.release(); family.close() }
}
