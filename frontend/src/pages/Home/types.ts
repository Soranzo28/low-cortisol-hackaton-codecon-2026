export interface MeData {
  clerk_user_id: string
  nick: string | null
  total_score?: number
  wins?: number
  matches_played?: number
}

export interface RankingEntry {
  nick: string
  total_score: number
  wins: number
  matches_played: number
}

export interface NickModalProps {
  inputRef: { current: HTMLInputElement | null }
  value: string
  onChange: (v: string) => void
  error: string
  saving: boolean
  onSave: () => void
  onCancel?: () => void
}
