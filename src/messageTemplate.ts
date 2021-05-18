import { Match } from "./domain"

export function matchTemplate(match: Match) {
    let startsAt: string
    if (match.startsAt === null) startsAt = ''
    else if (match.startsAt < new Date()) startsAt = 'LIVE NOW!'
    else startsAt = `@ ${match.startsAt.toUTCString()}`

    let score = match.score ? match.score : 'vs'

    const streams = match.streams
        .map(s => `<a href="${s.url}">${s.platform}</a>`)
        .join('\n')

    return `
<b>${match.bestOf} ${startsAt}</b>

<b><a href="${match.teamA.url}">${match.teamA.name}</a> ${score} <a href="${match.teamB.url}">${match.teamB.name}</a></b>

<b>League</b>
<a href="${match.league?.url}">${match.league?.name}</a>

<b>Streams</b>
${streams}`
}

export function concludedMatchTemplate(match: Match) {
    let startsAt: string
    if (match.startsAt === null) startsAt = ''
    else startsAt = `Match played @ ${match.startsAt.toUTCString()}`

    let score = match.score ? match.score : 'vs'

    const streams = match.streams
        .map(s => `<a href="${s.url}">${s.platform}</a>`)
        .join('\n')

    return `
<b>${startsAt}</b>

<b><a href="${match.teamA.url}">${match.teamA.name}</a> ${score} <a href="${match.teamB.url}">${match.teamB.name}</a></b>

<b>League</b>
<a href="${match.league?.url}">${match.league?.name}</a>`
}

