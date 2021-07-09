import axios from 'axios'
import { JSDOM } from 'jsdom'
import { pipe } from 'fp-ts/function'
import { Option, isSome, some, none, match, fromNullable, toNullable, map, getOrElse, chain } from 'fp-ts/Option'
import _ from 'lodash'
import { Match, Team, League, Stream } from './domain'

const liquipedia = 'https://liquipedia.net'

const nullSafePrepend = (prepend: string, str: string | null | undefined) =>
  pipe(str, fromNullable, map((url:string) => `${prepend}${url}`))

function parseMatch(e: Element): Option<Match> {

  function parseTeam(e: Element) : Team {
    const teamElem = e.querySelector('.team-template-text')?.getElementsByTagName('a')?.item(0)
    const name = teamElem?.innerHTML
    const url = teamElem?.getAttribute('href')
    const teamLogoElem = pipe(
      e.querySelector('.team-template-image-icon')?.getElementsByTagName('a')?.item(0),
      fromNullable,
      getOrElse(() => e.querySelector('.team-template-image-legacy')?.getElementsByTagName('a')?.item(0)),
    )
    const fullname = teamLogoElem?.getAttribute('title')
    const logo = teamLogoElem?.getElementsByTagName('img')?.item(0)?.getAttribute('src')

    return {
      name: pipe(name, fromNullable, getOrElse(() => "TBD")),
      fullname: pipe(fullname, fromNullable, getOrElse(() => "TBD")),
      url: pipe(nullSafePrepend(liquipedia, url), toNullable),
      logoUrl: pipe(nullSafePrepend(liquipedia, logo), toNullable)
    }
  }

  function parseStartsAt(e: Element): Option<Date> {
    const unixTime = e.querySelector('.timer-object')?.getAttribute('data-timestamp')
    return pipe(unixTime, fromNullable, map((unix:string) => new Date(parseInt(unix) * 1000)))
  }

  function parseScore(e: Element): Option<string> {
    return pipe (
      e.firstElementChild?.innerHTML,
      fromNullable,
      match (
        () => e.innerHTML.replace('<b>', '').replace('</b>', '').trim(),
        (value:string) => {
          if (value === "vs" || value.includes(':'))
            return value.trim()
          else
            return e.innerHTML.replace('<b>', '').replace('</b>', '').trim()
        }
      ),
      fromNullable
    )
  }

  function parseBestOf(e: Element): Option<string> {
    return pipe (
      e.getElementsByTagName('abbr')?.item(0)?.innerHTML,
      fromNullable
    )
  }

  function parseStreams(e: Element): Stream[] {
    const timerElem = e.querySelector('.timer-object')
    const streams = timerElem
      ?.getAttributeNames()
      ?.filter(attr => attr.startsWith('data-stream-'))
      ?.map(attr => {
        const platform = attr.replace('data-stream-', '')
        const streamName = timerElem?.getAttribute(attr)
        const url = streamName
          ? `${liquipedia}/dota2/Special:Stream/${platform}/${streamName}`
          : null
        return {
          platform: platform,
          url: url
        }
      })
    return streams ? streams : []
  }

  function parseLeague(e: Element): League {
    const leagueElem = e.firstElementChild
    const name = leagueElem?.getAttribute('title')
    const url = leagueElem?.getAttribute('href')
    const logoUrl = leagueElem?.firstElementChild?.getAttribute('src')
    return {
      name: pipe(name, fromNullable, toNullable),
      url: pipe(nullSafePrepend(liquipedia, url), toNullable),
      logoUrl: pipe(nullSafePrepend(liquipedia, logoUrl), toNullable)
    }
  }

  const teamAElem = e.querySelector('.team-left')
  const teamBElem = e.querySelector('.team-right')
  const versusElem = e.querySelector('.versus')
  const countdownElem = e.querySelector('.match-countdown')
  const leagueElem = e.querySelector('.league-icon-small-image')

  const teamA = pipe(teamAElem, fromNullable, map(parseTeam))
  const teamB = pipe(teamBElem, fromNullable, map(parseTeam))

  if (isSome(teamA) && isSome(teamB)) {
    const countdown = pipe(countdownElem, fromNullable, chain(parseStartsAt), toNullable)
    const id = `${countdown?.getTime()}-${teamA.value.name?.trim()}-${teamB.value.name?.trim()}`
    return some({
      matchId: id,
      teamA: teamA.value,
      teamB: teamB.value,
      startsAt: countdown,
      score: pipe(versusElem, fromNullable, chain(parseScore), toNullable),
      bestOf: pipe(versusElem, fromNullable, chain(parseBestOf), toNullable),
      streams: pipe(countdownElem, fromNullable, map(parseStreams), getOrElse(() => [] as Stream[])),
      league: pipe(leagueElem, fromNullable, map(parseLeague), toNullable)
    })
  }
  else {
    return none
  }
}

export async function scrapeMatches() {
  const response = await axios({
    url: `${liquipedia}/dota2/Liquipedia:Upcoming_and_ongoing_matches`,
    method: 'get'
  })

  const fragment = JSDOM.fragment(response.data)
  const matchElements = fragment.querySelectorAll('.wikitable').values()

  const matches = Array.from(matchElements)
    .map(e => pipe(e.firstElementChild, fromNullable, chain(parseMatch), toNullable))
    .filter((x): x is Match => x !== null)
  const uniqueMatches = _.uniqBy(matches, 'matchId')
  const sortedUniqueMatches = _.sortBy(uniqueMatches, 'startsAt')
  return sortedUniqueMatches
}
