import express, { Request, Response, json } from 'express'
import * as dotenv from 'dotenv'
import { scrapeMatches } from './scrape'
import bot from './bot'

dotenv.config()
const { BOT_TOKEN, PORT } = process.env
if (!BOT_TOKEN) throw new Error('"BOT_TOKEN" env var is required!')
if (!PORT) throw new Error('"PORT" env var is required!')

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