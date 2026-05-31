import type { GameOverData } from '@/hooks/useMultiplayer'

export type { GameOverData }

export interface MatchContext {
  myScore: number
  oppScore: number
  oppNick: string
}
