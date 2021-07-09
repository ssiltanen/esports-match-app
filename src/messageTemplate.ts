import { Match } from './domain'
import { DateTime } from 'luxon'

const liveOrUpcomingMatchTime = (match: Match) => {
  if (match.startsAt === null) return ''
  else {
    const start = DateTime.fromJSDate(match.startsAt)
    const diff = start.diffNow()
    const timestamp = start.toLocaleString(DateTime.DATETIME_FULL)
    if (diff.valueOf() < 0) return '<b>LIVE NOW!</b>'
    else {
      const dur = diff.shiftTo('days', 'hours', 'minutes').toObject()
      const days = dur.days ? dur.days : 0
      const hours = dur.hours ? dur.hours : 0
      const minutes = dur.minutes ? dur.minutes : 0
      return `<b>in ${days ? days + 'd ' : ''}${hours ? hours + 'h ' : ''}${Math.round(minutes)}min \n@ ${timestamp}</b>`
    }
  }
}

const concludedMatchTime = (match: Match) => {
  if (match.startsAt === null) return ''
  else {
      const timestamp = DateTime
          .fromJSDate(match.startsAt)
          .toLocaleString(DateTime.DATETIME_FULL)
      return `<b>Match was played \n@ ${timestamp}</b>`
  }
}

const score = (match: Match) => `<b>${match.score ? match.score : 'vs'}</b>`

const streams = (match: Match) => {
  const strm = match.streams
    .map(s => `<a href="${s.url}">${s.platform}</a>`)
    .join('\n')
  return strm.length > 0 ? `<b>Streams</b>\n${strm}` : ''
}

const league = (match: Match) => 
  `<b>League</b>\n<a href="${match.league?.url}">${match.league?.name}</a>`

const teamA = (match: Match) =>
  `<b><a href="${match.teamA.url}">${match.teamA.name}</a></b>`

const teamB = (match: Match) =>
  `<b><a href="${match.teamB.url}">${match.teamB.name}</a></b>`


export function matchTemplate(match: Match) {
  return `
${match.bestOf} ${liveOrUpcomingMatchTime(match)}

${teamA(match)} ${score(match)} ${teamB(match)}

${league(match)}`
}

export function matchTemplateWithStreams(match: Match) {
  return `
${match.bestOf} ${liveOrUpcomingMatchTime(match)}

${teamA(match)} ${score(match)} ${teamB(match)}

${league(match)}

${streams(match)}`
}

export function concludedMatchTemplate(match: Match) {
  return `
${concludedMatchTime(match)}

${teamA(match)} ${score(match)} ${teamB(match)}

${league(match)}`
}