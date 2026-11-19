package com.oscard0823.cajafantasma.updater

/** Pure wall-clock arithmetic, shared by both notification layouts. */
internal data class EventTiming(
    val selectedVisionId: String,
    val name: String,
    val phase: String,
    val startedAt: Long,
    val waitMs: Long,
    val activeMs: Long,
    val delayMs: Long,
    val english: Boolean = false,
)

internal data class NotificationClock(val label: String, val endsAt: Long?)
internal data class EventNotificationClocks(val vision: NotificationClock, val secondary: NotificationClock)

internal fun notificationClocks(timing: EventTiming, now: Long): EventNotificationClocks {
    val fullCycle = timing.waitMs + timing.activeMs
    require(fullCycle > 0 && timing.waitMs > 0 && timing.activeMs > 0)
    val elapsed = (now - timing.startedAt).coerceAtLeast(0)
    var start = timing.startedAt + elapsed / fullCycle * fullCycle
    val remainder = elapsed % fullCycle
    var active = timing.phase == "active"
    var duration = if (active) timing.activeMs else timing.waitMs
    if (remainder >= duration) {
        start += duration
        active = !active
        duration = if (active) timing.activeMs else timing.waitMs
    }
    val end = start + duration
    val transition = !active && now < start + timing.delayMs
    val phaseLabel = if (transition) {
        if (timing.english) "transition" else "transición"
    } else if (active) {
        if (timing.english) "ends in" else "termina en"
    } else if (timing.english) "starts in" else "empieza en"
    val vision = NotificationClock("${timing.name} · $phaseLabel", if (transition) (start + timing.delayMs).coerceAtMost(end) else end)
    val appearanceDelay = 15 * 60_000L
    if (timing.selectedVisionId == "resonance" && timing.activeMs > appearanceDelay) {
        val name = if (timing.english) "The Echo" else "El Eco"
        val opensAt = (if (active) start else end) + appearanceDelay
        val portal = if (now >= opensAt) {
            NotificationClock("$name · ${if (timing.english) "has appeared" else "ya apareció"}", null)
        } else {
            NotificationClock("$name · ${if (timing.english) "portal opens in" else "portal en"}", opensAt)
        }
        return EventNotificationClocks(vision, portal)
    }
    val whaleName = if (timing.english) "Whale" else "Ballena"
    val whale = when {
        timing.selectedVisionId != "gravity" || timing.activeMs <= 15 * 60_000L ->
            NotificationClock("$whaleName · ${if (timing.english) "not scheduled" else "no programada"}", null)
        active && now < start + 15 * 60_000L ->
            NotificationClock("$whaleName · ${if (timing.english) "starts in" else "empieza en"}", start + 15 * 60_000L)
        active -> NotificationClock("$whaleName · ${if (timing.english) "ends in" else "termina en"}", end + 5 * 60_000L)
        now < start + 5 * 60_000L ->
            NotificationClock("$whaleName · ${if (timing.english) "ends in" else "termina en"}", start + 5 * 60_000L)
        else -> NotificationClock("$whaleName · ${if (timing.english) "starts in" else "empieza en"}", end + 15 * 60_000L)
    }
    return EventNotificationClocks(vision, whale)
}
