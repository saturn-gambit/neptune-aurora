console.clear() 

import fs from 'fs'
import dotenv from 'dotenv'
import chalk from 'chalk'
import express from 'express'
import cookie_parser from 'cookie-parser'
import cors from 'cors'
import body_parser from 'body-parser'
import morgan from 'morgan'
import * as lib from './lib.js'
import * as utils from './utils.js'
import { getOnMessageHandler } from './getOnMessageHandler.js'
import { Client, MessageEmbed, MessageAttachment, Intents } from 'discord.js'
import canvas_pkg from 'canvas'
const DayzLootMeta = JSON.parse(fs.readFileSync('./src/assets/dayz-loot-meta.json', 'utf8'))
const TraderBunkerInventory = JSON.parse(fs.readFileSync('./src/assets/killbox-nwaf-trader-v2-loot-alpha.json', 'utf8'))

dotenv.config()

const {
  npm_package_version,
  PORT,
  PRIVATE_KEY_PATH,
  PUBLIC_KEY_PATH,
  PRIVATE_KEY,
  PUBLIC_KEY,
  DATABASE_URL,
  JWT_EXPIRATION_MS,
  DISCORD_API_KEY
} = process.env

const {
  Store,
  get_jti,
  make_exp,
  get_key_pair,
  get_jwt,
  verify_jwt
} = lib

const {
  randomString,
  doNitradoFileServerApiProper,
  doNitradoFileServerApi,
  getWsConnection,
  getGameserver,
  doNitradoFileServer,
  doNitradoApi
} = utils

const { createCanvas, loadImage, registerFont } = canvas_pkg

// Database -------------------------------------------------------------------------------------------

const store = new Store(DATABASE_URL)

// Gobal Helpers -------------------------------------------------------------------------------------

const DiscordClient = Client
const lastKnownCoordsHash = {}
const killfeedRef = {}
const killFeedTimeouts = {}
const playerMapsHash = {}

function termBreak (color = `yellow`, symbol = `=`) {
  for (let terminalWidth = process.stdout.columns; terminalWidth > 0; terminalWidth--) {
    process.stdout.write(chalk[color](`${symbol}`))
  }
  process.stdout.write(`\n`)
}

function termFill (message, color = `inverse`, symbol = ` `) {
  process.stdout.write(chalk[color](message))
  for (let terminalWidth = (process.stdout.columns - message.length); terminalWidth > 0; terminalWidth--) {
    process.stdout.write(chalk[color](`${symbol}`))
  }
  process.stdout.write(`\n`)
}

const initCanvas = async (serverId) => {
  playerMapsHash[serverId] = {}
  playerMapsHash[serverId].mapCanvas = createCanvas(767.5, 767.5)
  playerMapsHash[serverId].mapCanvasCtx = playerMapsHash[serverId].mapCanvas.getContext('2d')
  playerMapsHash[serverId].mapImage = await loadImage('./src/assets/dayz-map-small.png')
  playerMapsHash[serverId].playerImage = await loadImage('./src/assets/player-small.png')
  console.log('init canvas')
  return playerMapsHash[serverId]
}

const handleStatsDownload = (url) => {
  return new Promise((resolve, reject) => {
    const method = 'GET'
    const path = url
    console.log(`handleStatsDownload`, method, path)
    doNitradoFileServer(method, path, (response) => {
      console.log('resolved', path)
      const serverLog = response
      resolve(serverLog)
    }, (error) => {
      console.log(`error: handleStatsDownload rejected`)
      reject(error)
    })
  })
}

const getServerLog = (sid, user, file, gameserver) => {
  return new Promise(async (resolve, reject) => {
    const authBearer = user.nakey
    const method = 'GET'
    const path = `/services/${sid}/gameservers/file_server/download?file=${file}`
    console.log('doing ', method, path)
    doNitradoApi(method, path, async (response) => {
      try {
        console.log('resolved', path)
        const serverLog = await handleStatsDownload(JSON.parse(response.body).data.token.url)
        resolve(serverLog)
      } catch (e) {
        reject(e)
      }
    }, (error) => {
      console.log('did not resolve get server log', sid, user, file, gameserver)
      reject(error)
    }, authBearer)
  })
}

const updateServerLogStore = async (sid, user, ftpPath, size) => {
  const { uid } = user
  try {
    const query = `update servers set sloglastsize = $1, sloglastftppath = $2 where sid = $3 and uid = $4`
    const params = [parseInt(size), ftpPath, parseInt(sid), uid]
    const result = await store.query(query, params)
  } catch (error) {
    console.log(error)
    destroyLiveKillFeed(sid)
  }
}

const _experimentalChannel = {
  channel: null
}

const _statusChannel = {
  channel: null
}

const getExperimentalChannel = () => {
  return _experimentalChannel.channel
}

const setExperimentalChannel = (channel) => {
  return _experimentalChannel.channel = channel
}

const getStatusChannel = () => {
  return _statusChannel.channel
}

const setStatusChannel = (channel) => {
  return _statusChannel.channel = channel
}

// Discord Helpers -----------------------------------------------------------------------------------

const discordClient = new DiscordClient({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'USER'],
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]
})
const client = discordClient
const prefix = '!'

// killfeed
client.login(DISCORD_API_KEY)

// killfeed bot
client.once('ready', async () => {
  const channel = client.channels.cache
    .find(channel => `${channel.id}` === `933458137317531719`)
  channel.send(`:tada: online`)
  setExperimentalChannel(channel)
  const status_channel = client.channels.cache
    .find(channel => `${channel.id}` === `958700284610220052`)
  status_channel.send(`:tada: online`)
  setStatusChannel(status_channel)
  // client.guilds.cache.find(guild => console.log(guild))
  // const experimental = client.channels.cache.find(channel => channel.name === 'experimental')
  // experimental.send('i have been summoned')
  // HERE
  // const onlineServers = await store.query(`
  //   select s.sid, convert_from(decrypt(u.nakey::bytea, 'secret-key', 'bf'), 'utf-8') as nakey, s.sportlist, s.schannel from servers s, users u where s.sactive = 1 and s.uid = u.uid
  // `, [])
  // onlineServers.rows.forEach(onlineServer => {
  //   try {
  //     console.log('=== online server', parseInt(onlineServer.sid), { nakey: onlineServer.nakey }, onlineServer.sportlist, onlineServer.schannel)
  //     setTimeout(() => {
  //       initLiveKillFeed(parseInt(onlineServer.sid), { nakey: onlineServer.nakey }, onlineServer.schannel, onlineServer.sportlist)
  //     }, 5000 * (killFeedTimeouts.length + 1))
  //   } catch (e) {
  //     console.log(e)
  //   }
  // })

  setInterval(async () => {
    const result = await store.query(`select * from (select count(*) as numsurvivors from playersservers) as a, (select count(*) as numonline from playersservers where psstatus = 1) as b`, [])
    result.rows.forEach(({ numsurvivors, numonline }) => {
      const status = `${numonline}/${numsurvivors} survivors on DayZ.`
      termFill(status, 'bgCyan')
      client.user.setActivity(status, { type: 'WATCHING' })
    })
  }, 1000 * 30)
})

client.on('messageReactionAdd', async (reaction, user) => {
  const { message, _emoji } = reaction
  const { guild } = message
  console.log('added')
  if (message.id === '933459733862567956') {
    if (_emoji.name === '👍') {
      const role = guild.roles.cache.find(role => role.name === "survivor")
      const member = await guild.members.fetch(user.id)
      const addedRole = await member.roles.add(role)
      console.log('added role', user.id)
    }
  }
})

client.on('messageReactionRemove', async (reaction, user) => {
  const { message, _emoji } = reaction
  const { guild } = message
  const role = guild.roles.cache.find(role => role.name === "survivor")
  const member = await guild.members.fetch(user.id)
  const addedRole = await member.roles.remove(role)
  console.log('removed role', user.id)
})

client.on('message', getOnMessageHandler(
  store,
  { Client: DiscordClient, MessageEmbed, MessageAttachment, RichEmbed: {}, Intents },
  { createCanvas, loadImage, registerFont },
  [...new Map(
    DayzLootMeta.map(
      (item) => [item[`ClassName`], item])
    ).values()
  ],
  {
    Objects: TraderBunkerInventory.Objects.map(({ name }) => ({ name }))
  },
  killfeedRef,
  playerMapsHash,
  lastKnownCoordsHash
))

// Helpers -------------------------------------------------------------------------------------------

function neptune_aurora_api () {
  return (request, response, next) => {
    response.set('X-Neptune-Aurora-API-Version', `v${npm_package_version}`)
    next()
  }
}

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

function db_connected (store) {
  return async (request, response, next) => {
    try {
      await store.confirm_db_connection(store.pg_client)
      next()
    } catch (db_connected_error) {
      console.error(db_connected_error)
      response.status(500).send(db_connected_error)
    }
  }
}

function authenticate_user (store) {
  return async (request, response, next) => {
    try {
      const { body } = request
      const { username, password } = body
      const query = 'select * from users where uname = $1 and upassword = crypt($2, upassword)'
      const params = [username, password]
      const result = await store.query(query, params)
      const { rows } = result
      const [user] = rows
      if (user) {
        const { password, dakey, nakey, ...rest } = user
        request.user = rest
        next()
      } else {
        throw new Error(`Unauthorized.`)
      }
    } catch (authenticate_user_error) {
      console.error(authenticate_user_error)
      response.status(500).send(authenticate_user_error)
    }
  }
}

function verify_jwt_middleware_v3 () {
  return async (request, response, next) => {
    try {
      const jwt = request.cookies.jwt
      const [private_key, public_key] = get_keys()
      const verification = await verify_jwt(jwt, public_key)
      request.verification = verification
      // next()
    } catch (error) {
      console.error(error)
      response.sendStatus(400)
    }
  }
}

function handle_listen () {
  return () => {
    console.log(`Listening on ${PORT || 12000}..`)
  }
}

function handle_engine_ntl () {
  return (file_path, options, callback) => {
    fs.readFile(file_path, (error, content) => {
      if (error) return callback(error)
      const view = content.toString()
      const reg_exp = new RegExp('{{npm_package_version}}')
      const rendered = view.replace(reg_exp, `${options.npm_package_version}`)
      return callback(null, rendered)
    })
  }
}

function handle_root () {
  return async (request, response) => {
    response.render('index', { npm_package_version })
  }
}

function handle_authenticate () {
  return async (request, response) => {
    const { user } = request
    const { uname: username } = user
    const payload = {
      username,
      expires: Date.now() + parseInt(JWT_EXPIRATION_MS)
    }
    try {
      const [private_key, public_key] = get_keys()
      const jwt = await get_jwt(private_key, payload)
      const verification = await verify_jwt(jwt, public_key)
      response.cookie('jwt', jwt, { httpOnly: true, secure: true })
      response.status(200).send()
    } catch (jwt_signing_error) {
      console.error(jwt_signing_error)
      response.status(400).send({ error: jwt_signing_error })
    }
  }
}

function handle_eg_resource () {
  return async (request, response) => {
    response.json([{
      id: 1,
      message: `hi`
    }])
  }
}

const destroyLiveKillFeed = (sid) => {
  if (killFeedTimeouts[sid] && killFeedTimeouts[sid].i) {
    clearInterval(killFeedTimeouts[sid].i)
  }
}

function handle_live_killfeed (store) {
  return (request, response) => {
    try {
      const { params: _params, user } = request
      const { sid, schannel, sportlist } = _params
      const query = `update servers set sactive = 1, schannel = $3, sportlist = $4 where sid = $1 and uid = $2 returning *`
      const params = [parseInt(sid), user.uid, schannel, sportlist]
      const result = store.query(query, params)
      const { rows } = result
      const [server] = rows
      if (server) {
        killfeedRef.restartKillfeed = () => {
          destroyLiveKillFeed(sid)
          const i = setInterval(killfeedInterval, 60000 * 3)
          killFeedTimeouts[sid] = { i, sid, user, schannel, sportlist, completed: true }
          // try to get the feed now
          killfeedInterval()
          function killfeedInterval () {
            if (killFeedTimeouts[sid].completed) {
              killFeedTimeouts[sid].completed = false
              initLiveKillFeed(sid, user, schannel, sportlist)
            }
          }
        }
        killfeedRef.restartKillfeed()
      } else {
        throw new Error(`Bad request`)
      }
    } catch (handle_live_killfeed_error) {
      console.error(handle_live_killfeed_error)
      response.status(404).send(handle_live_killfeed_error)
    }
  }
}

async function parseServerLog (sid, user, serverLog, ftpPath, /** actually newest size */ recentSize, startbytes = 0, shouldKillfeed = false, schannel, sportlist) {

  console.log('got new server log content', schannel)

  const hotMap = {}

  const newLog = serverLog.body.substring(startbytes, recentSize)

  // update the database with the stats
  let lineObjects = newLog.split('\n')

  const v2Feed = lineObjects.map((objectLine) => {
    const time = objectLine.match(/[0-9]{2}:[0-9]{2}:[0-9]{2}/g)
    const playersMatch = objectLine.match(/Player\s[\"|\'][a0-z9\s\/\-\_]*[\"|\']/g)
    const players = playersMatch ? playersMatch.map(player => {
      const split = player.split('\"')[1]
      return `${split}`
    }) : []
    const killed = objectLine.match(/\skilled\s/g) ? true : false
    const hit = objectLine.match(/\shit\s/g) ? true : false
    const pveMatch = objectLine.match(/by[\s]{1,2}[a0-z9\/\-\_\s]*/g)
    const isPve = (pveMatch && players.length < 2)
    const pve = isPve ? (
      pveMatch[0].match(/by\s\swith\s/g) ? pveMatch[0].split('by  with ').join('') : (
        pveMatch[0].match(/\sinto\s/g) ? pveMatch[0].split(' into ').join('').split('by ').join('') : (
          pveMatch[0].match(/explosion/g) ? objectLine.split('explosion').pop().trim().split(/[(|)]/g).join('') : pveMatch[0].split('by ').join('')
        )
      )
    ) : false
    const item = [objectLine.match(/\)\swith\s[a0-z9\-\s]*/g)]
      .filter(x => x !== null)
      .reduce((a,c) => c, [])
      .map(match => match.split(') with ').join(''))
      .map(string => string.split(' from ')[0])
      .reduce((a,c) => c, false)
    const melee = [objectLine.match(/\(Melee[a0-z9\_]*\)/g)]
      .filter(x => x !== null)
      .reduce((a,c) => c, [])
      .map(match => match.split(/[(|)]/g).join(''))
      .reduce((a,c) => c, false)
    const headshot = [objectLine.match(/Head\([0-9]*\)/g)]
      .filter(x => x !== null)
      .reduce((a,c) => c, [])
      .reduce((a,c) => true, false)
    const brainshot = [objectLine.match(/Brain\([0-9]*\)/g)]
      .filter(x => x !== null)
      .reduce((a,c) => c, [])
      .reduce((a,c) => true, false)
    const meters = [objectLine.match(/from\s[0-9]*\.[0-9]*\smeters/g)]
      .filter(x => x !== null)
      .reduce((a,c) => c, [])
      .map(meters => meters.split(' meters').join('').split('from ').join(''))
      .reduce((a,c) => c, 0)
    const coords = [objectLine.match(/pos=<[0-9]*.[0-9]*,\s[0-9]*.[0-9]*,\s/g)]
      .filter(x => x !== null)
      .reduce((a,c) => c, [])
      .map(match => {
        const coords = match.split('pos=<').join('').split(', ')
        coords.pop()
        return coords
      })
      .reduce((a,c) => c, [])
    const damage = [objectLine.match(/for\s[0-9]*\sdamage/g)]
      .filter(x => x !== null)
      .reduce((a,c) => c, [])
      .map(damage => damage.split(' damage').join('').split('for ').join(''))
      .reduce((a,c) => c, 0)
    const dead = [objectLine.match(/\(DEAD\)/g)]
      .filter(x => x !== null)
      .reduce((a,c) => c, [])
      .reduce((a,c) => true, false)
    const suicide = objectLine.match(/suicide/g) ? true : false
    const placed = objectLine.match(/\)\splaced\s/g) ? true : false
    const unconscious = objectLine.match(/unconscious/g) ? true : false
    const reconscious = objectLine.match(/\sconscious/g) ? true : false
    const connected = objectLine.match(/is\sconnected/g) ? true : false
    const disconnected = objectLine.match(/has\sbeen\sdisconnected/g) ? true : false
    return {
      dead,
      damage,
      disconnected,
      connected,
      reconscious,
      unconscious,
      suicide,
      placed,
      coords,
      melee,
      brainshot,
      headshot,
      meters,
      item,
      pve,
      killed,
      hit,
      players,
      time,
      original: objectLine
    }
  })
  
  v2Feed.forEach((event, eventIndex) => {
    if (shouldKillfeed) {
      // killfeed
      const experimental = client.channels.cache.find(channel => `${channel.id}` === `${schannel}`)

      const emitter = {
        emit: async (type, event) => {
          switch (type) {

            case 'kill:pvp':
              return experimental

            case 'kill:pve':
              if (event.players[0] !== `Unknown/Dead Entity`) {
                return experimental.send(`PvE \`${event.pve.trim()}\` **killed** \`${event.players[0]}\` <https://dayz.ginfo.gg/#location=${event.coords[0]};${event.coords[1]}>`)
              } else {
                return experimental
              }

            case 'suicide': return experimental.send(`PvE \`${event.players[0]}\` **committed suicide** <https://dayz.ginfo.gg/#location=${event.coords[0]};${event.coords[1]}>`)
            
            case 'hit:pve:trap': return experimental.send(`PvE \`${event.pve.trim()}\` **hit** \`${event.players[0]}\` <https://dayz.ginfo.gg/#location=${event.coords[0]};${event.coords[1]}>`)

          }
        }
      }

      if (event.killed) {
        if (event.pve) {
          emitter.emit('kill:pve', event)
        } else {
          const prevEvent = v2Feed[eventIndex - 1] ? v2Feed[eventIndex - 1] : false
          const { headshot, brainshot } = prevEvent
          emitter.emit('kill:pvp', { ...event, headshot, brainshot })
        }
      } else if (event.suicide) {
        emitter.emit('suicide', event)
      } else if (event.hit) {
        if (event.pve) {
          if (event.pve.trim().match(/Zmb[M|F]/g) && event.players[0] && !event.players[0].match(/Unknown\/Dead\sEntity/g)) {
            emitter.emit('hit:pve:zombie', event)
          } else if (event.pve.trim().match(/Grenade|Trap/g) && event.players[0] !== 'Unknown/Dead Entity') {
            emitter.emit('hit:pve:trap', event)
          } else if (event.pve.trim() === 'FallDamage') {
            emitter.emit('hit:pve:fall', event)
          }
        } else {
          if (event.melee) {
            if (!event.dead) {
              emitter.emit('hit:pvp:melee', event)
            }
          } else {
            if (event.players[0] === `Unknown/Dead Entity`) {
              emitter.emit('hit:pve:npc', event)
            } else {
              if (!event.dead) {
                emitter.emit('hit:pve:item', event)
              }
            }
          }
        }
      } else if (event.placed) {
        emitter.emit('placed:pve', event)
      } else if (event.connected) {
        emitter.emit('connected', event)
      } else if (event.disconnected) {
        emitter.emit('disconnected', event)
      }

    }
  })

  lineObjects = lineObjects.filter(line => line.length > 0)
    .map(line => {
      let match = null
      let lineTypes = [
        'is connected',
        'has been disconnected',
        'hit by Player',
        'hit by Infected',
        'hit by FallDamage',
        'killed by Player',
        '##### PlayerList',
        '\>\\)$'
      ]

      match = line.match(/[0-9]*:[0-9]*:[0-9]*/g)
      const time = match ? match[0] : 'Unknown'

      const type = lineTypes.filter(lineType => {
        const regex = new RegExp(`${lineType}`)
        return line.match(regex)
      }).reduce((a,b) => b, ``)
      // console.log(type)

      match = line.match(/\|\sPlayer\s\"[a0-z9\s\/\-]*\"/g)
      const player = match ? match[0].split('"')[1] : 'ParseWarning'
      match = line.match(/by\sPlayer\s\"[a0-z9\s\/\-]*\"/g)
      const byPlayer = type === 'hit by Infected' ? 'Infected' : (match ? match[0].split('"')[1] : 'ParseWarning')
      match = null

      match = line.match(/pos=\<[0-9]*.[0-9]*, [0-9]*.[0-9]*/g)
      const coords = match ? match.map(c => {
        return {
          x: parseFloat(c.substring(5,11)),
          y: parseFloat(c.substring(13,19))
        }
      }).reduce((a,b) => b, ``) : { x: null, y: null }
      match = null

      match = line.match(/for\s[0-9]*\sdamage/g)
      const forDamage = match ? parseFloat(match[0].split(' ')[1]) : 0
      match = null

      match = line.match(/from\s[0-9]*\.[0-9]*\smeters/g)
      const fromMeters = match ? parseFloat(match[0].split(' ')[1]) : 0
      match = null

      match = line.match(/with\s[a0-z9\/\-]*/g)
      const weapon = match ? match[0].split(' ')[1] : `Unknown`
      match = null

      return {
        line,
        fromMeters,
        time,
        player,
        byPlayer,
        type,
        forDamage,
        coords,
        weapon,
        dead: line.match(/\(DEAD\)/g),
        headshot: line.match(/Head\(0\)/g),
        brainshot: line.match(/Brain\(37\)/g)
      }
    })
    .filter(line => line.time !== 'Unknown')
    .filter(line => line.type.length > 0)
    .filter(line => line.player !== 'Unknown/Dead Entity')
    .filter(line => line.byPlayer !== 'Unknown/Dead Entity')

  // sync the database with the new stats
  await lineObjects
    .filter(lo => (lo.type === '##### PlayerList') || (lo.type === '\>\\)$') || (lo.type === `is connected`) || (lo.type === `hit by Player`) || (lo.type === `killed by Player`) || (lo.type === `has been disconnected`))
    .reduce(async (a, __current, currentIndex, sourceArray) => {
      const {
        line,
        fromMeters,
        time,
        player,
        byPlayer,
        type,
        forDamage,
        coords,
        weapon,
        headshot,
        brainshot,
        dead
      } = __current
      switch (type) {

        case `is connected`: return await a.then(async r => {
          return await new Promise(async (resolve, reject) => {
            termFill(`${' is connected'}`, 'bgGreen')
            termFill(`LINE> ${line}`, 'yellow')
            termFill(`PARSED> ${JSON.stringify(__current, null, 2)}`, 'grey')
            try {
              const pid = line.match(/(id=[a-zA-Z0-9_-]*)/g)[0].split('id=')[1]
              const pname = player

              const pquery = `select * from players where pid = $1 and pname = $2`
              const pparameters = [pid, pname]
              const presult = await store.query(pquery, pparameters)

              if (presult.rows.length === 0) {
                const pquery = `insert into players (pid, pname) values ($1, $2) returning *`
                const pparameters = [pid, pname]
                const presult1 = await store.query(pquery, pparameters)
                const psquery = `insert into playersservers (pid, sid, psstatus) values ($1, $2, 1) returning *`
                const psparameters = [pid, sid]
                const psresult = await store.query(psquery, psparameters)
              } else {
                const pquery = `select * from playersservers where pid = $1 and sid = $2`
                const pparameters = [pid, sid]
                const presult = await store.query(pquery, pparameters)
                if (presult.rows.length === 0) {
                  const psquery = `insert into playersservers (pid, sid, psstatus) values ($1, $2, 1) returning *`
                  const psparameters = [pid, sid]
                  const psresult = await store.query(psquery, psparameters)
                } else {
                  const psquery = `update playersservers set psstatus = 1 where pid = $1 and sid = $2 returning *`
                  const psparameters = [pid, sid]
                  const psresult = await store.query(psquery, psparameters)
                  lastKnownCoordsHash[pname] = coords[0]
                }
              }

            } catch (e) {
              console.log('could not update or create player', e, line)
            }

            resolve()

          })
        })

        case `hit by Player`: return await a.then(async r => {
          return await new Promise(async (resolve, reject) => {

            try {
              termFill(`${'hit by Player'}`, 'bgGreen')
              termFill(`LINE> ${line}`, 'yellow')
              termFill(`PARSED> ${JSON.stringify(__current, null, 2)}`, 'grey')
              const prevEvent = sourceArray[currentIndex-1] ? sourceArray[currentIndex-1] : { headshot: null, brainshot: null }
              const pid = line.match(/(id=[a-zA-Z0-9_-]*)/g)[1].split('id=')[1]
              const psquery = `
                update playersservers
                set psdamage = (psdamage + ($3 * 1.0000)),
                  psmeters = (case (psmeters < $4) when true then $4 else psmeters end),
                  psheadshots = psheadshots + $5,
                  psbrainshots = psbrainshots + $6,
                  pscoordsx = $7,
                  pscoordsy = $8
                where pid = $1 and sid = $2
                returning *
              `
              const psparameters = [pid, sid, forDamage, fromMeters, 0, 0, coords.x, coords.y]
              const psresult = await store.query(psquery, psparameters)
              lastKnownCoordsHash[player] = coords[0]
              lastKnownCoordsHash[byPlayer] = coords[1]
            } catch (e) {
              console.log('could not update stats', e, line)
            }

            resolve()

          })
        })

        case `killed by Player`: return await a.then(async r => {
          return await new Promise(async (resolve, reject) => {

            const experimental = client.channels.cache.find(channel => `${channel.id}` === `${schannel}`)
            let who, byWho, pvtype = ``,
            numTokens = 0, pscurrentsurvivaltime = 0,
            pscurrentkillstreak = 0, pscurrentsurvivaltime1 = 0,
            pscurrentkillstreak1 = 0
            byWho = byPlayer
            let hotMapPlayerKilled = null
            let hotMapPlayerKiller = null

            const [playerKilledPID, playerKillerPID] = line.match(/(id=[a-zA-Z0-9_-]*)/g).map(id => id.split('id=').join(''))
            let [playerKilled, playerKiller] = [null, null]
            let bountyTotal = 0, bountyResults = { rows: [] }

            // since we know that an Unknown/Dead Entity from a kill event is an NPC, we'll decide
            // to relabel it as PvE, this is a prioprietary decision and thus why it's not a kill:pve event
            if (player === `Unknown/Dead Entity`) {
              who = 'NPC'
              pvtype = `PvE `
            } else {
              who = player
              pvtype = `PvP `
            }

            // the player who was killed
            try {
              // console.log('================= hotmap has killed', hotMap[`${playerKilledPID}${sid}`], playerKilledPID, sid)
              if (!hotMap[`${playerKilledPID}${sid}`]) {
                const playerKilledQuery = `
                  select * from playersservers where pid = $1 and sid = $2
                `
                const playerKilledParams = [playerKilledPID, sid]
                const playerKilledResult = await store.query(playerKilledQuery, playerKilledParams)
                // console.log('===================== playerKilledResult.rows', playerKilledResult.rows)
                hotMap[`${playerKilledPID}${sid}`] = playerKilledResult.rows[0]
              }
              hotMapPlayerKilled = hotMap[`${playerKilledPID}${sid}`]
              // console.log('================= hotMapPlayerKilled', hotMapPlayerKilled)
              pscurrentsurvivaltime1 = hotMapPlayerKilled.pscurrentsurvivaltime
              pscurrentkillstreak1 = hotMapPlayerKilled.pscurrentkillstreak
            } catch (error) {
              console.log(error)
              console.log('================= could not get player for tokens')
            }

            // the player who did the killing
            try {
              // console.log('================= hotmap has killer', hotMap[`${playerKillerPID}${sid}`], playerKillerPID, sid)
              if (!hotMap[`${playerKillerPID}${sid}`]) {
                // 65068, 10393065
                const playerKilledQuery = `
                  select * from playersservers where pid = $1 and sid = $2
                `
                const playerKilledParams = [playerKillerPID, sid]
                const playerKilledResult = await store.query(playerKilledQuery, playerKilledParams)
                // console.log('playerKilledResult.rows ================= ', playerKilledResult.rows)
                hotMap[`${playerKillerPID}${sid}`] = playerKilledResult.rows[0]
              }
              hotMapPlayerKiller = hotMap[`${playerKillerPID}${sid}`]
              // console.log('================= ', hotMapPlayerKiller)
              pscurrentsurvivaltime = hotMapPlayerKiller.pscurrentsurvivaltime
              pscurrentkillstreak = hotMapPlayerKiller.pscurrentkillstreak
            } catch (error) {
              console.log(error)
              console.log('================= could not get player for tokens')
            }

            // find bountys
            try {
              const bountyQuery = `
                select * from bountys where btargetpsid = $1
              `
              const bountyParams = [hotMapPlayerKilled.psid]
              bountyResults = await store.query(bountyQuery, bountyParams)
              bountyTotal = bountyResults.rows.reduce((a,c) => a + c.bworth, 0)
            } catch (error) {
              console.log(`================= no bounties found for`, [hotMapPlayerKilled])
            }

            numTokens = parseInt(pscurrentsurvivaltime1) + (5 * parseInt(pscurrentkillstreak1)) + bountyTotal

            const message = [
              `${pvtype}\`${byWho}(${pscurrentsurvivaltime},${pscurrentkillstreak})\``,
              ` **killed** \`${who}(${pscurrentsurvivaltime1},${pscurrentkillstreak1})\` with *${weapon}*`,
              ` from __${fromMeters}__ meters`,
              headshot ? ` (headshot)` : ``,
              brainshot ? ` (brainshot)` : ``,
              numTokens > 0 ? ` for \`${numTokens}\` tokens` : ``,
              bountyTotal > 0 ? ` (${bountyResults.rows.length} bounties totalling ${bountyTotal})` : ``,
              ` <https://dayz.ginfo.gg/#location=${coords.x};${coords.y}>`
            ].join('')

            experimental.send(message)

            try {
              const playerKilledPid = line.match(/(id=[a-zA-Z0-9_-]*)/g)[0].split('id=')[1]

              // update player killed
              const psquery1 = `
                update playersservers
                set psdeaths = psdeaths + 1,
                  pskd = pskills/(psdeaths + 1.0000),
                  pskillstreak = (case (pskillstreak < pscurrentkillstreak) when true then pscurrentkillstreak else pskillstreak end),
                  pscurrentkillstreak = 0,
                  pscurrentsurvivaltime = 0
                where pid = $1 and sid = $2
                returning *
              `
              const psparameters1 = [playerKilledPID, sid]
              const psresult1 = await store.query(psquery1, psparameters1)
              // console.log(psresult1.rows)
              hotMap[`${playerKilledPID}${sid}`] = {
                ...hotMap[`${playerKilledPID}${sid}`],
                pscurrentsurvivaltime: 0,
                pscurrentkillstreak: 0
              }

              // update killer
              const prevEvent = sourceArray[currentIndex-1] ? sourceArray[currentIndex-1] : { headshot: null, brainshot: null }
              const { headshot: prevHeadshot, brainshot: prevBrainshot } = prevEvent
              const pid = playerKillerPID
              const psquery = `
                update playersservers
                set pskills = pskills + 1,
                  pskd = ((pskills + 1) / (case psdeaths when 0.0000 then 1.0000 else psdeaths end)),
                  psmeters = (case (psmeters < $3) when true then $3 else psmeters end),
                  psheadshots = psheadshots + $4,
                  psbrainshots = psbrainshots + $5,
                  pscurrentkillstreak = pscurrentkillstreak + 1,
                  pscredits = pscredits + $6 + (5 * $7) + $8
                where pid = $1 and sid = $2
                returning *
              `
              const psparameters = [
                pid, sid, fromMeters,
                (prevHeadshot !== null) ? 1 : 0,
                (prevBrainshot !== null) ? 1 : 0,
                parseInt(hotMap[`${playerKilledPID}${sid}`].pscurrentsurvivaltime),
                parseInt(hotMap[`${playerKilledPID}${sid}`].pscurrentkillstreak),
                bountyTotal
              ]
              // console.log('================= ', psparameters)
              const psresult = await store.query(psquery, psparameters)
              hotMap[`${pid}${sid}`] = {
                ...hotMap[`${pid}${sid}`],
                pscredits: parseInt(hotMap[`${pid}${sid}`].pscredits) + parseInt(hotMap[`${playerKilledPID}${sid}`].pscurrentsurvivaltime) + (5 * parseInt(hotMap[`${playerKilledPID}${sid}`].pscurrentkillstreak)) + bountyTotal,
                pscurrentkillstreak: parseInt(hotMap[`${pid}${sid}`].pscurrentkillstreak) + 1
              }

              // lastKnownCoordsHash[player] = coords[0]
              // lastKnownCoordsHash[byPlayer] = coords[1]

            } catch (e) {
              console.log('=================== could not update stats', e, line)
            }

            if (bountyTotal > 0) {
              try {
                const bountyQuery = `
                  delete from bountys where btargetpsid = $1
                `
                const bountyParams = [hotMapPlayerKilled.psid]
                bountyResults = await store.query(bountyQuery, bountyParams)
              } catch (error) {
                console.log(`================= could not delete bountys`, bountyParams)
              }
            }

            resolve()
          })
        })

        case `has been disconnected`: return await a.then(async r => {
          return await new Promise(async (resolve, reject) => {

            try {
              const pid = line.match(/(id=[a-zA-Z0-9_-]*)/g)[0].split('id=')[1]
              const psquery = `update playersservers set psstatus = 0 where pid = $1 and sid = $2 returning *`
              const psparameters = [pid, sid]
              const psresult = await store.query(psquery, psparameters)
            } catch (e) {
              console.log('could not update or create player', e, line)
            }

            resolve()

          })
        })

        case '##### PlayerList': return await a.then(async r => {
          return await new Promise(async (resolve, reject) => {
            termFill(`${'##### PlayerList'}`, 'bgGreen')
            termFill(`LINE> ${line}`, 'yellow')
            termFill(`PARSED> ${JSON.stringify(__current, null, 2)}`, 'grey')
            // reset map
            if (playerMapsHash[schannel] && playerMapsHash[schannel].mapImage && playerMapsHash[schannel].playerImage && playerMapsHash[schannel].mapCanvas && playerMapsHash[schannel].mapCanvasCtx) {
              playerMapsHash[schannel].mapCanvasCtx.drawImage(playerMapsHash[schannel].mapImage, 0, 0)
            } else {
              initCanvas(schannel)
            }

            resolve()

          })
        })

        case '\>\\)$': return await a.then(async r => {
          return await new Promise(async (resolve, reject) => {
            termFill(`${'\>\\)$'}`, 'bgGreen')
            termFill(`LINE> ${line}`, 'yellow')
            termFill(`PARSED> ${JSON.stringify(__current, null, 2)}`, 'grey')
            const match = line.match(/(id=[a-zA-Z0-9_-]*)/g)
            if (match && match.length > 0) {
              const pid = match[0].split('id=')
              if (pid && pid.length > 0) {
                const _pid = pid[1]
                try {
                  const psquery = `
                    update playersservers
                      set pscredits = pscredits + pswages,
                      pscurrentsurvivaltime = pscurrentsurvivaltime + 5,
                      pssurvivaltime = pssurvivaltime + 5,
                      pscoordsx = $3,
                      pscoordsy = $4
                    where
                      pid = $1 and sid = $2
                    returning *`
                  const psparameters = [_pid, `${sid}`, coords.x, coords.y]
                  const psresult = await store.query(psquery, psparameters)
                  if (psresult.rows.length > 0) {
                    const {
                      pscredits,
                      pswages,
                      pscurrentsurvivaltime,
                      pssurvivaltime,
                      ...rest
                    } = psresult.rows[0]
                    hotMap[`${_pid}${sid}`] = {
                      ...hotMap[`${_pid}${sid}`] ? hotMap[`${_pid}${sid}`] : {},
                      ...rest,
                      pscredits: pscredits + pswages,
                      pscurrentsurvivaltime: pscurrentsurvivaltime + 5,
                      pssurvivaltime: pssurvivaltime + 5
                    }
                    termFill(`HOTMAP> ${JSON.stringify(hotMap[`${_pid}${sid}`], null, 2)}`)
                    lastKnownCoordsHash[player] = coords
                  }
                } catch (error) {
                  console.log(error)
                  termFill(`ERROR> ${`unable to update db playersservers pscredits`} ${_pid} ${sid}`, 'red')
                }
              }
            }

            resolve()

          })
        })

        default: return await a.then(async r => {
          return await new Promise(async (resolve, reject) => {
            resolve()
          })
        })


      }
    }, Promise.resolve())

  // store the new log size
  updateServerLogStore(sid, user, ftpPath, recentSize)
  killFeedTimeouts[sid].completed = true
  // doBans()
}

async function initLiveKillFeed (sid, user, schannel, sportlist, _message) {
  // go get server logs info from gameserver service
  const authBearer = user.nakey
  let gameserver
  try {
    gameserver = await getGameserver({ id: sid }, authBearer)
  } catch (e) {
    console.error(e)
    return
  }
  const { log_files } = gameserver.game_specific
  console.log(log_files.filter(file => file.match(/ADM/g)))
  // if there aren't any logs
  if (log_files.length < 1) {
    // check back in two minutes
    killFeedTimeouts[sid].completed = true
    return null
  }
  // if there's a server log file
  const serverLogPath = log_files.filter(file => file.match(/ADM/g))[0].replace(`${sportlist}/`,'')
  console.log('serverLogPath', serverLogPath)
  // then fetch that server log's most recent size
  const lastServerLogSizeFromREST = await new Promise(async (resolve, reject) => {
    const method = `GET`
    const path = `/services/${sid}/gameservers/file_server/size?path=${gameserver.game_specific.path}${serverLogPath}`
    doNitradoApi(method, path, async (response) => {
      console.log('resolved', path)
      const f = () => {
        // console.log(response.body)
        try {
          const json = JSON.parse(response.body)
          const serverLogSize = json.data ? json.data.size : 0
          resolve(serverLogSize)
        } catch (e) {
          console.log('illformed response from lastServerLogSizeFromREST')
          resolve(0)
        }
      }
      f()
    }, (error) => {
      console.log('did not resolve lastServerLogSizeFromREST')
      resolve(0)
    }, authBearer)
  })
  if (lastServerLogSizeFromREST === 0) {
    killFeedTimeouts[sid].completed = true
    return 
  }
  console.log('lastServerLogSizeFromREST', lastServerLogSizeFromREST)
  // go get last server log's size from db
  const lastServerLogFromStore = await new Promise(async (resolve, reject) => {
    const query = `select * from servers where sid = $1`
    const parameters = [sid]
    const result = await store.query(query, parameters)
    const [row] = result.rows
    // console.log(row ? { sname: row.sname, sid: row.sid, schannel: row.schannel } : {})
    if (result.rows.length > 0) {
      resolve(result.rows)
    } else {
      resolve([])
    }
  })
  const lastServerLogSizeFromStore = lastServerLogFromStore.reduce((a,c) => c.sloglastsize, 0)
  // calculate offset
  const length = lastServerLogSizeFromREST - lastServerLogSizeFromStore
  console.log('>>>>>>> length', schannel, lastServerLogSizeFromREST, lastServerLogSizeFromStore, length)
  // notify experimental channel at this point
  try {
    const [row] = lastServerLogFromStore
    const killfeedObject = (row ? { sname: row.sname, sid: row.sid, schannel: row.schannel } : {})
    const message = [
      killfeedObject.sname,
      schannel,
      `lastServerLogSizeFromREST=${lastServerLogSizeFromREST}`,
      `lastServerLogSizeFromStore=${lastServerLogSizeFromStore}`,
      `length=${length}`,
    ].reduce((a,c) => `${a}\`${c}\` `, ``)
    getExperimentalChannel().send(message)
    const [day_name, month, day_num, year, time, zone, ..._locale] = new Date().toString().split(' ')
    const status_message = [
      // killfeedObject.sname,
      // schannel,
      `${time} ${zone} ${day_name}`,
      `lastServerLogSizeFromREST=${lastServerLogSizeFromREST}`,
      `lastServerLogSizeFromStore=${lastServerLogSizeFromStore}`,
      `length=${length}`,
    ].reduce((a,c) => `${a}\`${c}\` `, ``)
    getStatusChannel().send(`${length > 0 ? `:dvd:` : `:cd:`} ${status_message}`)
    if (_message) {
      _message.channel.send([
        `:dvd:`,
        `\`${killfeedObject.sname}\``,
        `**online!**`
      ].reduce((a,c) => `${a}${c} `, ``))
    }
  } catch (e) {
    console.log(e)
  }
  // if offset is zero there's no change
  if (length === 0) {
    // there are logs, but no change in logs
    // do this again in two minutes
    killFeedTimeouts[sid].completed = true
    return
  }
  // length is greater than zero so go get it
  const maxSafeSeek = 64512
  // two cases where you'll wanna fetch the entire log
  // 1 it's too bit for seek api (in which case length > maxseek)
  // 2 it's a new log like from a restart or reinstall (in which case length < 0)
  // TODO: doing it this way may allow the entire feed to get parsed again and duplicate stats
  // REMEDY: only read the part you need instead of the entire thing
  if (length < 0) {
    // use file download
    const serverLog = await getServerLog(sid, user, `${gameserver.game_specific.path}${serverLogPath}`, gameserver)
    // parse it
    console.log('got server log', `${gameserver.game_specific.path}${serverLogPath}`)
    // update db players status since they'll be no disconnected event from the logs
    try {
      const psquery = `update playersservers set psstatus = 0 where sid = $1`
      const psparameters = [sid]
      const psresult = await store.query(psquery, psparameters)
    } catch (e) {
      console.log('could not update or create player', e, line)
    }
    parseServerLog(sid, user, serverLog, `${gameserver.game_specific.path}${serverLogPath}`, lastServerLogSizeFromREST, 0, false, schannel, sportlist)
  } else if (length > maxSafeSeek) {
    // use file download
    const serverLog = await getServerLog(sid, user, `${gameserver.game_specific.path}${serverLogPath}`, gameserver)
    // parse it
    console.log('got server log', `${gameserver.game_specific.path}${serverLogPath}`)
    // update db players status since they'll be no disconnected event from the logs
    try {
      const psquery = `update playersservers set psstatus = 0 where sid = $1`
      const psparameters = [sid]
      const psresult = await store.query(psquery, psparameters)
    } catch (e) {
      console.log('could not update or create player', e, line)
    }
    parseServerLog(sid, user, serverLog, `${gameserver.game_specific.path}${serverLogPath}`, lastServerLogSizeFromREST, lastServerLogSizeFromStore + 1, false, schannel, sportlist)
  } else {
    // if there's a safe sized seek
    // fetch the single-use url to the seek using length (i.e., the seek is the subset of the file, in our case the delta which is the new stuff)
    const singleUseUrlResponse = await new Promise((resolve, reject) => {
      const method = 'GET'
      const search = `?file=${gameserver.game_specific.path}${serverLogPath}&offset=${lastServerLogSizeFromStore}&length=${length}`
      const path = `/services/${sid}/gameservers/file_server/seek${search}`
      try {
        doNitradoApi(method, path, async (response) => {
          try {
            resolve(JSON.parse(response.body))
          } catch (e) {
            console.log('no body')
            resolve({ data: { url: null, token: null } })
          }
        }, (error) => {
          console.log(`could not acquire single-use fileserver url for requested seek/file '${search}'`)
          resolve({ data: { url: null, token: null } })
        }, authBearer)
      } catch (e) {
        //
        resolve({ data: { url: null, token: null } })
      }
    })
    const { data } = singleUseUrlResponse
    // console.log('singleUseUrlResponse', data)
    const { token: _token } = data
    if (!_token) {
      killFeedTimeouts[sid].completed = true
      return
    }
    const { url: serverLogUrl, token } = _token
    // console.log('url', serverLogUrl)
    // if serverLogUrl && token
    // fetch seek of file
    if (!serverLogUrl || !token) {
      // this is essentially an error, try again in two minutes
      console.log('no serverLogUrl or token', serverLogUrl, token)
      console.log('try back in two minutes', schannel)
      killFeedTimeouts[sid].completed = true
      return
    }
    // get server log
    const serverLog = await new Promise((resolve, reject) => {
      const method = 'GET'
      doNitradoFileServerApiProper(method, serverLogUrl, token, resolve, reject)
    })
    // parse it
    console.log('got server log', schannel, serverLogUrl)
    parseServerLog(sid, user, serverLog, `${gameserver.game_specific.path}${serverLogPath}`, lastServerLogSizeFromREST, 0, true, schannel, sportlist)
  }
  // nothing else to do, done
}

// App -------------------------------------------------------------------------------------------

const app = express()
app.use(morgan('combined'))
app.use(cors({ origin: '*' }))
app.use(cookie_parser())
app.use(body_parser.json())
app.use(neptune_aurora_api())
app.engine('ntl', handle_engine_ntl())
app.set('views', './src/views')
app.set('view engine', 'ntl')
app.listen(PORT || 12000, handle_listen())

// v3
app.get('/', handle_root())
app.post('/api/v3/authenticate', db_connected(store), authenticate_user(store), handle_authenticate())
app.put('/api/v3/servers/:sid/:sportlist/live/:schannel', db_connected(store), verify_jwt_middleware_v3(), handle_live_killfeed(store))
app.get('/api/v3/eg-resource', db_connected(store), verify_jwt_middleware_v3(), handle_eg_resource())
