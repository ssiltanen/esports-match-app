import * as dotenv from 'dotenv'
dotenv.config()

import express, { Request, Response, json } from 'express'
import _ from 'lodash'
import { scrapeMatches } from './scrape'
import { sendSubscriptionEvent } from './bot'
import bot from './bot'
import db from './db'
import { team, startsIn } from './domain'
import { sendToSlack } from './slack'
import { resolve } from 'path'

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
  const upcomingMatches = matches.filter(m => startsIn(m, 35))
  const subsciptions = await db.allSubscriptions()
  const chatSubscriptions = _.groupBy(subsciptions, 'chat_id')

  // Handle one telegram chat_id at a time
  for (const chat_id in chatSubscriptions) {
    const subscribedMatches = chatSubscriptions[chat_id]
      .map(sub => upcomingMatches.find(m => team(m, sub.team)))
      .filter(match => match)

    if (subscribedMatches.length > 0) {
      await bot.sendMessage(chat_id, 'Hey, your team is playing soon!')
      const unique = _.uniqBy(subscribedMatches, 'matchId')
      _.orderBy(unique, 'startsAt', 'asc')
        .forEach(async match => match && await sendSubscriptionEvent(bot, parseInt(chat_id), match))
    }
  }

  // Handle slack notifications
  const slackSubscriptions = await db.slackSubscriptions()
  const upcomingSlackSubscriptions = slackSubscriptions 
    .map(sub => upcomingMatches.find(m => team(m, sub.team)))

  const unique = _.uniqBy(upcomingSlackSubscriptions, 'matchId')
  _.orderBy(unique, 'startsAt', 'asc')
    .forEach(async match => {
      match && await sendToSlack(match)
      // Slack workflows have request per second rate limit
      await new Promise(r => setTimeout(r, 1200))
    })

  res.send()
})

// Used by heroku to rollback deployment if not ok
app.get('/health', (_req: Request, res: Response) => res.send('Ok'))

app.listen(PORT, () => {
  console.log(`The application is listening on port ${PORT}!`);
})