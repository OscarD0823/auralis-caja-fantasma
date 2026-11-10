package com.oscard0823.cajafantasma.updater

internal data class VoiceAlarm(val eventStartsAt: Long, val alarmAt: Long)

internal fun nextVoiceAlarm(
    anchor: Long,
    repeatMs: Long,
    leadMs: Long,
    lastSpokenStart: Long,
    now: Long,
): VoiceAlarm {
    require(anchor > 0 && repeatMs in 120_000L..63_072_000_000L && leadMs in 1L..3_600_000L)
    val elapsedCycles = if (now < anchor) 0 else (now - anchor) / repeatMs + 1
    var start = anchor + elapsedCycles * repeatMs
    if (start == lastSpokenStart) start += repeatMs
    return VoiceAlarm(start, maxOf(now + 500, start - leadMs))
}
