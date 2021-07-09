import TelegramBot, { SendMessageOptions } from 'node-telegram-bot-api'
import { concluded, live, startsIn, team, Match } from './domain'
import { concludedMatchTemplate, matchTemplate, matchTemplateWithStreams } from './messageTemplate'
import { scrapeMatches } from './scrape'
import db from './db'
var memoize = require("memoizee")

// Memoize needs a parameter to work so let's wrap our function with unnecessary parameter for it
const memoizedMatchScrape = memoize(
  (i:any) => scrapeMatches(), 
  { maxAge: 3 * 60 * 1000 }
)

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

const browsingMessageEditOptions = (chatId: number, msgId: number, event: string, idx: number, max: number) : TelegramBot.EditMessageTextOptions => {
  let inlineKeyboard : TelegramBot.InlineKeyboardButton[][]
  if (idx === 0)
    inlineKeyboard = [ [ { text: '\tNext\t', callback_data: `${event}:1` } ] ]
  else if (idx === max)
    inlineKeyboard = [ [ { text: '\tPrevious\t', callback_data: `${event}:${idx - 1}` } ] ]
  else
    inlineKeyboard = [ [ 
      { text: '\tPrevious\t', callback_data: `${event}:${idx - 1}` }, 
      { text: '\tNext\t', callback_data: `${event}:${idx + 1}` } ] ]

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
  const matches : Match[] = await memoizedMatchScrape(1)
  const filtered = matches.filter(m => !concluded(m))
  if (filtered.length === 0)
    await bot.sendMessage(chatId, 'No upcoming matches at this time...')
  else {
    await bot.sendMessage(
      chatId, 
      matchTemplateWithStreams(filtered[0]),
      { 
        parse_mode: "HTML", 
        disable_web_page_preview: true,
        reply_markup: { 
          inline_keyboard: [ [ { text: 'Next', callback_data: 'all:1' } ] ]
        }
      })
  }
})

bot.onText(/\/live/, async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id
  bot.sendChatAction(chatId, 'typing')
  const matches : Match[] = await memoizedMatchScrape(1)
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
  const matches : Match[] = await memoizedMatchScrape(1)
  const filtered = matches.filter(m => concluded(m)).reverse()
  if (filtered.length === 0)
    await bot.sendMessage(chatId, 'No recently finished matches at this time...')
  else {
    await bot.sendMessage(
      chatId, 
      concludedMatchTemplate(filtered[0]),
      { 
        parse_mode: "HTML", 
        disable_web_page_preview: true,
        reply_markup: { 
          inline_keyboard: [ [ { text: 'Next', callback_data: 'recent:1' } ] ]
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
        const matches : Match[] = await memoizedMatchScrape(1)
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

bot.onText(/\/subscribe/, async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id
  const whiteListed = await db.isWhiteListed(chatId)
  if (whiteListed) {
    const sentMsg = await bot.sendMessage(
      chatId, 
      "Which team would you like to subscribe to?", 
      { reply_markup: { force_reply: true } }
    )
    const listenerId = bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
      try {
        const text = msg.text
        if (text) {
          const subscribed = await db.isTeamSubscribed(chatId, text)
          if (!subscribed) {
            await db.insertSubscription(chatId, text)
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
  const whiteListed = await db.isWhiteListed(chatId)
  if (whiteListed) {
    const subscriptions = await db.subscriptions(chatId)
    if (subscriptions.length === 0)
      await bot.sendMessage(chatId, "No active subscriptions at this time...")
    else {
      await bot.sendMessage(
        chatId, 
        "Which team do you not like anymore?", 
        { 
          reply_markup: 
            { inline_keyboard: subscriptions.map(row => [ { text: row.team , callback_data: `unsubscribe:${row.team}` } ]) } 
        }
      )
    }
  }
})

bot.onText(/\/subscriptions/, async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id
  const whiteListed = await db.isWhiteListed(chatId)
  if (whiteListed) {
    const subscriptions = await db.subscriptions(chatId)
    if (subscriptions.length === 0)
      await bot.sendMessage(chatId, "No active subscriptions at this time...")
    else
      await bot.sendMessage(chatId, subscriptions.map(row => row.team).join('\n'))
  }
})

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id
  const msgId = callbackQuery.message?.message_id
  const data = callbackQuery.data
  if (chatId && msgId && data) {
    const [ event, eventData ] = data.split(':')
    if (event === 'all' || event === 'recent') {
      const matches : Match[] = await memoizedMatchScrape(1)
      const idx = parseInt(eventData)
      let filtered: Match[]
      let content: string
      if (event === 'all') {
        filtered = matches.filter(m => !concluded(m))
        content = matchTemplateWithStreams(filtered[idx])
      }
      else {
        filtered = matches.filter(m => concluded(m)).reverse()
        content = concludedMatchTemplate(filtered[idx])
      }
      bot.editMessageText(
        content, 
        browsingMessageEditOptions(chatId, msgId, event, idx, filtered.length - 1))
    }
    else if (event === 'unsubscribe') {
      await db.deleteSubscription(chatId, eventData)
      await bot.answerCallbackQuery(callbackQuery.id, { text: `I'm sure ${eventData} is sad to see you go...` })
    }
    else
      console.log(`Unknown event type in callback_query: ${event}`)
  }
})

export const sendSubscriptionEvent = async (bot: TelegramBot, chatId: number, match: Match) => {
  await bot.sendMessage(chatId, matchTemplate(match), messageOptions(match))
}

export default bot