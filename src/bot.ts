import * as dotenv from 'dotenv'
import TelegramBot from "node-telegram-bot-api"
import { concluded, live, startsIn, team } from './domain'
import { concludedMatchTemplate, matchTemplate } from "./messageTemplate"
import { scrapeMatches } from "./scrape"

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
    const filtered = matches.filter(m => live(m) || startsIn(m, 15))
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

export default bot