import { useRef, useEffect, useCallback } from 'react'
import auraTrack from '@/assets/track/aura.mp3'
import lowTrack from '@/assets/track/low.mp3'

/**
 * Manages in-game audio:
 *  - aura.mp3 → starts 10s after the match begins, 30% volume, stops when game ends
 *  - low.mp3  → plays on victory screen
 *
 * Call `stopAll()` when navigating away (e.g. back to Home).
 */
export function useGameAudio() {
  const auraRef = useRef<HTMLAudioElement | null>(null)
  const lowRef = useRef<HTMLAudioElement | null>(null)
  const auraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lazily create audio elements (only once)
  const getAura = useCallback(() => {
    if (!auraRef.current) {
      const audio = new Audio(auraTrack)
      audio.loop = true
      audio.volume = 0.3
      auraRef.current = audio
    }
    return auraRef.current
  }, [])

  const getLow = useCallback(() => {
    if (!lowRef.current) {
      const audio = new Audio(lowTrack)
      audio.loop = false
      audio.volume = 1.0
      lowRef.current = audio
    }
    return lowRef.current
  }, [])

  /**
   * Schedule aura.mp3 to start 10 seconds after being called.
   * Safe to call multiple times — only the first scheduling will take effect.
   */
  const scheduleAura = useCallback(() => {
    // Already scheduled or already playing
    if (auraTimerRef.current) return
    const audio = getAura()
    if (!audio.paused) return

    auraTimerRef.current = setTimeout(() => {
      audio.currentTime = 0
      audio.play().catch(() => {})
    }, 10_000)
  }, [getAura])

  /** Stop aura immediately. */
  const stopAura = useCallback(() => {
    if (auraTimerRef.current) {
      clearTimeout(auraTimerRef.current)
      auraTimerRef.current = null
    }
    const audio = auraRef.current
    if (audio && !audio.paused) {
      audio.pause()
      audio.currentTime = 0
    }
  }, [])

  /** Play low.mp3 (victory). */
  const playLow = useCallback(() => {
    const audio = getLow()
    audio.currentTime = 0
    audio.play().catch(() => {})
  }, [getLow])

  /** Stop everything — call on navigate home or unmount. */
  const stopAll = useCallback(() => {
    stopAura()
    const low = lowRef.current
    if (low && !low.paused) {
      low.pause()
      low.currentTime = 0
    }
  }, [stopAura])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [stopAll])

  return { scheduleAura, stopAura, playLow, stopAll }
}
