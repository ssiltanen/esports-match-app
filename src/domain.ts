export type Team = {
  name: string | null
  fullname: string | null
  url: string | null
  logoUrl: string | null
}

export type League = {
  name: string | null
  url: string | null
  logoUrl: string | null
}

export type Stream = {
  platform: string
  url: string | null
}

export type Match = {
  matchId: string
  teamA: Team
  teamB: Team
  startsAt: Date | null
  score: string | null
  bestOf: string | null
  streams: Stream[]
  league: League | null
}

type Minute = number

const MINUTE = 60 * 1000; /* ms */
function nullSafeDatesDifferLessThan(a: Date | null, b: Date | null, amount: Minute) {
  if (a && b) {
    const diff = a.getTime() - b.getTime()
    return Math.abs(diff) < (amount * MINUTE)
  }
  else
    return false
}
const startTimeInPast = (match: Match) => match.startsAt !== null && match.startsAt < new Date()

export const concluded = (match: Match) => match.bestOf === null && startTimeInPast(match)
export const live = (match: Match) => match.bestOf !== null && startTimeInPast(match)
export const startsIn = (match: Match, minutes: number) => !startTimeInPast(match) && nullSafeDatesDifferLessThan(match.startsAt, new Date(), minutes)
export const team = (match: Match, name: string) => {
  const compare = (a:string, b:string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0
  return (match.teamA.name !== null && compare(match.teamA.name, name))
    || (match.teamA.fullname !== null && compare(match.teamA.fullname, name))
    || (match.teamB.name !== null && compare(match.teamB.name, name))
    || (match.teamB.fullname !== null && compare(match.teamB.fullname, name))
}