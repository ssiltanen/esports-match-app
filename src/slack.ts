import axios from 'axios'
import { DateTime } from 'luxon'
import { Match, Stream } from './domain'

const SLACK_URL = process.env.SLACK_URL
if (!SLACK_URL) throw new Error('"SLACK_URL" env var is required!')

const liveOrUpcomingMatchTime = (match: Match) => {
  if (match.startsAt === null) return ""
  else {
    const start = DateTime.fromJSDate(match.startsAt).setZone(
      "Europe/Helsinki"
    )
    const diff = start.diffNow()
    const timestamp = start.toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY)
    if (diff.valueOf() < 0) return "LIVE NOW!"
    else {
      const dur = diff.shiftTo("days", "hours", "minutes").toObject()
      const days = dur.days ? dur.days : 0
      const hours = dur.hours ? dur.hours : 0
      const minutes = dur.minutes ? dur.minutes : 0
      return `in ${days ? days + "d " : ""}${
        hours ? hours + "h " : ""
      }${Math.round(minutes)}min @ ${timestamp}`
    }
  }
}

const stream = (streams: Stream[]) => {
  const twitch = streams.find(s => s.platform.toLowerCase() === 'twitch')
  if (twitch) return twitch.url
  else streams.map(s => s.url).join('     ')
}

export const sendToSlack = async (match: Match) => {
  const a = await axios({
    baseURL: SLACK_URL,
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data: {
      teamA: match.teamA.name,
      teamB: match.teamB.name,
      bestOf: match.bestOf,
      startsAt: liveOrUpcomingMatchTime(match),
      stream: stream(match.streams),
      league: match.league?.name
    }
  })
}