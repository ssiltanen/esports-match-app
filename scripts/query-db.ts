import fs from 'fs'
import * as dotenv from 'dotenv'
dotenv.config()

import db from '../src/db'

const query = async (sql: string) => {
  const result = await db.query(sql)
  console.log(JSON.stringify(result.rows, undefined, 2))
  return result as unknown
}

const runScript = async () => {
  const data = fs.readFileSync('scripts/local-db-query.sql', 'utf8')
  await query(data)
  process.exit()
}

runScript()