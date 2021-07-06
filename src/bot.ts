import TelegramBot, { SendMessageOptions } from "node-telegram-bot-api"
import { concluded, live, startsIn, team, Match } from './domain'
import { concludedMatchTemplate, matchTemplate, matchTemplateFull } from "./messageTemplate"
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

bot.setMyCommands([
    { command: 'live', description: 'Show live and briefly starting matches' },
    { command: 'next', description: 'Show the upcoming matches of a team of your choice' },
    { command: 'all', description: 'Show all upcoming matches' },
    { command: 'recent', description: 'Show recently concluded matches' },
    { command: 'subscribe', description: 'Subscribe to matches of a team of your choice' },
    { command: 'unsubscribe', description: 'Unsubscribe match notifications' },
    { command: 'subscriptions', description: 'Show your subscriptions' }
])

const messageOptions = (match: Match) : SendMessageOptions => {
    return { 
        parse_mode: "HTML", 
        disable_web_page_preview: true,
        reply_markup: { 
            inline_keyboard: [ match.streams.map(stream => { return { text: stream.platform, url: stream.url ?? 'url missing' } }) ] 
        }
    }
}

const browsingMessageEditOptions = (chatId: number, msgId: number, idx: number, max: number) : TelegramBot.EditMessageTextOptions => {
    let inlineKeyboard : TelegramBot.InlineKeyboardButton[][]
    if (idx === 0)
        inlineKeyboard = [ [ { text: '\tNext\t', callback_data: '1' } ] ]
    else if (idx === max)
        inlineKeyboard = [ [ { text: '\tPrevious\t', callback_data: (idx - 1).toString() } ] ]
    else
        inlineKeyboard = [ [ { text: '\tPrevious\t', callback_data: (idx - 1).toString() }, { text: '\tNext\t', callback_data: (idx + 1).toString() } ] ]

    return { 
        parse_mode: "HTML", 
        disable_web_page_preview: true,
        chat_id: chatId,
        message_id: msgId,
        reply_markup: { 
            inline_keyboard: inlineKeyboard
        }
    }
}

bot.onText(/\/all/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    bot.sendChatAction(chatId, 'typing')
    const matches = await scrapeMatches()
    const filtered = matches.filter(m => !concluded(m))
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No upcoming matches at this time...')
    else {
        const sentMsg = await bot.sendMessage(
            chatId, 
            matchTemplateFull(filtered[0]),
            { 
                parse_mode: "HTML", 
                disable_web_page_preview: true,
                reply_markup: { 
                    inline_keyboard: [ [ { text: 'Next', callback_data: '1' } ] ]
                }
            })
        bot.on('callback_query', async (callbackQuery) => {
            const text = callbackQuery.data
            if (text) {
                const idx = parseInt(text)
                bot.editMessageText(
                    matchTemplateFull(filtered[idx]), 
                    browsingMessageEditOptions(chatId, sentMsg.message_id, idx, filtered.length - 1))
            }
        })
    }
})

bot.onText(/\/live/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    bot.sendChatAction(chatId, 'typing')
    const matches = await scrapeMatches()
    const filtered = matches.filter(m => live(m) || startsIn(m, 15))
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No live matches at this time...')
    else
        for (const match of filtered) {
            await bot.sendMessage(chatId, matchTemplate(match), messageOptions(match))
        }
})

bot.onText(/\/chatid/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, chatId.toString())
})

bot.onText(/\/recent/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    bot.sendChatAction(chatId, 'typing')
    const matches = await scrapeMatches()
    const filtered = matches.filter(m => concluded(m)).reverse()
    if (filtered.length === 0)
        await bot.sendMessage(chatId, 'No recently finished matches at this time...')
    else {
        const sentMsg = await bot.sendMessage(
            chatId, 
            concludedMatchTemplate(filtered[0]),
            { 
                parse_mode: "HTML", 
                disable_web_page_preview: true,
                reply_markup: { 
                    inline_keyboard: [ [ { text: 'Next', callback_data: '1' } ] ]
                }
            })
        bot.on('callback_query', async (callbackQuery) => {
            const text = callbackQuery.data
            if (text) {
                const idx = parseInt(text)
                bot.editMessageText(
                    concludedMatchTemplate(filtered[idx]), 
                    browsingMessageEditOptions(chatId, sentMsg.message_id, idx, filtered.length - 1))
            }
        })
    }
})

bot.onText(/\/next/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const sentMsg = await bot.sendMessage(
        chatId, 
        "Please specify the team", 
        { reply_markup: { force_reply: true } }
    )
    const listenerId = bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
        try {
            bot.sendChatAction(chatId, 'typing')
            const text = msg.text
            if (text) {
                const matches = await scrapeMatches()
                const filtered = matches.filter(m => !concluded(m) && team(m, text))
                if (filtered.length === 0)
                    await bot.sendMessage(chatId, `No upcoming matches for ${text}.`)
                else {
                    for (const match of filtered) {
                        await bot.sendMessage(chatId, matchTemplate(match), messageOptions(match))
                    }
                }
            }
        }
        finally {
            bot.removeReplyListener(listenerId)
        }
    })
})

const whitelisted = async (db: { query: (text: string, params?: any) => Promise<QueryResult<any>> }, chatId: number) => {
    const result = await db.query('SELECT chat_id FROM whitelist WHERE chat_id=$1', [chatId])
    return (result.rowCount && result.rowCount >= 0)
}

bot.onText(/\/subscribe/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const onWhitelist = await whitelisted(db, chatId)
    if (onWhitelist) {
        const sentMsg = await bot.sendMessage(
            chatId, 
            "Which team would you like to subscribe to?", 
            { reply_markup: { force_reply: true } }
        )
        const listenerId = bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
            try {
                const text = msg.text
                if (text) {
                    const result = await db.query('SELECT team FROM subscription WHERE chat_id=$1 AND team=LOWER($2)', [ chatId, text ])
                    if (result.rowCount === 0) {
                        await db.query('INSERT INTO subscription (chat_id, team) VALUES ($1, LOWER($2))', [ chatId, text ])
                        await bot.sendMessage(chatId, `${text} is now subscribed!`)
                    } else {
                        await bot.sendMessage(chatId, `Let's not get carried away and subscribe twice to ${text}!`)
                    }
                }
            }
            finally {
                bot.removeReplyListener(listenerId)
            }
        })
    }
})

bot.onText(/\/unsubscribe/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    const onWhitelist = await whitelisted(db, chatId)
    if (onWhitelist) {
        const result = await db.query('SELECT team FROM subscription WHERE chat_id=$1', [ chatId ])
        await bot.sendMessage(
            chatId, 
            "Which team do you not like anymore?", 
            { 
                reply_markup: 
                    { inline_keyboard: result.rows.map(row => [ { text: row.team , callback_data: row.team } ]) } 
            }
        )
        bot.on('callback_query', async (callbackQuery) => {
            const text = callbackQuery.data
            if (text) {
                await db.query('DELETE FROM subscription WHERE chat_id=$1 AND team=LOWER($2)', [ chatId, text ])
                await bot.answerCallbackQuery(callbackQuery.id, { text: `I'm sure ${text} is sad to see you go...` })
            }
        })
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
    await bot.sendMessage(chatId, matchTemplate(match), messageOptions(match))
}

export default bot