import express, { Request, Response } from 'express'
import * as dotenv from 'dotenv'
import { scrapeMatches } from './scrape'
import { Telegraf, Context } from 'telegraf'
import { Update } from 'typegram'

dotenv.config()

const { BOT_TOKEN, APP_URL, PORT } = process.env
if (!BOT_TOKEN) throw new Error('"BOT_TOKEN" env var is required!')
if (!APP_URL) throw new Error('"APP_URL" env var is required!')
if (!PORT) throw new Error('"PORT" env var is required!')

const bot = new Telegraf(BOT_TOKEN)

// Set the bot response
bot.on('text', (ctx) => ctx.replyWithHTML('<b>Hello</b>'))

const secretPath = `tg/${BOT_TOKEN}`
bot.telegram.setWebhook(`${APP_URL}/${secretPath}`)

const app = express()

app.get('/', (_req: Request, res: Response) => res.send('Hello world!'))

app.post(`/tg/${BOT_TOKEN}`, (req: Request, res: Response) => {
    bot.handleUpdate(req.body)
    res.send().status(200)
})

app.get('/matches', async (_req: Request, res: Response) => {
    const matches = await scrapeMatches()
    res.send(matches)
})

// Used by heroku to rollback deployment if not ok
app.get('/health', (_req: Request, res: Response) => res.send('Ok'))

app.use(bot.webhookCallback(secretPath))

app.listen(PORT, () => {
    console.log(`The application is listening on port ${PORT}!`);
})