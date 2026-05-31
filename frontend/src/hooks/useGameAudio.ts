import { useRef, useEffect, useCallback, useState } from 'react'
import auraTrack from '@/assets/track/aura.mp3'
import lowTrack from '@/assets/track/low.mp3'

const DEFAULT_VOLUME = 0.3
const VOLUME_STEP = 0.1

/**
 * Manages in-game audio:
 *  - aura.mp3 → starts after delay, with fade-out on game end
 *  - low.mp3  → plays on victory screen with fade-in
 *  - volume   → adjustable via volumeUp / volumeDown (affects aura in real-time)
 *
 * Call `stopAll()` when navigating away (e.g. back to Home).
 */
export function useGameAudio() {
  const auraRef = useRef<HTMLAudioElement | null>(null)
  const lowRef = useRef<HTMLAudioElement | null>(null)
  const auraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeRafRef = useRef<number | null>(null)

  // User-controlled master volume for aura (0–1)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)

  // Lazily create audio elements (only once)
  const getAura = useCallback(() => {
    if (!auraRef.current) {
      const audio = new Audio(auraTrack)
      audio.loop = true
      audio.volume = DEFAULT_VOLUME
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

  // Sync aura volume whenever user changes it (only while playing, not during fade)
  useEffect(() => {
    const audio = auraRef.current
    if (audio && !audio.paused && !fadeRafRef.current) {
      audio.volume = volume
    }
  }, [volume])

  const volumeUp = useCallback(() => {
    setVolume(v => {
      const next = Math.min(1, +(v + VOLUME_STEP).toFixed(2))
      return next
    })
  }, [])

  const volumeDown = useCallback(() => {
    setVolume(v => {
      const next = Math.max(0, +(v - VOLUME_STEP).toFixed(2))
      return next
    })
  }, [])

  /**
   * Schedule aura.mp3 to start after a delay.
   * Safe to call multiple times — only the first scheduling will take effect.
   */
  const scheduleAura = useCallback(() => {
    // Already scheduled or already playing
    if (auraTimerRef.current) return
    const audio = getAura()
    if (!audio.paused) return

    auraTimerRef.current = setTimeout(() => {
      audio.volume = volume
      audio.currentTime = 0
      audio.play().catch(() => {})
    }, 2_000)
  // volume is read at schedule-time via closure; we intentionally don't re-schedule on volume change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAura])

  /** Stop aura immediately (no fade, for hard-stop / cleanup). */
  const stopAura = useCallback(() => {
    if (auraTimerRef.current) {
      clearTimeout(auraTimerRef.current)
      auraTimerRef.current = null
    }
    if (fadeRafRef.current) {
      cancelAnimationFrame(fadeRafRef.current)
      fadeRafRef.current = null
    }
    const audio = auraRef.current
    if (audio && !audio.paused) {
      audio.pause()
      audio.currentTime = 0
      audio.volume = volume
    }
  }, [volume])

  /** Fade out aura over ~2 seconds, then pause. */
  const fadeOutAura = useCallback(() => {
    if (auraTimerRef.current) {
      clearTimeout(auraTimerRef.current)
      auraTimerRef.current = null
    }
    const audio = auraRef.current
    if (!audio || audio.paused) return

    const duration = 2000 // ms
    const startVol = audio.volume
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      audio.volume = startVol * (1 - progress)
      if (progress < 1) {
        fadeRafRef.current = requestAnimationFrame(tick)
      } else {
        audio.pause()
        audio.currentTime = 0
        audio.volume = volume // reset to user-set volume
        fadeRafRef.current = null
      }
    }
    fadeRafRef.current = requestAnimationFrame(tick)
  }, [volume])

  /** Play low.mp3 (victory) with a 2-second fade-in. */
  const playLow = useCallback(() => {
    const audio = getLow()
    audio.currentTime = 0
    audio.volume = 0
    audio.play().catch(() => {})

    const duration = 2000 // ms
    const targetVol = 1.0
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      audio.volume = targetVol * progress
      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
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

  return { scheduleAura, stopAura, fadeOutAura, playLow, stopAll, volume, volumeUp, volumeDown }
}
