import express, { Request, Response, json } from 'express'
import * as dotenv from 'dotenv'
import { scrapeMatches } from './scrape'
import TelegramBot from 'node-telegram-bot-api'
import e from 'express'
import _ from 'lodash'
import { Match } from './domain'

dotenv.config()

const { BOT_TOKEN, APP_URL, PORT } = process.env
if (!BOT_TOKEN) throw new Error('"BOT_TOKEN" env var is required!')
if (!APP_URL) throw new Error('"APP_URL" env var is required!')
if (!PORT) throw new Error('"PORT" env var is required!')

let bot: TelegramBot
if (process.env.NODE_ENV === 'production') {
    bot = new TelegramBot(BOT_TOKEN)
    bot.setWebHook(`${APP_URL}/bot/${BOT_TOKEN}`)
 } else {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
 }

const MINUTE = 60 * 1000; /* ms */
function nullSafeDatesDifferLessThan(a: Date | null, b: Date | null, amount: number) {
    if (a && b) {
        const diff = a.getTime() - b.getTime()
        return Math.abs(diff) < amount
    }
    else
        return false
}
const startTimeInPast = (match: Match) => match.startsAt !== null && match.startsAt < new Date()
const concluded = (match: Match) => match.bestOf === null && startTimeInPast(match)
const live = (match: Match) => match.bestOf !== null && startTimeInPast(match)
const startsIn = (match: Match, minutes: number) => !startTimeInPast(match) && nullSafeDatesDifferLessThan(match.startsAt, new Date(), minutes)
const team = (match: Match, name: string) => {
    const compare = (a:string, b:string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0
    return (match.teamA.name !== null && compare(match.teamA.name, name))
        || (match.teamA.fullname !== null && compare(match.teamA.fullname, name))
        || (match.teamB.name !== null && compare(match.teamB.name, name))
        || (match.teamB.fullname !== null && compare(match.teamB.fullname, name))
}

function matchTemplate(match: Match) {
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

function finishedMatchTemplate(match: Match) {
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

bot.onText(/\/all/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const matches = await scrapeMatches()
    const filtered = matches.filter(m => !concluded(m))
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No upcoming matches at this time..')
    else
        for (const match of filtered) {
            await bot.sendMessage(
                chatId, 
                matchTemplate(match), 
                { parse_mode: "HTML", disable_web_page_preview: true }
            )
        }
})

bot.onText(/\/live/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const matches = await scrapeMatches()
    const filtered = matches.filter(m => live(m) || startsIn(m, 15 * MINUTE))
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No live matches at this time..')
    else
        for (const match of filtered) {
            await bot.sendMessage(
                chatId, 
                matchTemplate(match), 
                { parse_mode: "HTML", disable_web_page_preview: true }
            )
        }
})

bot.onText(/\/recent/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const matches = await scrapeMatches()
    const filtered = matches.filter(m => concluded(m))
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No recently finished matches at this time..')
    else
        for (const match of filtered) {
            await bot.sendMessage(
                chatId, 
                finishedMatchTemplate(match), 
                { parse_mode: "HTML", disable_web_page_preview: true }
            )
        }
})

bot.onText(/\/next (.+)/, async (msg: TelegramBot.Message, regMatch: RegExpExecArray | null) => {
    const chatId = msg.chat.id
    if (regMatch === null)
        await bot.sendMessage(chatId, 'Error')
    else {
        const matches = await scrapeMatches()
        const filtered = matches.filter(m => !concluded(m) && team(m, regMatch[1]))
        if (filtered.length === 0)
            await bot.sendMessage(chatId, `No upcoming matches for ${regMatch[1]}.`)
        else
            for (const match of filtered) {
                await bot.sendMessage(
                    chatId, 
                    matchTemplate(match), 
                    { parse_mode: "HTML", disable_web_page_preview: true }
                )
            }
    }
})

// bot.on('text', (msg: TelegramBot.Message) => {
//     const chatId = msg.chat.id
//     bot.sendMessage(chatId, 'Received your message')
// })


const app = express()

app.use(json())

app.get('/', (_req: Request, res: Response) => res.send('Hello world!'))

app.post('/bot/' + BOT_TOKEN, function (req, res) {
    bot.processUpdate(req.body)
    res.sendStatus(200)
})

app.get('/matches', async (_req: Request, res: Response) => {
    const matches = await scrapeMatches()
    res.send(matches)
})

// Used by heroku to rollback deployment if not ok
app.get('/health', (_req: Request, res: Response) => res.send('Ok'))

app.listen(PORT, () => {
    console.log(`The application is listening on port ${PORT}!`);
})