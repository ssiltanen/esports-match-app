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
    teamA: Team
    teamB: Team
    startsAt: Date | null
    score: string | null
    bestOf: string | null
    streams: Stream[]
    league: League | null
}