package com.oscudpclient

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import android.preference.PreferenceManager

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

private const val DEV_LAUNCHER_RECENTS_PREFS = "expo.modules.devlauncher.recentyopenedapps"
private const val DEV_LAUNCHER_NAV_PREFS = "expo.modules.devlauncher.navigation-state"

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages
            // Packages that cannot be autolinked yet can be added manually here, for example:
            // packages.add(new MyReactNativePackage());
            return packages
          }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    if (BuildConfig.DEBUG) {
      // RN `debug_http_host` overrides the dev server host (stale ":8080" while Metro uses 8081).
      PreferenceManager.getDefaultSharedPreferences(this).edit().remove("debug_http_host").apply()
      // Expo dev launcher caches last opened manifest URLs in its own prefs — also fixes stuck :8080.
      getSharedPreferences(DEV_LAUNCHER_RECENTS_PREFS, Context.MODE_PRIVATE).edit().clear().apply()
      getSharedPreferences(DEV_LAUNCHER_NAV_PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
