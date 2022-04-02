console.clear() 

import dotenv from 'dotenv'
import chalk from 'chalk'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import pg from 'pg'
import * as lib from './lib.js'

dotenv.config()

const {
  npm_package_version,
  PORT,
  PRIVATE_KEY_PATH,
  PUBLIC_KEY_PATH,
  PRIVATE_KEY,
  PUBLIC_KEY,
  DATABASE_URL
} = process.env

const {
  get_jti,
  make_exp,
  get_key_pair,
  get_jwt,
  verify_jwt
} = lib

async function verify_jwt_middleware (request, response, next) {
  try {
    const authorization = request.headers[`authorization`]
    const [scheme, jwt] = authorization.split(' ')
    const [private_key, public_key] = (PRIVATE_KEY && PUBLIC_KEY) ? [PRIVATE_KEY, PUBLIC_KEY] : get_key_pair(PRIVATE_KEY_PATH, PUBLIC_KEY_PATH)
    const verification = await verify_jwt(jwt, public_key)
    request.verification = verification
    next()
  } catch (error) {
    console.error(error)
    response.sendStatus(400)
  }
}

// Database -------------------------------------------------------------------------------------------

init_db(DATABASE_URL)

async function init_db (database_url) {
  try {
    const pg_client_config = {
      connectionString: database_url,
      ssl: {
        rejectUnauthorized: false
      }
    }
    const pg_client = new pg.Client(pg_client_config)
    await pg_client.connect()
    const confirmation = await confirm_db_connection(pg_client)
    if (confirmation && confirmation.rows.length > 0) {
      console.log(`Connected to db...`)
    }
  } catch (pg_client_connect_error) {
    console.error(pg_client_connect_error)
  }
}

async function confirm_db_connection (pg_client) {
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

// App -------------------------------------------------------------------------------------------

const app = express()
app.use(morgan('tiny'))
app.use(cors({ origin: '*' }))
app.use((req, res, next) => {
  res.set('X-Neptune-Aurora-API-Version', `v${npm_package_version}`)
  next()
})
app.listen(PORT || 12000, () => {
  console.log(`Listening on ${PORT || 12000}..`)
})

app.get('/api/v2/jwt', async (request, response) => {
  try {
    const jti = await get_jti()
    const exp = make_exp()
    const payload = {
      jti,
      exp
    }
    const [private_key, public_key] = (PRIVATE_KEY && PUBLIC_KEY) ? [PRIVATE_KEY, PUBLIC_KEY] : get_key_pair(PRIVATE_KEY_PATH, PUBLIC_KEY_PATH)
    const jwt = await get_jwt(private_key, payload)
    const verification = await verify_jwt(jwt, public_key)
    response.send(jwt)
  } catch (error) {
    console.error(error)
    response.sendStatus(500)
  }
})

app.get('/api/v2/eg-resource', verify_jwt_middleware, async (request, response) => {
  response.json([{
    id: 0,
    message: `hi`
  }])
})