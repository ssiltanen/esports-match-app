import { Match } from './domain'
import { DateTime } from 'luxon'

export function matchTemplate(match: Match) {
    let startsAt: string
    if (match.startsAt === null) startsAt = ''
    else {
        const start = DateTime.fromJSDate(match.startsAt)
        const diff = start.diffNow()
        const timestamp = start.toLocaleString(DateTime.DATETIME_FULL)
        if (diff.valueOf() < 0) startsAt = 'LIVE NOW!'
        else {
            const dur = diff.shiftTo('days', 'hours', 'minutes').toObject()
            const days = dur.days ? dur.days : 0
            const hours = dur.hours ? dur.hours : 0
            const minutes = dur.minutes ? dur.minutes : 0
            startsAt = `in ${days ? days + 'd ' : ''}${hours ? hours + 'h ' : ''}${Math.round(minutes)}min \n@ ${timestamp}`
        }
    }
    let score = match.score ? match.score : 'vs'
    const streams = match.streams
        .map(s => `<a href="${s.url}">${s.platform}</a>`)
        .join('\n')

    return `
<b>${match.bestOf} ${startsAt}</b>

<b><a href="${match.teamA.url}">${match.teamA.name}</a> ${score} <a href="${match.teamB.url}">${match.teamB.name}</a></b>

<b>League</b>
<a href="${match.league?.url}">${match.league?.name}</a>`
}

export function matchTemplateFull(match: Match) {
    let startsAt: string
    if (match.startsAt === null) startsAt = ''
    else {
        const start = DateTime.fromJSDate(match.startsAt)
        const diff = start.diffNow()
        const timestamp = start.toLocaleString(DateTime.DATETIME_FULL)
        if (diff.valueOf() < 0) startsAt = 'LIVE NOW!'
        else {
            const dur = diff.shiftTo('days', 'hours', 'minutes').toObject()
            const days = dur.days ? dur.days : 0
            const hours = dur.hours ? dur.hours : 0
            const minutes = dur.minutes ? dur.minutes : 0
            startsAt = `in ${days ? days + 'd ' : ''}${hours ? hours + 'h ' : ''}${Math.round(minutes)}min \n@ ${timestamp}`
        }
    }
    let score = match.score ? match.score : 'vs'
    const streams = match.streams
        .map(s => `<a href="${s.url}">${s.platform}</a>`)
        .join('\n')

    return `
<b>${match.bestOf} ${startsAt}</b>

<b><a href="${match.teamA.url}">${match.teamA.name}</a> ${score} <a href="${match.teamB.url}">${match.teamB.name}</a></b>

<b>League</b>
<a href="${match.league?.url}">${match.league?.name}</a>

${streams.length > 0 ? `<b>Streams</b>\n${streams}` : ''}`
}

export function concludedMatchTemplate(match: Match) {
    let startsAt: string
    if (match.startsAt === null) startsAt = ''
    else {
        const timestamp = DateTime
            .fromJSDate(match.startsAt)
            .toLocaleString(DateTime.DATETIME_FULL)
        startsAt = `Match was played \n@ ${timestamp}`
    }
    let score = match.score ? match.score : 'vs'

    return `
<b>${startsAt}</b>

<b><a href="${match.teamA.url}">${match.teamA.name}</a> ${score} <a href="${match.teamB.url}">${match.teamB.name}</a></b>

<b>League</b>
<a href="${match.league?.url}">${match.league?.name}</a>`
}