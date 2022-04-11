console.clear() 

import fs from 'fs'
import dotenv from 'dotenv'
import chalk from 'chalk'
import express from 'express'
import passport from 'passport'
import cookie_parser from 'cookie-parser'
import * as passport_local from 'passport-local'
import * as passport_jwt from 'passport-jwt'
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
  DATABASE_URL,
  JWT_EXPIRATION_MS
} = process.env

const {
  get_jti,
  make_exp,
  get_key_pair,
  get_jwt,
  verify_jwt
} = lib

const {
  Strategy: PassportLocalStrategy
} = passport_local
const {
  Strategy: PassportJWTStrategy
} = passport_jwt

// Helpers -------------------------------------------------------------------------------------------

function get_keys () {
  return (PRIVATE_KEY && PUBLIC_KEY) ? [PRIVATE_KEY, PUBLIC_KEY] : get_key_pair(PRIVATE_KEY_PATH, PUBLIC_KEY_PATH)
}

async function verify_jwt_middleware (request, response, next) {
  try {
    const authorization = request.headers[`authorization`]
    const [scheme, jwt] = authorization.split(' ')
    const [private_key, public_key] = get_keys()
    const verification = await verify_jwt(jwt, public_key)
    request.verification = verification
    next()
  } catch (error) {
    console.error(error)
    response.sendStatus(400)
  }
}

const passport_local_strategy_config = {
  usernameField: 'username',
  passwordField: 'password',
  session: false
}

async function passport_local_strategy_handler (username, password, callback) {
  // query store for user
  callback(null, { id: `0x0000`, name: `zero`})
}

const passport_jwt_strategy_config = {
  jwtFromRequest: request => {
    console.log(request.cookies)
    return request.cookies.jwt
  },
  secretOrKey: get_keys()[0]
}

async function passport_jwt_strategy_handler (jwt_payload, callback) {
  if (Date.now() > jwt_payload.expires) {
    return callback('jwt expired')
  } else {
    return callback(null, jwt_payload)
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

passport.use(new PassportLocalStrategy(passport_local_strategy_config, passport_local_strategy_handler))
passport.use(new PassportJWTStrategy(passport_jwt_strategy_config, passport_jwt_strategy_handler))

const app = express()
app.use(morgan('tiny'))
app.use(cors({ origin: '*' }))
app.use(express.json())
app.use(cookie_parser())
app.use((req, res, next) => {
  res.set('X-Neptune-Aurora-API-Version', `v${npm_package_version}`)
  next()
})
app.engine('ntl', (file_path, options, callback) => {
  fs.readFile(file_path, (error, content) => {
    if (error) return callback(error)
    const view = content.toString()
    const reg_exp = new RegExp('{{npm_package_version}}')
    const rendered = view.replace(reg_exp, `${options.npm_package_version}`)
    return callback(null, rendered)
  })
})
app.set('views', './src/views')
app.set('view engine', 'ntl')
app.use(passport.initialize())
app.listen(PORT || 12000, () => {
  console.log(`Listening on ${PORT || 12000}..`)
})

app.get('/', async (request, response) => {
  response.render('index', { npm_package_version })
})

// v3

app.post('/api/v3/authenticate', passport.authenticate('local', { session: false }), async (request, response) => {
  console.log(request.body, request.user)
  const username = `0x0000`
  const payload = {
    username,
    expires: Date.now() + parseInt(JWT_EXPIRATION_MS)
  }
  try {
    const [private_key, public_key] = get_keys()
    const jwt = await get_jwt(private_key, payload)
    const verification = await verify_jwt(jwt, public_key)
    console.log(verification)
    response.cookie('jwt', jwt, { httpOnly: true, secure: true })
    response.status(200).send({ username })
  } catch (jwt_signing_error) {
    console.error(jwt_signing_error)
    response.status(400).send({ error: jwt_signing_error })
  }
})

app.get('/api/v3/eg-resource', passport.authenticate('jwt', { session: false }), async (request, response) => {
  response.json([{
    id: 1,
    message: `hi`
  }])
})

// v2

app.get('/api/v2/jwt', async (request, response) => {
  try {
    const jti = await get_jti()
    const exp = make_exp()
    const payload = {
      jti,
      exp
    }
    const [private_key, public_key] = get_keys()
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