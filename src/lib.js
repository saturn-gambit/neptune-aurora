import fs from 'fs'
import crypto from 'crypto'
import jsonwebtoken from 'jsonwebtoken'
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
