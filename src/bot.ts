import TelegramBot from "node-telegram-bot-api"
import { concluded, live, startsIn, team, Match } from './domain'
import { concludedMatchTemplate, matchTemplate } from "./messageTemplate"
import { scrapeMatches } from "./scrape"
import db from './db'
import { QueryResult } from "pg"

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

bot.onText(/\/all/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const matches = await scrapeMatches()
    const filtered = matches.filter(m => !concluded(m))
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No upcoming matches at this time...')
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
    const filtered = matches.filter(m => live(m) || startsIn(m, 15))
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No live matches at this time...')
    else
        for (const match of filtered) {
            await bot.sendMessage(
                chatId, 
                matchTemplate(match), 
                { parse_mode: "HTML", disable_web_page_preview: true }
            )
        }
})

bot.onText(/\/chatid/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, chatId.toString())
})

bot.onText(/\/recent/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const matches = await scrapeMatches()
    const filtered = matches.filter(m => concluded(m))
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No recently finished matches at this time...')
    else
        for (const match of filtered) {
            await bot.sendMessage(
                chatId, 
                concludedMatchTemplate(match), 
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

const whitelisted = async (db: { query: (text: string, params?: any) => Promise<QueryResult<any>> }, chatId: number) => {
    const result = await db.query('SELECT chat_id FROM whitelist WHERE chat_id=$1', [chatId])
    return (result.rowCount && result.rowCount >= 0)
}

bot.onText(/\/subscribe (.+)/, async (msg: TelegramBot.Message, regMatch: RegExpExecArray | null) => {
    const chatId = msg.chat.id
    if (regMatch === null)
        await bot.sendMessage(chatId, 'Error')
    else {
        const onWhitelist = await whitelisted(db, chatId)
        if (onWhitelist) {
            const team = regMatch[1]
            await db.query('INSERT INTO subscription (chat_id, team) VALUES ($1, LOWER($2))', [ chatId, team ])
            await bot.sendMessage(chatId, `Subscribed to ${team}`)
        }
    }
})

bot.onText(/\/unsubscribe (.+)/, async (msg: TelegramBot.Message, regMatch: RegExpExecArray | null) => {
    const chatId = msg.chat.id
    if (regMatch === null)
        await bot.sendMessage(chatId, 'Error')
    else {
        const onWhitelist = await whitelisted(db, chatId)
        if (onWhitelist) {
            const team = regMatch[1]
            await db.query('DELETE FROM subscription WHERE chat_id=$1 AND team=LOWER($2)', [ chatId, team ])
            await bot.sendMessage(chatId, `Unsubscribed from ${team}`)
        }
    }
})

bot.onText(/\/subscriptions/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const onWhitelist = await whitelisted(db, chatId)
    if (onWhitelist) {
        const result = await db.query('SELECT team FROM subscription WHERE chat_id=$1', [ chatId ])
        if (!result.rowCount || result.rowCount === 0)
            await bot.sendMessage(chatId, "No active subscriptions at this time...")
        else
            await bot.sendMessage(chatId, result.rows.map(row => row.team).join('\n'))
    }
})

export const sendSubscriptionEvent = async (bot: TelegramBot, chatId: number, match: Match) => {
    await bot.sendMessage(
        chatId, 
        matchTemplate(match), 
        { parse_mode: "HTML", disable_web_page_preview: true }
    )
}

export default bot