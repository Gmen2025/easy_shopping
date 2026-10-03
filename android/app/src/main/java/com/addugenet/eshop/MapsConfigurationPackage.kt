package com.addugenet.eshop

import android.content.pm.PackageManager
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.uimanager.ViewManager

class MapsConfigurationModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "MapsConfiguration"

  override fun getConstants(): Map<String, Any> {
    val appInfo = reactApplicationContext.packageManager.getApplicationInfo(
      reactApplicationContext.packageName,
      PackageManager.GET_META_DATA
    )
    val key = appInfo.metaData?.getString("com.google.android.geo.API_KEY").orEmpty().trim()
    return mapOf("isConfigured" to key.isNotEmpty())
  }
}

class MapsConfigurationPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(MapsConfigurationModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
