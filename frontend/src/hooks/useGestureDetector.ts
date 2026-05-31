import { useEffect, useRef, useState, type RefObject } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export type DetectionStatus = 'loading' | 'ready' | 'detecting'

type ArmState = 'left-up' | 'right-up' | null

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const TOP_RATIO = 0.45
const BOTTOM_RATIO = 0.55

const MIN_VISIBILITY = 0.5
// Only reset arm state after this many ms of continuous low-visibility
const STATE_RESET_TIMEOUT_MS = 1000

const KEY_LANDMARKS: Record<number, string> = {
  11: 'L.Shoulder',
  12: 'R.Shoulder',
  13: 'L.Elbow',
  14: 'R.Elbow',
  15: 'L.Wrist',
  16: 'R.Wrist',
}

type Landmark = { x: number; y: number; z: number; visibility?: number }

interface CoverTransform {
  W: number; H: number; vw: number; vh: number; scale: number; offsetX: number; offsetY: number
}

function computeTransform(video: HTMLVideoElement, canvas: HTMLCanvasElement): CoverTransform {
  // Use the DOM-rendered size of the canvas (which matches the video container)
  const W = canvas.clientWidth || video.clientWidth
  const H = canvas.clientHeight || video.clientHeight
  const vw = video.videoWidth || W
  const vh = video.videoHeight || H
  const scale = Math.max(W / vw, H / vh)
  return { W, H, vw, vh, scale, offsetX: (W - vw * scale) / 2, offsetY: (H - vh * scale) / 2 }
}

function toScreen(nx: number, ny: number, t: CoverTransform) {
  return { x: nx * t.vw * t.scale + t.offsetX, y: ny * t.vh * t.scale + t.offsetY }
}

// Palm center ≈ centroid of wrist + pinky tip + index tip
// Left:  15 (wrist) + 17 (pinky) + 19 (index)
// Right: 16 (wrist) + 18 (pinky) + 20 (index)
function computePalmCenter(lms: Landmark[], a: number, b: number, c: number): Landmark {
  return {
    x: (lms[a].x + lms[b].x + lms[c].x) / 3,
    y: (lms[a].y + lms[b].y + lms[c].y) / 3,
    z: (lms[a].z + lms[b].z + lms[c].z) / 3,
    visibility: Math.min(lms[a].visibility ?? 1, lms[b].visibility ?? 1, lms[c].visibility ?? 1),
  }
}

function drawThresholdLines(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  anyAbove: boolean,
  anyBelow: boolean,
  wristsDetected: boolean,
) {
  const topY = TOP_RATIO * H
  const bottomY = BOTTOM_RATIO * H

  for (const { y, active, label } of [
    { y: topY, active: anyAbove, label: `↑ zona superior (${Math.round(TOP_RATIO * 100)}%)` },
    { y: bottomY, active: anyBelow, label: `↓ zona inferior (${Math.round(BOTTOM_RATIO * 100)}%)` },
  ]) {
    const color = !wristsDetected
      ? 'rgba(156,163,175,0.7)'
      : active ? 'rgba(74,222,128,0.9)' : 'rgba(255,255,255,0.6)'

    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.setLineDash([12, 8])
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = color
    ctx.font = 'bold 12px monospace'
    ctx.fillText(label, 12, y - 6)
    ctx.restore()
  }
}

function drawPalmMarker(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  above: boolean,
  below: boolean,
  label: string,
) {
  const color = above ? '#4ade80' : below ? '#60a5fa' : '#f87171'
  const r = 12

  ctx.strokeStyle = 'rgba(0,0,0,0.7)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(sx, sy, r + 1, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(sx - r, sy); ctx.lineTo(sx + r, sy)
  ctx.moveTo(sx, sy - r); ctx.lineTo(sx, sy + r)
  ctx.stroke()

  ctx.font = 'bold 11px monospace'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.strokeText(label, sx + r + 4, sy + 4)
  ctx.fillStyle = '#fff'
  ctx.fillText(label, sx + r + 4, sy + 4)
}

function drawDebug(
  canvas: HTMLCanvasElement,
  landmarks: Landmark[],
  t: CoverTransform,
  leftPalmScreen: { x: number; y: number },
  rightPalmScreen: { x: number; y: number },
  leftPalmAbove: boolean,
  rightPalmAbove: boolean,
  leftPalmBelow: boolean,
  rightPalmBelow: boolean,
  wristsDetected: boolean,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Sync canvas buffer to its DOM-rendered size
  if (canvas.width !== t.W) canvas.width = t.W
  if (canvas.height !== t.H) canvas.height = t.H
  ctx.clearRect(0, 0, t.W, t.H)

  drawThresholdLines(
    ctx, t.W, t.H,
    leftPalmAbove || rightPalmAbove,
    leftPalmBelow || rightPalmBelow,
    wristsDetected,
  )

  if (!wristsDetected) return

  // ── Skeleton connections ──────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2
  for (const conn of PoseLandmarker.POSE_CONNECTIONS) {
    const a = toScreen(landmarks[conn.start].x, landmarks[conn.start].y, t)
    const b = toScreen(landmarks[conn.end].x, landmarks[conn.end].y, t)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  // ── Generic landmarks ────────────────────────────────────────────────────────
  for (let i = 0; i < landmarks.length; i++) {
    if (i in KEY_LANDMARKS) continue
    const { x, y } = toScreen(landmarks[i].x, landmarks[i].y, t)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── Key landmarks (yellow — reference only, not detection point) ──────────────
  for (const [idxStr, label] of Object.entries(KEY_LANDMARKS)) {
    const idx = Number(idxStr)
    const { x, y } = toScreen(landmarks[idx].x, landmarks[idx].y, t)

    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = 'bold 11px monospace'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    const text = `${idx} ${label}`
    ctx.strokeText(text, x + 12, y + 4)
    ctx.fillStyle = '#fff'
    ctx.fillText(text, x + 12, y + 4)
  }

  // ── Palm center markers (actual detection point) ──────────────────────────────
  drawPalmMarker(ctx, leftPalmScreen.x, leftPalmScreen.y, leftPalmAbove, leftPalmBelow, 'L.Palm')
  drawPalmMarker(ctx, rightPalmScreen.x, rightPalmScreen.y, rightPalmAbove, rightPalmBelow, 'R.Palm')
}

export function useGestureDetector(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  drawOverlay: boolean = false
) {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState<DetectionStatus>('loading')

  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastArmStateRef = useRef<ArmState>(null)
  const lastCountTimeRef = useRef<number>(0)
  // Tracks when low-visibility/no-pose started; 0 = currently visible
  const lowVisStartRef = useRef<number>(0)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN)
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
      if (cancelled) { landmarker.close(); return }
      landmarkerRef.current = landmarker
      setStatus('ready')
    }

    init().catch((err) => console.error('PoseLandmarker init failed:', err))

    return () => {
      cancelled = true
      cancelAnimationFrame(animFrameRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready' && status !== 'detecting') return

    const canvas = canvasRef.current

    // Keep canvas buffer dimensions in sync with its DOM-rendered size
    let observer: ResizeObserver | null = null
    if (canvas) {
      const syncSize = () => {
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (canvas.width !== w) canvas.width = w
        if (canvas.height !== h) canvas.height = h
      }
      syncSize()
      observer = new ResizeObserver(syncSize)
      observer.observe(canvas)
    }

    function handleLowVis() {
      const now = Date.now()
      if (lowVisStartRef.current === 0) {
        lowVisStartRef.current = now
      } else if (now - lowVisStartRef.current > STATE_RESET_TIMEOUT_MS) {
        // Only reset after sustained absence — prevents single bad frames killing the state
        lastArmStateRef.current = null
      }
    }

    function detect() {
      const landmarker = landmarkerRef.current
      const video = videoRef.current

      if (!landmarker || !video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      const result = landmarker.detectForVideo(video, performance.now())

      if (result.landmarks.length > 0) {
        setStatus('detecting')
        const lms = result.landmarks[0]
        const t = computeTransform(video, canvasRef.current!)

        const topY = TOP_RATIO * t.H
        const bottomY = BOTTOM_RATIO * t.H

        const leftPalm = computePalmCenter(lms, 15, 17, 19)
        const rightPalm = computePalmCenter(lms, 16, 18, 20)

        const wristsDetected =
          (leftPalm.visibility ?? 1) >= MIN_VISIBILITY &&
          (rightPalm.visibility ?? 1) >= MIN_VISIBILITY

        const leftPalmScreen = toScreen(leftPalm.x, leftPalm.y, t)
        const rightPalmScreen = toScreen(rightPalm.x, rightPalm.y, t)

        const leftPalmAbove = leftPalmScreen.y < topY
        const rightPalmAbove = rightPalmScreen.y < topY
        const leftPalmBelow = leftPalmScreen.y > bottomY
        const rightPalmBelow = rightPalmScreen.y > bottomY

        if (canvasRef.current) {
          if (drawOverlay) {
            drawDebug(
              canvasRef.current, lms, t,
              leftPalmScreen, rightPalmScreen,
              leftPalmAbove, rightPalmAbove,
              leftPalmBelow, rightPalmBelow,
              wristsDetected,
            )
          } else {
            const cvs = canvasRef.current
            const ctx = cvs.getContext('2d')
            ctx?.clearRect(0, 0, cvs.width, cvs.height)
          }
        }

        if (!wristsDetected) {
          handleLowVis()
          animFrameRef.current = requestAnimationFrame(detect)
          return
        }

        // Palms are visible — reset the low-vis timer
        lowVisStartRef.current = 0

        // Valid "67" state: one palm above top line, other below bottom line
        let currentState: ArmState = null
        if (leftPalmAbove && rightPalmBelow) currentState = 'left-up'
        else if (rightPalmAbove && leftPalmBelow) currentState = 'right-up'

        if (
          currentState !== null &&
          lastArmStateRef.current !== null &&
          currentState !== lastArmStateRef.current
        ) {
          const now = Date.now()
          if (now - lastCountTimeRef.current > 300) {
            setCount((c) => c + 1)
            lastCountTimeRef.current = now
          }
        }

        if (currentState !== null) {
          lastArmStateRef.current = currentState
        }
      } else {
        // No pose at all — same timeout logic, draw lines so user can aim
        handleLowVis()

        if (canvasRef.current) {
          const cvs = canvasRef.current
          const ctx = cvs.getContext('2d')
          if (ctx) {
            const w = cvs.clientWidth
            const h = cvs.clientHeight
            if (cvs.width !== w) cvs.width = w
            if (cvs.height !== h) cvs.height = h
            ctx.clearRect(0, 0, w, h)
            if (drawOverlay) {
              drawThresholdLines(ctx, w, h, false, false, false)
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(detect)
    }

    detect()

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      observer?.disconnect()
    }
  }, [status, videoRef, canvasRef, drawOverlay])

  return { count, status }
}
