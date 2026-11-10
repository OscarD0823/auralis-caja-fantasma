package com.oscard0823.cajafantasma.updater

import org.junit.Assert.assertEquals
import org.junit.Test

class VoiceAlertTimingTest {
    private val eventStart = 1_800_000_000_000L
    private val hour = 3_600_000L
    private val lead = 300_000L

    @Test
    fun schedulesBeforeTheEvent() {
        assertEquals(VoiceAlarm(eventStart, eventStart - lead), nextVoiceAlarm(eventStart, hour, lead, 0, eventStart - hour))
    }

    @Test
    fun warnsWhenOpenedInsideTheLeadWindow() {
        val now = eventStart - 120_000
        assertEquals(VoiceAlarm(eventStart, now + 500), nextVoiceAlarm(eventStart, hour, lead, 0, now))
    }

    @Test
    fun skipsAnEventThatAlreadyStarted() {
        assertEquals(eventStart + hour, nextVoiceAlarm(eventStart, hour, lead, 0, eventStart).eventStartsAt)
        assertEquals(eventStart + 4 * hour, nextVoiceAlarm(eventStart, hour, lead, 0, eventStart + 3 * hour + 1).eventStartsAt)
    }

    @Test
    fun reopeningDoesNotRepeatAnAttemptedAlert() {
        val next = nextVoiceAlarm(eventStart, hour, lead, eventStart, eventStart - 60_000)
        assertEquals(eventStart + hour, next.eventStartsAt)
    }
}
