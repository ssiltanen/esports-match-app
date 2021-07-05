import * as dotenv from 'dotenv'
dotenv.config()

import express, { Request, Response, json } from 'express'
import { scrapeMatches } from './scrape'
import { sendSubscriptionEvent } from './bot'
import bot from './bot'
import db from './db'
import { team, startsIn } from './domain'

const { BOT_TOKEN, PORT } = process.env
if (!BOT_TOKEN) throw new Error('"BOT_TOKEN" env var is required!')
if (!PORT) throw new Error('"PORT" env var is required!')

const app = express()

app.use(json())

app.post('/bot/' + BOT_TOKEN, function (req, res) {
    bot.processUpdate(req.body)
    res.sendStatus(200)
})

app.get('/sub', async (_req: Request, res: Response) => {
    const matches = await scrapeMatches()
    const subs = await db.query('SELECT chat_id, team FROM subscription')
    subs.rows.forEach(async (sub) => { 
        const match = matches.find(m => team(m, sub.team) && startsIn(m, 30))
        if (match) await sendSubscriptionEvent(bot, sub.chat_id, match)
    })
    res.send()
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