import * as dotenv from 'dotenv'
dotenv.config()

import express, { Request, Response, json } from 'express'
import _ from 'lodash'
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

app.get('/', async (_req: Request, res: Response) => {
  const matches = await scrapeMatches()
  const subsciptions = await db.allSubscriptions()
  const grouped = _.groupBy(subsciptions, 'chat_id')

  // Handle one chat_id at a time
  for (const chat_id in grouped) {
    const subscribedMatches = grouped[chat_id]
      .map(sub => matches.find(m => team(m, sub.team) && startsIn(m, 35)))
      .filter(match => match)

    const unique = _.uniqBy(subscribedMatches, 'matchId')
    if (unique.length > 0) {
      bot.sendMessage(chat_id, ':rotating_light: Hey, your team is playing soon!')
      _.orderBy(unique, 'startsAt', 'asc')
        .forEach(async match => {
          if (match) await sendSubscriptionEvent(bot, parseInt(chat_id), match)
        })
    }
  }
  res.send()
})

// Used by heroku to rollback deployment if not ok
app.get('/health', (_req: Request, res: Response) => res.send('Ok'))

app.listen(PORT, () => {
  console.log(`The application is listening on port ${PORT}!`);
})