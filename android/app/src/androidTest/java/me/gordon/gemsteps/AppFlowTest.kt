package me.gordon.gemsteps

import android.content.Context
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.*
import kotlinx.coroutines.runBlocking
import java.time.Instant

@RunWith(AndroidJUnit4::class)
class AppFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private fun ready() {
        compose.waitUntil(15000) { compose.onAllNodesWithTag("points-balance").fetchSemanticsNodes().isNotEmpty() }
    }
    private fun finishCelebration() {
        compose.waitUntil(10000) { compose.onAllNodesWithTag("celebration").fetchSemanticsNodes().isNotEmpty() }
        compose.waitUntil(10000) { compose.onAllNodesWithTag("celebration").fetchSemanticsNodes().isEmpty() }
    }
    private fun tap(tag: String) = compose.onNodeWithTag(tag).performClick()

    @Test fun manualAdjustmentUsesTaskCelebrationSize() {
        ready()
        tap("seed-task-make-bed")
        compose.waitUntil(10000) { compose.onAllNodesWithTag("celebration").fetchSemanticsNodes().isNotEmpty() }
        val taskBounds = compose.onNodeWithTag("celebration").fetchSemanticsNode().boundsInRoot
        compose.waitUntil(10000) { compose.onAllNodesWithTag("celebration").fetchSemanticsNodes().isEmpty() }
        tap("adjustment-open")
        compose.onNodeWithTag("adjustment-panel").assertIsDisplayed()
        tap("adjustment-value-1")
        tap("adjustment-confirm")
        compose.waitUntil(10000) { compose.onAllNodesWithTag("celebration").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("adjustment-panel").assertDoesNotExist()
        val manualBounds = compose.onNodeWithTag("celebration").fetchSemanticsNode().boundsInRoot
        assertEquals(taskBounds.width, manualBounds.width, 1f)
        assertEquals(taskBounds.height, manualBounds.height, 1f)
        compose.waitUntil(10000) { compose.onAllNodesWithTag("celebration").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithTag("adjustment-panel").assertDoesNotExist()
        tap("adjustment-open")
        compose.onNodeWithTag("adjustment-amount").assertTextEquals("+0")
        tap("adjustment-close")
    }

    @Test fun earnAdjustCreateDeleteUndoAndRecreate() {
        ready()
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database = GemDatabase.open(context)
        val store = LocalStore(database)
        val initial = runBlocking { store.load(Instant.now()).points.balance }
        tap("seed-task-make-bed")
        finishCelebration()
        compose.onNodeWithTag("points-balance").assertContentDescriptionEquals(compose.activity.getString(R.string.points_balance, initial + 2))
        tap("adjustment-open")
        tap("adjustment-value-1"); tap("adjustment-value-2")
        tap("adjustment-confirm")
        finishCelebration()
        compose.waitUntil { compose.onAllNodesWithTag("adjustment-confirm").fetchSemanticsNodes().isEmpty() }
        tap("manage-open"); tap("add-item")
        compose.onNodeWithTag("save-item").assertIsNotEnabled()
        compose.onNodeWithTag("item-name").performTextInput("Android flow test")
        compose.onNodeWithTag("item-points").performTextReplacement("7")
        tap("save-item")
        compose.waitUntil { compose.onAllNodesWithTag("save-item").fetchSemanticsNodes().isEmpty() }
        val custom = runBlocking { store.load(Instant.now()).items.first { it.title == "Android flow test" } }
        tap("manage-close")
        tap(custom.id)
        finishCelebration()
        tap("manage-open")
        tap("active-${custom.id}")
        compose.waitForIdle()
        tap("edit-${custom.id}")
        compose.onNodeWithTag("delete-item").performScrollTo().performClick()
        tap("confirm-delete")
        compose.waitUntil { compose.onAllNodesWithTag("save-item").fetchSemanticsNodes().isEmpty() }
        tap("manage-close"); tap("undo-mode")
        tap(custom.id)
        compose.waitUntil { compose.onAllNodesWithTag(custom.id).fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithTag("celebration").assertDoesNotExist()
        tap("undo-mode")
        compose.activityRule.scenario.recreate()
        ready()
        compose.onNodeWithTag("points-balance").assertContentDescriptionEquals(compose.activity.getString(R.string.points_balance, initial + 14))
        assertEquals(initial + 14, runBlocking { store.load(Instant.now()).points.balance })
        database.close()
    }
    @Test fun languageRewardKeypadAndSortingPersist() {
        ready()
        tap("language-menu")
        compose.onNodeWithText("简体中文").performClick()
        compose.waitUntil(10000) { compose.onAllNodesWithText("任务").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("adjustment-open").assertTextContains("手动加减")
        compose.onNodeWithTag("undo-mode").assertTextContains("撤销模式")
        tap("adjustment-open")
        tap("adjustment-value-9"); tap("adjustment-value-9"); tap("adjustment-value-9"); tap("adjustment-value-9")
        compose.onNodeWithTag("adjustment-amount").assertTextEquals("+999")
        tap("adjustment-delete")
        compose.onNodeWithTag("adjustment-amount").assertTextEquals("+99")
        tap("adjustment-confirm")
        finishCelebration()
        compose.waitUntil { compose.onAllNodesWithTag("adjustment-confirm").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithText("奖励").performClick()
        tap("reward-sticker")
        finishCelebration()
        tap("undo-mode"); tap("reward-sticker")
        compose.onNodeWithTag("celebration").assertDoesNotExist()
        tap("undo-mode")
        compose.onNodeWithText("任务").performClick()
        val database = GemDatabase.open(ApplicationProvider.getApplicationContext<Context>())
        val store = LocalStore(database)
        val before = runBlocking { store.load(Instant.now()).items.filter { !it.reward }.map { it.id } }
        tap("manage-open")
        compose.onNodeWithTag("reorder-${before.first()}").performTouchInput {
            swipe(center, center + Offset(0f, 220f), 600)
        }
        compose.waitUntil(5000) {
            runBlocking { store.load(Instant.now()).items.filter { !it.reward }.map { it.id } } != before
        }
        tap("manage-close")
        compose.activityRule.scenario.recreate()
        ready()
        compose.onNodeWithText("任务").assertExists()
        tap("language-menu")
        compose.onNodeWithText("English").performClick()
        compose.waitUntil(10000) { compose.onAllNodesWithText("Tasks").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("adjustment-open").assertTextContains("Adjust")
        compose.onNodeWithTag("undo-mode").assertTextContains("Undo")
        // Restore the fixture order through the same validated storage API.
        runBlocking { store.reorder(before, false) }
        database.close()
    }

}
