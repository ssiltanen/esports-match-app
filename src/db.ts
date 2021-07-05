import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('"DATABASE_URL" env var is required!')
const pool = new Pool({ connectionString: DATABASE_URL })

export default {
  query: (text: string, params?: any) => {
    return pool.query(text, params)
  }
}