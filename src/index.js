console.clear() 

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import chalk from 'chalk'
import {
  get_jti,
  make_exp,
  get_key_pair,
  get_jwt,
  verify_jwt
} from './lib.js'

dotenv.config()

const {
  PORT,
  PRIVATE_KEY_PATH,
  PUBLIC_KEY_PATH,
  PRIVATE_KEY,
  PUBLIC_KEY
} = process.env

const app = express()
app.use(cors({ origin: '*' }))
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

async function verify_middleware (request, response, next) {
  try {
    const [private_key, public_key] = (PRIVATE_KEY && PUBLIC_KEY) ? [PRIVATE_KEY, PUBLIC_KEY] : get_key_pair(PRIVATE_KEY_PATH, PUBLIC_KEY_PATH)
    const authorization = request.headers[`authorization`]
    const [scheme, jwt] = authorization.split(' ')
    const verification = await verify_jwt(jwt, public_key)
    request.verification = verification
    next()
  } catch (error) {
    console.error(error)
    response.sendStatus(400)
  }
}

/**
 curl localhost:12000/api/v2/eg-resource \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlZWY5YmQwNjBhMTNjOGVhNGYzNTY4MWQ4MWU4MWI3MTMyYTUzNTNjYmUzNzBmNjk4NjFkMjM1NzRlZmFlNjk0MzhlMTg4NTA0NzMyNGUyOTQwYmQ2ZGIyMTQ5NzkxYTIiLCJleHAiOjE2NDg3MzM4MDksImlhdCI6MTY0ODczMzcwOX0.X_BCxCR9IVAYw-vPkRPCSgGu9thTowEDGq1_I4VBmjX8BmZDEUuxh6RG9-lk7dHGH87xNa8yX0KacpKiidHF9k4Fz0A3S3ng8c71MT--r8Ku0YAByUEU-nTUmRhrQDErndvl6gwQ39C7H3i_z_lJg81XvtT3g_JdXEop1T4WI8pl_zcWDHBzUcIk5zxy88RCxAoFXHBQXxzl-G_tZI3gMyCUt8p0kXfbkaKhXd4r5kgbXQZXTO2goSH0mKdnclMeoDLA9uzipIPpULJbJYhxQhrDGA6q2h_ptIJP9UZMe0Ittzr3pK3YvG4KKdUAV8GFdp7YqUPyFxc2B-iKEogBsw"
*/

app.get('/api/v2/eg-resource', verify_middleware, async (request, response) => {
  response.json([{
    id: 0,
    message: `hi`
  }])
})