package me.gordon.gemsteps

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.core.content.edit
import java.util.Locale

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Explicitly persist the first choice, matching iOS even if the system language changes later.
        val preferences = getSharedPreferences("preferences", MODE_PRIVATE)
        if (!preferences.getBoolean("languageInitialized", false)) {
            if (AppCompatDelegate.getApplicationLocales().isEmpty) {
                val tag = if (Locale.getDefault().language == "zh") "zh-Hans" else "en"
                AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
            }
            preferences.edit { putBoolean("languageInitialized", true) }
        }
        enableEdgeToEdge()
        setContent { GemStepsApp() }
    }
}
