package expo.modules.resttimer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Постоянное уведомление таймера отдыха: обратный отсчёт в шторке, строке состояния и на экране блокировки.
// Отсчёт рисует сама система (хронометр), поэтому он идёт, даже когда приложение свернуто.
class RestTimerModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No context")

  override fun definition() = ModuleDefinition {
    Name("RestTimer")

    // overtime = false: отсчёт до endsAt; true: время уже вышло, считаем вверх от endsAt
    Function("show") { endsAt: Double, title: String, body: String, overtime: Boolean ->
      show(endsAt.toLong(), title, body, overtime)
    }

    Function("hide") {
      nm().cancel(ID)
    }
  }

  private fun nm() = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun show(endsAt: Long, title: String, body: String, overtime: Boolean) {
    if (Build.VERSION.SDK_INT >= 26) {
      val ch = NotificationChannel(CHANNEL, "Таймер отдыха на экране", NotificationManager.IMPORTANCE_LOW).apply {
        setShowBadge(false)
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      }
      nm().createNotificationChannel(ch)
    }
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
    val pi = launch?.let { PendingIntent.getActivity(ctx, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
    val icon = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName).takeIf { it != 0 }
      ?: ctx.applicationInfo.icon
    val n = NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentText(body)
      .setWhen(endsAt)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(!overtime)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .apply { if (pi != null) setContentIntent(pi) }
      .build()
    nm().notify(ID, n)
  }

  companion object {
    const val ID = 4207
    const val CHANNEL = "rest-ongoing"
  }
}
