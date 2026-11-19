package com.oscard0823.cajafantasma.updater

import org.junit.Assert.*
import org.junit.Test

class EventNotificationTimingTest {
    private val minute = 60_000L
    private val anchor = 1_000_000L
    private fun timing(phase: String = "active", active: Long = 30 * minute, delay: Long = 3_000) =
        EventTiming("gravity", "Gravedad", phase, anchor, 30 * minute, active, delay)

    @Test fun activeBeforeWhale() {
        val clocks = notificationClocks(timing(), anchor + 10 * minute)
        assertEquals(anchor + 30 * minute, clocks.vision.endsAt)
        assertEquals(anchor + 15 * minute, clocks.secondary.endsAt)
        assertTrue(clocks.secondary.label.contains("empieza"))
    }
    @Test fun whaleContinuesFiveMinutesAfterGravity() {
        val active = notificationClocks(timing(), anchor + 15 * minute)
        assertEquals(anchor + 35 * minute, active.secondary.endsAt)
        val waiting = notificationClocks(timing(), anchor + 31 * minute)
        assertEquals(anchor + 35 * minute, waiting.secondary.endsAt)
        assertTrue(waiting.secondary.label.contains("termina"))
    }
    @Test fun nextWhaleAfterDeparture() {
        val clocks = notificationClocks(timing(), anchor + 35 * minute)
        assertEquals(anchor + 75 * minute, clocks.secondary.endsAt)
        assertTrue(clocks.secondary.label.contains("empieza"))
    }
    @Test fun millisecondTransitionDoesNotShiftTheCycle() {
        val clocks = notificationClocks(timing(delay = 850), anchor + 30 * minute + 200)
        assertEquals(anchor + 30 * minute + 850, clocks.vision.endsAt)
        assertTrue(clocks.vision.label.contains("transición"))
        val after = notificationClocks(timing(delay = 850), anchor + 30 * minute + 851)
        assertEquals(anchor + 60 * minute, after.vision.endsAt)
    }
    @Test fun clocksSurviveManyHoursAndCustomDurations() {
        val clocks = notificationClocks(timing(active = 45 * minute), anchor + 600 * minute + 20 * minute)
        assertEquals(anchor + 600 * minute + 50 * minute, clocks.secondary.endsAt)
        assertEquals(anchor + 600 * minute + 45 * minute, clocks.vision.endsAt)
    }
    @Test fun otherVisionsAndShortEventsHaveNoWhale() {
        assertNull(notificationClocks(timing(active = 15 * minute), anchor).secondary.endsAt)
        assertNull(notificationClocks(timing().copy(selectedVisionId = "lunar", name = "Lunar"), anchor).secondary.endsAt)
    }
    @Test fun echoOpensFifteenMinutesIntoResonance() {
        val resonance = timing().copy(selectedVisionId = "resonance", name = "Resonancia discordante")
        val before = notificationClocks(resonance, anchor + 15 * minute - 1)
        assertEquals(anchor + 15 * minute, before.secondary.endsAt)
        assertTrue(before.secondary.label.contains("El Eco"))
        val opening = notificationClocks(resonance, anchor + 15 * minute)
        assertNull(opening.secondary.endsAt)
        assertTrue(opening.secondary.label.contains("ya apareció"))
        val waiting = notificationClocks(resonance, anchor + 30 * minute)
        assertEquals(anchor + 75 * minute, waiting.secondary.endsAt)
        assertTrue(waiting.vision.label.contains("Resonancia discordante"))
    }
}
