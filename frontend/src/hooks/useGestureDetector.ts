import { useEffect, useRef, useState, type RefObject } from 'react'
import { PoseLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export type DetectionStatus = 'loading' | 'ready' | 'detecting'

type ArmState = 'left-up' | 'right-up' | null

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const TOP_RATIO = 0.45
const BOTTOM_RATIO = 0.55
const MIN_VISIBILITY = 0.5
const STATE_RESET_TIMEOUT_MS = 1000
const EVENT_HOLD_MS = 1000  // hold duration for absolute_cinema

const KEY_LANDMARKS: Record<number, string> = {
  11: 'L.Shoulder', 12: 'R.Shoulder',
  13: 'L.Elbow',    14: 'R.Elbow',
  15: 'L.Wrist',    16: 'R.Wrist',
}

type Landmark = { x: number; y: number; z: number; visibility?: number }

interface CoverTransform {
  W: number; H: number; vw: number; vh: number; scale: number; offsetX: number; offsetY: number
}

function computeTransform(video: HTMLVideoElement, canvas: HTMLCanvasElement): CoverTransform {
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

function computePalmCenter(lms: Landmark[], a: number, b: number, c: number): Landmark {
  return {
    x: (lms[a].x + lms[b].x + lms[c].x) / 3,
    y: (lms[a].y + lms[b].y + lms[c].y) / 3,
    z: (lms[a].z + lms[b].z + lms[c].z) / 3,
    visibility: Math.min(lms[a].visibility ?? 1, lms[b].visibility ?? 1, lms[c].visibility ?? 1),
  }
}

// Absolute Cinema: open palm facing the camera
// z convention: wrist.z > mean(tips.z) → palm facing camera
// fingers open: tip.y < MCP.y (smaller y = higher in frame)
function isOpenPalmFacingCamera(hand: Landmark[]): boolean {
  const wristZ = hand[0].z
  const tipZ = (hand[4].z + hand[8].z + hand[12].z + hand[16].z + hand[20].z) / 5
  const palmFacing = wristZ > tipZ

  const fingersOpen =
    hand[8].y < hand[5].y &&   // index
    hand[12].y < hand[9].y &&  // middle
    hand[16].y < hand[13].y && // ring
    hand[20].y < hand[17].y    // pinky

  return palmFacing && fingersOpen
}

// Nerd Up: only the index finger raised, all other fingers closed
function isNerdUp(hand: Landmark[]): boolean {
  const indexUp  = hand[8].y  < hand[6].y   // index tip above index PIP
  const middleDown = hand[12].y >= hand[10].y  // middle closed
  const ringDown   = hand[16].y >= hand[14].y  // ring closed
  const pinkyDown  = hand[20].y >= hand[18].y  // pinky closed
  return indexUp && middleDown && ringDown && pinkyDown
}

// Debug: hand connections for HandLandmarker (21 landmarks)
const HAND_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
]

function drawHandDebug(
  canvas: HTMLCanvasElement,
  hands: Landmark[][],
  t: CoverTransform,
  activeIdx: number,  // index of the hand that matched the current event pose (-1 = none)
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (canvas.width !== t.W) canvas.width = t.W
  if (canvas.height !== t.H) canvas.height = t.H
  ctx.clearRect(0, 0, t.W, t.H)

  hands.forEach((hand, hi) => {
    const isActive = hi === activeIdx
    const baseColor = isActive ? '#4ade80' : 'rgba(255,255,255,0.5)'

    ctx.strokeStyle = baseColor; ctx.lineWidth = 1.5
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = toScreen(hand[a].x, hand[a].y, t)
      const pb = toScreen(hand[b].x, hand[b].y, t)
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
    }

    for (let i = 0; i < hand.length; i++) {
      const { x, y } = toScreen(hand[i].x, hand[i].y, t)
      ctx.fillStyle = i === 0 ? baseColor : 'rgba(255,255,255,0.75)'
      ctx.beginPath(); ctx.arc(x, y, i === 0 ? 5 : 3, 0, Math.PI * 2); ctx.fill()
    }

    if (isActive) {
      const tip = toScreen(hand[8].x, hand[8].y, t)
      ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#4ade80'
      ctx.fillText('☝ nerd up!', tip.x + 6, tip.y - 6)
    }
  })
}

function drawThresholdLines(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  anyAbove: boolean, anyBelow: boolean, wristsDetected: boolean,
) {
  const topY = TOP_RATIO * H
  const bottomY = BOTTOM_RATIO * H
  for (const { y, active, label } of [
    { y: topY, active: anyAbove, label: `↑ zona superior (${Math.round(TOP_RATIO * 100)}%)` },
    { y: bottomY, active: anyBelow, label: `↓ zona inferior (${Math.round(BOTTOM_RATIO * 100)}%)` },
  ]) {
    const color = !wristsDetected ? 'rgba(156,163,175,0.7)' : active ? 'rgba(74,222,128,0.9)' : 'rgba(255,255,255,0.6)'
    ctx.save()
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([12, 8])
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = color; ctx.font = 'bold 12px monospace'
    ctx.fillText(label, 12, y - 6)
    ctx.restore()
  }
}

function drawPalmMarker(ctx: CanvasRenderingContext2D, sx: number, sy: number, above: boolean, below: boolean, label: string) {
  const color = above ? '#4ade80' : below ? '#60a5fa' : '#f87171'
  const r = 12
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(sx, sy, r + 1, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(sx - r, sy); ctx.lineTo(sx + r, sy); ctx.moveTo(sx, sy - r); ctx.lineTo(sx, sy + r); ctx.stroke()
  ctx.font = 'bold 11px monospace'; ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(label, sx + r + 4, sy + 4)
  ctx.fillStyle = '#fff'; ctx.fillText(label, sx + r + 4, sy + 4)
}

function drawDebug(
  canvas: HTMLCanvasElement, landmarks: Landmark[], t: CoverTransform,
  leftPalmScreen: { x: number; y: number }, rightPalmScreen: { x: number; y: number },
  leftPalmAbove: boolean, rightPalmAbove: boolean, leftPalmBelow: boolean, rightPalmBelow: boolean, wristsDetected: boolean,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (canvas.width !== t.W) canvas.width = t.W
  if (canvas.height !== t.H) canvas.height = t.H
  ctx.clearRect(0, 0, t.W, t.H)
  drawThresholdLines(ctx, t.W, t.H, leftPalmAbove || rightPalmAbove, leftPalmBelow || rightPalmBelow, wristsDetected)
  if (!wristsDetected) return
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2
  for (const conn of PoseLandmarker.POSE_CONNECTIONS) {
    const a = toScreen(landmarks[conn.start].x, landmarks[conn.start].y, t)
    const b = toScreen(landmarks[conn.end].x, landmarks[conn.end].y, t)
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  for (let i = 0; i < landmarks.length; i++) {
    if (i in KEY_LANDMARKS) continue
    const { x, y } = toScreen(landmarks[i].x, landmarks[i].y, t)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
  }
  for (const [idxStr, label] of Object.entries(KEY_LANDMARKS)) {
    const idx = Number(idxStr)
    const { x, y } = toScreen(landmarks[idx].x, landmarks[idx].y, t)
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill()
    ctx.font = 'bold 11px monospace'; ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(`${idx} ${label}`, x + 12, y + 4)
    ctx.fillStyle = '#fff'; ctx.fillText(`${idx} ${label}`, x + 12, y + 4)
  }
  drawPalmMarker(ctx, leftPalmScreen.x, leftPalmScreen.y, leftPalmAbove, leftPalmBelow, 'L.Palm')
  drawPalmMarker(ctx, rightPalmScreen.x, rightPalmScreen.y, rightPalmAbove, rightPalmBelow, 'R.Palm')
}

export function useGestureDetector(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  drawOverlay: boolean = false,
  mode: 'normal' | 'event' = 'normal',
  eventId: string | null = null,
  onEventComplete?: () => void,
) {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState<DetectionStatus>('loading')

  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastArmStateRef = useRef<ArmState>(null)
  const lastCountTimeRef = useRef<number>(0)
  const lowVisStartRef = useRef<number>(0)
  const eventHoldStartRef = useRef<number>(0)  // 0=idle, >0=holding start time, -1=completed

  // Always-fresh refs so the rAF loop never captures stale closures
  const modeRef = useRef(mode)
  modeRef.current = mode
  const eventIdRef = useRef(eventId)
  eventIdRef.current = eventId
  const onEventCompleteRef = useRef(onEventComplete)
  onEventCompleteRef.current = onEventComplete

  // Reset detection state when event mode starts
  useEffect(() => {
    if (mode === 'event') {
      eventHoldStartRef.current = 0
    }
  }, [mode])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN)
      const [landmarker, handLandmarker] = await Promise.all([
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        }),
        HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
        }),
      ])
      if (cancelled) { landmarker.close(); handLandmarker.close(); return }
      landmarkerRef.current = landmarker
      handLandmarkerRef.current = handLandmarker
      setStatus('ready')
    }

    init().catch((err) => console.error('Landmarker init failed:', err))

    return () => {
      cancelled = true
      cancelAnimationFrame(animFrameRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      handLandmarkerRef.current?.close()
      handLandmarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready' && status !== 'detecting') return

    const canvas = canvasRef.current
    let observer: ResizeObserver | null = null
    if (canvas) {
      const syncSize = () => {
        const w = canvas.clientWidth; const h = canvas.clientHeight
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
        lastArmStateRef.current = null
      }
    }

    function clearCanvas() {
      const cvs = canvasRef.current
      if (!cvs) return
      const ctx = cvs.getContext('2d')
      ctx?.clearRect(0, 0, cvs.width, cvs.height)
    }

    function detect() {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      // ── Event mode: use HandLandmarker ──────────────────────────────────────
      if (modeRef.current === 'event') {
        const handLandmarker = handLandmarkerRef.current
        if (handLandmarker) {
          const handResult = handLandmarker.detectForVideo(video, performance.now())
          const hands = handResult.landmarks
          let poseDetected = false

          let debugActiveIdx = -1

          if (eventIdRef.current === 'absolute_cinema') {
            poseDetected = hands.length >= 2 && hands.every(isOpenPalmFacingCamera)

          } else if (eventIdRef.current === 'nerd_up') {
            // Any single hand with only the index finger raised
            const idx = hands.findIndex(isNerdUp)
            if (idx !== -1) { poseDetected = true; debugActiveIdx = idx }
          }

          // Draw debug overlay in training mode
          if (drawOverlay && canvasRef.current && hands.length > 0) {
            const t = computeTransform(video, canvasRef.current)
            drawHandDebug(canvasRef.current, hands, t, debugActiveIdx)
          } else if (!drawOverlay) {
            clearCanvas()
          }

          const now = Date.now()
          if (poseDetected) {
            if (eventHoldStartRef.current === 0) {
              eventHoldStartRef.current = now
            } else if (eventHoldStartRef.current > 0 && now - eventHoldStartRef.current >= EVENT_HOLD_MS) {
              eventHoldStartRef.current = -1
              onEventCompleteRef.current?.()
            }
          } else {
            if (eventHoldStartRef.current !== -1) eventHoldStartRef.current = 0
          }
        }
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      // ── Normal mode: use PoseLandmarker ─────────────────────────────────────
      const landmarker = landmarkerRef.current
      if (!landmarker) {
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
            drawDebug(canvasRef.current, lms, t, leftPalmScreen, rightPalmScreen,
              leftPalmAbove, rightPalmAbove, leftPalmBelow, rightPalmBelow, wristsDetected)
          } else {
            clearCanvas()
          }
        }

        if (!wristsDetected) { handleLowVis(); animFrameRef.current = requestAnimationFrame(detect); return }
        lowVisStartRef.current = 0

        let currentState: ArmState = null
        if (leftPalmAbove && rightPalmBelow) currentState = 'left-up'
        else if (rightPalmAbove && leftPalmBelow) currentState = 'right-up'

        if (currentState !== null && lastArmStateRef.current !== null && currentState !== lastArmStateRef.current) {
          const now = Date.now()
          if (now - lastCountTimeRef.current > 300) {
            setCount((c) => c + 1)
            lastCountTimeRef.current = now
          }
        }
        if (currentState !== null) lastArmStateRef.current = currentState
      } else {
        handleLowVis()
        if (canvasRef.current) {
          const cvs = canvasRef.current
          const ctx = cvs.getContext('2d')
          if (ctx) {
            const w = cvs.clientWidth; const h = cvs.clientHeight
            if (cvs.width !== w) cvs.width = w
            if (cvs.height !== h) cvs.height = h
            ctx.clearRect(0, 0, w, h)
            if (drawOverlay) drawThresholdLines(ctx, w, h, false, false, false)
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(detect)
    }

    detect()
    return () => { cancelAnimationFrame(animFrameRef.current); observer?.disconnect() }
  }, [status, videoRef, canvasRef, drawOverlay])

  return { count, status }
}
