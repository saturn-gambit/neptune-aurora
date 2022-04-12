import fs from 'fs'
import crypto from 'crypto'
import jsonwebtoken from 'jsonwebtoken'
import pg from 'pg'
import chalk from 'chalk'

export function get_jti () {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(48, (e, b) => {
      if (e) {
        reject(e)
      } else {
        const token = b.toString('hex')
        resolve(token)
      }
    })
  })
}

export function make_exp () {
  const date = new Date()
  const epoch = date.getTime() / 1000.0
  const epoch_time = Math.floor(epoch) + 100
  return epoch_time
}

export function get_key_pair (private_key_path, public_key_path) {
  const private_key = fs.readFileSync(private_key_path, 'utf8')
  const public_key = fs.readFileSync(public_key_path, 'utf8')
  return [private_key, public_key]
}

export async function get_jwt (private_key, payload) {
  const algorithm = 'RS256'
  const config = { algorithm }
  const jwt = await jsonwebtoken.sign(payload, private_key, config)
  return jwt
}

export async function verify_jwt (jwt, public_key) {
  const algorithms = ['RS256']
  const config = { algorithms }
  const verification = await jsonwebtoken.verify(jwt, public_key, config)
  return verification
}

export class Store {

  constructor (database_url) {
    this.pg_client = null
    this.init_db(database_url)
  }

  async init_db (database_url) {
    try {
      const pg_client_config = {
        connectionString: database_url,
        ssl: {
          rejectUnauthorized: false
        }
      }
      const pg_client = new pg.Client(pg_client_config)
      await pg_client.connect()
      const confirmation = await this.confirm_db_connection(pg_client)
      if (confirmation && confirmation.rows.length > 0) {
        console.log(`Connected to db...`)
        this.pg_client = pg_client
      }
    } catch (pg_client_connect_error) {
      console.error(pg_client_connect_error)
    }
  }
  
  async confirm_db_connection (pg_client) {
    try {
      const query = `select now()`
      const query_params = []
      const query_result = await pg_client.query(query, query_params)
      return Promise.resolve(query_result)
    } catch (confirm_db_connection_error) {
      console.error(confirm_db_connection_error)
      return Promise.reject(confirm_db_connection_error)
    }
  }

  query (..._args) {
    return this.pg_client.query(..._args)
  }

}
