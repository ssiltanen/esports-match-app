import { Pool, QueryResult } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('"DATABASE_URL" env var is required!')
const pool = new Pool({ connectionString: DATABASE_URL })

export interface Subscription {
  chat_id: number
  team: string
}

export interface SlackSubscription {
  team: string
}

export interface Whitelist {
  chat_id: number
}

export default {

  query: (sql: string, params?: any[]) => {
    return pool.query(sql, params)
  },

  isWhiteListed: async (chatId: number) => {
    const result: QueryResult<Whitelist> = await pool.query(
      'SELECT chat_id FROM whitelist WHERE chat_id=$1', 
      [chatId])
    return result.rowCount >= 0
  },

  isAdmin: async (chatId: number) => {
    const result: QueryResult<Whitelist> = await pool.query(
      'SELECT is_admin FROM whitelist WHERE chat_id=$1', 
      [chatId])
    return result.rowCount >= 0
  },

  isTeamSubscribed: async (chatId: number, team: string) => {
    const result: QueryResult<Subscription> = await pool.query(
      'SELECT team FROM subscription WHERE chat_id=$1 AND team=LOWER($2)',
      [ chatId, team ])
    return result.rowCount > 0
  },

  subscriptions: async (chatId: number) => {
    const result: QueryResult<Subscription> = await pool.query(
      'SELECT chat_id, team FROM subscription WHERE chat_id=$1 ORDER BY chat_id',
      [ chatId ])
    return result.rows
  },

  allSubscriptions: async () => {
    const result: QueryResult<Subscription> = await pool.query(
      'SELECT chat_id, team FROM subscription ORDER BY chat_id')
    return result.rows
  },

  insertSubscription: async (chatId: number, team: string) => {
    await pool.query(
      'INSERT INTO subscription (chat_id, team) VALUES ($1, LOWER($2))',
      [ chatId, team ])
  },

  deleteSubscription: async (chatId: number, team: string) => {
    await pool.query(
      'DELETE FROM subscription WHERE chat_id=$1 AND team=LOWER($2)',
      [ chatId, team ])
  },

  slackSubscriptions: async () => {
    const {rows} = await pool.query<SlackSubscription>('SELECT team FROM slack_subscription')
    return rows
  },

  insertSlackSubscription: async (team: string) => {
    await pool.query(
      'INSERT INTO slack_subscription (team) VALUES ($1)',
      [ team ])
  },

  deleteSlackSubscription: async (team: string) => {
    await pool.query('DELETE FROM slack_subscription WHERE team = LOWER($1)', [ team ])
  },

  isTeamSlackSubscribed: async (team: string) => {
    const result: QueryResult<Subscription> = await pool.query(
      'SELECT team FROM slack_subscription WHERE team = LOWER($1)',
      [ team ])
    return result.rowCount > 0
  },
}