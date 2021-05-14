import express, { Request, Response, json } from 'express'
import * as dotenv from 'dotenv'
import { scrapeMatches } from './scrape'
import TelegramBot from 'node-telegram-bot-api'

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

bot.onText(/\/echo (.+)/, (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    const chatId = msg.chat.id
    const resp = match ? match[1] : "error"
    bot.sendMessage(chatId, resp);
  })
  
bot.on('text', (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id
    bot.sendMessage(chatId, 'Received your message')
})


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