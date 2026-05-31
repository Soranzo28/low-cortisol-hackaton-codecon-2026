/**
 * Centralized route definitions.
 * Import this wherever you need to reference a route path.
 */
export const ROUTES = {
  HOME: '/',
  ROOM: '/room/:roomId',
  ABOUT: '/sobre',
} as const

/** Build a room URL for a specific room ID. */
export function roomPath(roomId: string): string {
  return `/room/${roomId}`
}
