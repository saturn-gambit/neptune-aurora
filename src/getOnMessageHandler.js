import fs from 'fs'
import FormData from 'form-data'
import https from 'https'
import {
  busy,
  wait,
  NitradoClient,
} from './nitrado-client.js'

const API_KEY = process.env.API_KEY || `_vnWS_McrV_XxGr8ssgH6k01mh2VCGfCtRCjYCBNrQfuIsW_-YlnlJpxtGPe1j7tIc8AXGzMLOYEPjj_hH9VDpwCjv7gCP8qUdFG`
const SERVICE_ID = process.env.SERVICE_ID || `10393065`
const EVENT_SPAWNS_FILE_PATH = process.env.EVENT_SPAWNS_FILE_PATH || `/games/ni2955794_2/ftproot/dayzxb_missions/dayzOffline.chernarusplus/db/events.xml`
const CFG_GAMEPLAY_FILE_PATH = process.env.CFG_GAMEPLAY_FILE_PATH || `/games/ni2955794_2/ftproot/dayzxb_missions/dayzOffline.chernarusplus/cfggameplay.json`
const VEHICLES_EVENT_NAME = process.env.VEHICLES_EVENT_NAME || `VehicleKillbox`

const INACTIVE_EVENT = 0
const ACTIVE_EVENT = 1


class RouletteDealer {

  spin (roulette_table, discord_message_object) {
    return roulette_table.spin(discord_message_object)
  }

  wave (roulette_table) {
    return roulette_table.wave()
  }

  payout (roulette_table, discord_message_object) {
    const winning_inside_bets = roulette_table.bets.filter((bet) => {
      const win_inside = (bet.placement === roulette_table.winning_placement.winning_number)
      const win = win_inside
      console.log(`win_inside`, win, win_inside, roulette_table.winning_placement.winning_number, bet.placement)
      return win
    })
    winning_inside_bets.forEach(async (bet) => {
      discord_message_object.channel.send(`<@${roulette_table.gamblers_hash[bet.chips].did}> won \`${bet.amount * 35} tokens\` for \`${bet.amount} tokens\` on \`${bet.placement}\`!`)
      try {
        await roulette_table.gamblers_hash[bet.chips].give_cash(bet.amount * 35)
      } catch (e) {
        discord_message_object.channel.send(`<@${roulette_table.gamblers_hash[bet.chips].did}> sorry, there was issue depositing your funds.`)
      }
    })
    console.log(`winning_inside_bets`, winning_inside_bets)

    const winning_outside_bets = roulette_table.bets.filter((bet) => {
      const win_outside = roulette_table.winning_placement.winning_outsides.filter((w) => w === bet.placement).length > 0
      const win = win_outside
      console.log(`win_outside`, win, win_outside, roulette_table.winning_placement.winning_number, roulette_table.winning_placement.winning_outsides)
      return win
    })
    winning_outside_bets
      .filter(b => (b.placement === `1st12`) || (b.placement === `2nd12`) || (b.placement === `3rd12`))
      .forEach(async (bet) => {
        discord_message_object.channel.send(`<@${roulette_table.gamblers_hash[bet.chips].did}> won \`${bet.amount * 3} tokens\` for \`${bet.amount} tokens\` on \`${bet.placement}\`!`)
        try {
          await roulette_table.gamblers_hash[bet.chips].give_cash(bet.amount * 3)
        } catch (e) {
          discord_message_object.channel.send(`<@${roulette_table.gamblers_hash[bet.chips].did}> sorry, there was issue depositing your funds.`)
        }
      })
    winning_outside_bets
      .filter(b => (b.placement === `even`) || (b.placement === `odd`) || (b.placement === `black`) || (b.placement === `red`) || (b.placement === `1-18`) || (b.placement === `19-36`))
      .forEach(async (bet) => {
        discord_message_object.channel.send(`<@${roulette_table.gamblers_hash[bet.chips].did}> won \`${bet.amount * 2} tokens\` for \`${bet.amount} tokens\` on \`${bet.placement}\`!`)
        try {
          await roulette_table.gamblers_hash[bet.chips].give_cash(bet.amount * 2)
        } catch (e) {
          discord_message_object.channel.send(`<@${roulette_table.gamblers_hash[bet.chips].did}> sorry, there was issue depositing your funds.`)
        }
      })

    console.log(`winning_outside_bets`, winning_outside_bets)
    
    roulette_table.bets = []
    roulette_table.gamblers_hash = {}
  }

  remove_marker (roulette_table, discord_message_object) {
    discord_message_object.channel.send(`:game_die: bets are open...`)
    return roulette_table.remove_marker()
  }

  place_marker (roulette_table) {
    return roulette_table.place_marker()
  }

}

class RouletteTable {

  numbers = [
    0,0,1,2,3,4,5,6,7,8,9,10,
    11,12,13,14,15,16,17,18,19,
    20,21,22,23,24,25,26,27,28,29,30,
    31,32,33,34,35,36
  ]

  black_numbers = [
    2,4,6,8,10,11,13,15,17,20,
    22,24,26,28,29,31,33,35
  ]

  bets = []
  gamblers_hash = {}
  waved = false
  marker_removed = true
  winning_placement = null
  spin_interval = null

  constructor () {}

  get_roulette_number () {
    const index = Math.floor(Math.random() * 100 % 37)
    let number
    if (index === 1) number = `00`
    else number = `${this.numbers[index]}`
    return number
  }

  bet (roulette_gambler, { placement, amount }) {
    console.log(`${roulette_gambler.name} tries to put ${amount} on ${placement}...`)
    if (!this.waved) {
      this.gamblers_hash[roulette_gambler.name] = roulette_gambler
      return this.bets.push({ placement, amount, chips: roulette_gambler.name })
    } else {
      throw new Error(`Bets have been waved!`)
    }
  }

  wave () {
    console.log(`waved!`)
    return this.waved = true
  }

  remove_marker () {
    console.log(`marker removed!`)
    this.waved = false
    return this.marker_removed = true
  }

  place_marker () {
    console.log(`marker placed!`)
    return this.marker_removed = false
  }

  spinning () {
    return this.spin_interval ? true : false
  }

  spin (discord_message_object) {
    const table = this
    return new Promise((resolve, reject) => {
      const spin_time = (Math.floor(Math.random() * 20) + 1 + 3 + 10) * 1000
      let wave_time = -1
      const on_spin_interval = () => {
        console.log('ball is spinning...')
        if (wave_time % 5 === 0) {
          discord_message_object.channel.send(`:eyes: ball is spinning...`)
        }
        wave_time = wave_time + 1
        if (((spin_time * .001) - 3) === wave_time) {
          discord_message_object.channel.send(`:wave: bets are waved!`)
          table.wave()
        }
      }
      on_spin_interval()
      setTimeout(() => {
        const winning_number = this.get_roulette_number()
        if (winning_number === `0` || winning_number === `00`) {
          const winning_outsides = []
          this.winning_placement = { winning_number, winning_outsides }
        } else {
          const i = parseInt(winning_number)
          const winning_outsides = [
            i <= 18 ? `1-18` : `19-36`,
            (i % 2) === 0 ? `even` : `odd`,
            (1 <= i) && (i <= 12) ? `1st12` : null,
            (13 <= i) && (i <= 24) ? `2nd12` : null,
            (25 <= i) && (i <= 36) ? `3rd12` : null,
            this.black_numbers.filter(x => x === i).length > 0 ? `black` : `red`
          ].filter(w => w)
          this.winning_placement = { winning_number, winning_outsides }
        }
        console.log(`ball has landed! ======= ${winning_number}, ${this.winning_placement.winning_outsides} =======`)
        const outsides = this.winning_placement.winning_outsides.map((outside) => `${outside}`).join(',')
        const emojis = {
          [`0`]: `:zero:`,
          [`1`]: `:one:`,
          [`2`]: `:two:`,
          [`3`]: `:three:`,
          [`4`]: `:four:`,
          [`5`]: `:five:`,
          [`6`]: `:six:`,
          [`7`]: `:seven:`,
          [`8`]: `:eight:`,
          [`9`]: `:nine:`
        }
        const winning_number_emojis = winning_number.match(/[0-9]/g).reduce((a, c) => `${a}${emojis[c]}`, ``)
        discord_message_object.channel.send(`:flying_saucer: ball landed on ${winning_number_emojis} [\`${outsides ? outsides : `none`}\`]`)
        clearInterval(this.spin_interval)
        this.spin_interval = null
        resolve(this.winning_placement)
      }, spin_time)
      this.spin_interval = setInterval(on_spin_interval, 1000)
    })
  }

}

class Gambler {
  constructor ({ db, did, schannel }) {
    this.db = db
    this.psid = null
    this.did = did
    this.schannel = schannel
    this.name = null
    this.cash = null
  }
  async bet (roulette_table, { placement, amount }) {
    console.log(`${this.name} wants to bet ${amount}`)
    if (this.cash >= amount) {
      // first debit from database
      const query = `
        update playersservers
        set pscredits = pscredits - $1
        where psid = $2
        returning *
        ;
      `
      const params = [amount, this.psid]
      const results = await this.db.query(query, params)
      if (results.rows.length > 0) {
        // then in memory
        roulette_table.bet(this, { placement, amount })
        this.cash -= amount
        console.log(`${this.name} bet ${amount} and is left with ${this.cash}`)
      } else {
        throw new Error(`Trying to bet couldn't find account.`, this.psid, this.did)
      }
    } else {
      throw new Error(`Not enough cash: ${this.name} reached for ${amount} but has ${this.cash}`)      
    }
  }
  async give_cash (amount) {
    // first credit in database
    const query = `
      update playersservers
      set pscredits = pscredits + $1
      where psid = $2
      returning *
      ;
    `
    const params = [amount, this.psid]
    const results = await this.db.query(query, params)
    if (results.rows.length > 0) {
      // then in memory
      const old_amount = new Number(this.cash)
      this.cash += amount
      console.log(`${this.name} is up ${amount} from ${old_amount} to ${this.cash}`)
    } else {
      throw new Error(`Trying to deposit tokens couldn't find account.`, this.psid, this.did, this.cash, amount)
    }
  }
  async pull () {
    const query = `
      select p.pname, ps.psid, ps.pscredits
      from
        discordsplayers dp, playersservers ps, players p, servers s
      where
        dp.did = $1
        and dp.pid = ps.pid
        and ps.sid = s.sid
        and s.schannel = $2
        and p.pid = ps.pid
      ;
    `
    const params = [this.did, this.schannel]
    const results = await this.db.query(query, params)
    if (results.rows.length > 0) {
      const {
        pname, pscredits, psid
      } = results.rows[0]
      this.psid = psid
      this.name = `${pname}`
      this.cash = pscredits
      return results.rows
    } else {
      throw new Error(`Couldn't find account.`)
    }
  }
}

const post = (path, form) => {
  return new Promise((resolve, reject) => {
    const callback = (response) => {
      let data = ``
      response.on('data', (chunk) => {
        console.log('got ban data')
        data = `${data}${chunk}`
      })
      response.on('end', () => {
        resolve(data)
      })
    }
    const options = {
      method: 'POST',
      hostname: 'api.nitrado.net',
      path,
      headers: {
        Authorization: 'Bearer _vnWS_McrV_XxGr8ssgH6k01mh2VCGfCtRCjYCBNrQfuIsW_-YlnlJpxtGPe1j7tIc8AXGzMLOYEPjj_hH9VDpwCjv7gCP8qUdFG',
        ...form.getHeaders(),
        "Content-Length": form.getLengthSync(),
      }
    }
    const request = https.request(options, callback)
    form.pipe(request)
    request.on('error', (error) => {
      console.error(error)
      reject(error)
    })
    request.end()
  })
}

const postBans = (sid, form) => {
  return post(`/services/${sid}/gameservers/settings`, form)
}

const bansDb = './src/bans.hash'
const bansDbBuffer = fs.readFileSync(bansDb)
const bansHash = JSON.parse(bansDbBuffer.toString())

const doBans = async () => {
  console.log("doing bans...")
  const sid = `10393065`
  const value = Object.keys(bansHash).join('\r\n')
  fs.writeFileSync(bansDb, JSON.stringify(bansHash))
  const form = new FormData()
  form.append('category', 'general')
  form.append('key', 'bans')
  form.append('value', value)
  return await postBans(sid, form)
}

export function getOnMessageHandler (
  db,
  { Client: DiscordClient, MessageEmbed, MessageAttachment, RichEmbed, Intents },
  { createCanvas, loadImage, registerFont },
  DayzLootMeta,
  TraderBunkerInventory,
  killfeedRef,
  playerMapsHash,
  lastKnownCoordsHash
){
  const roulette_table = new RouletteTable()
  const roulette_dealer = new RouletteDealer()
  return async (message) => {
  
    console.log('got message', message.content)

    const KILLFEED_CHANNEL_ID = `934906835432009788`
    const CASINO_CHANNEL_ID = `956648776381132860`
    const INVENTORY_CHANNEL_ID = `950409363300962354`
    const STATS_CHANNEL_ID = `933459469080334408`

    // arsenal priv to restart feed
    if (message.author.id === '804092806657605673') {
      if (message.content.substring(0,17) === '!killfeed restart') {
        if (killfeedRef.restartKillfeed) {
          message.channel.send(`:recycle: restarting killfeed...`)
          killfeedRef.restartKillfeed()
        }
      }
    }

    if (message.author.id === '804194483029671947') {
      if (message.content.substring(0,17) === '!killfeed restart') {
        if (killfeedRef.restartKillfeed) {
          message.channel.send(`:recycle: restarting killfeed...`)
          killfeedRef.restartKillfeed()
        }
      }
      if (message.content.substring(0,7) === '!server') {
        if (message.content.substring(0,15) === '!server restart') {
          try {
            message.channel.send(`:dvd: instantiating nitrado client...`)
            const nitrado_client = new NitradoClient(API_KEY)
            message.channel.send(`:satellite: pulling gameserver info...`)
            const nitrado_game_server = await nitrado_client.get_gameserver_by_sid(SERVICE_ID)
            message.channel.send(`@everyone stopping server...`)
            await nitrado_client.stop_gameserver(nitrado_game_server)
            message.channel.send(`@everyone starting server back up...`)
            await nitrado_client.start_gameserver(nitrado_game_server)
            message.channel.send(`@everyone server is back up!`)
          } catch (error) {
            console.log(error)
            message.channel.send(`:x: there was an error..`)
          }
        }
        if (message.content.substring(0,26) === '!server toggle base-damage') {
          try {
            const [_, _toggle] = message.content.split('!server toggle base-damage ')
            const toggle = parseInt(_toggle)
            message.channel.send(`:dvd: instantiating nitrado client...`)
            const nitrado_client = new NitradoClient(API_KEY)
            message.channel.send(`:satellite: pulling gameserver info...`)
            const nitrado_game_server = await nitrado_client.get_gameserver_by_sid(SERVICE_ID)
            message.channel.send(`:satellite: pulling cfggameplay data...`)
            const nitrado_file = await nitrado_client.get_nitrado_file(nitrado_game_server, CFG_GAMEPLAY_FILE_PATH)
            await nitrado_file.pull()
            message.channel.send(`:knot: mutating cfggameplay data...`)
            await nitrado_file.toggle_base_damage(toggle)
            message.channel.send(`:satellite: pushing cfggameplay data...`)
            await nitrado_file.push()
            message.channel.send(`:satellite: configuration uploaded! @everyone base damage will ${toggle === 1 ? `**off**` : `**on**`} after next restart.`)
          } catch (error) {
            console.log(error)
            message.channel.send(`there was an error..`)
          }
        }
        if (message.content.substring(0,24) === '!server despawn vehicles') {
          try {
            message.channel.send(`:dvd: instantiating nitrado client...`)
            const nitrado_client = new NitradoClient(API_KEY)
            message.channel.send(`:satellite: pulling gameserver info...`)
            const nitrado_game_server = await nitrado_client.get_gameserver_by_sid(SERVICE_ID)
            message.channel.send(`:satellite: pulling events data...`)
            const nitrado_file = await nitrado_client.get_nitrado_file(nitrado_game_server, EVENT_SPAWNS_FILE_PATH)
            await nitrado_file.pull()
            message.channel.send(`:knot: mutating events data...`)
            await nitrado_file.toggle_events(VEHICLES_EVENT_NAME, INACTIVE_EVENT)
            message.channel.send(`:satellite: pushing events data...`)
            await nitrado_file.push()
            message.channel.send(`@everyone stopping server for vehicle despawn cycle.. the server will go down, then up for 5 minutes, then down, then back up...`)
            await nitrado_client.stop_gameserver(nitrado_game_server)
            message.channel.send(`@everyone starting server back up.. it will go down in 5 minutes...`)
            await nitrado_client.start_gameserver(nitrado_game_server)
            await wait(5)
            message.channel.send(`:knot: mutating events data...`)
            await nitrado_file.toggle_events(VEHICLES_EVENT_NAME, ACTIVE_EVENT)
            message.channel.send(`:satellite: pushing events data...`)
            await nitrado_file.push()
            message.channel.send(`@everyone stopping server for vehicle despawn cycle.. this is the last downage...`)
            await nitrado_client.stop_gameserver(nitrado_game_server)
            message.channel.send(`@everyone starting server back up.. this is the final stage of despawn cycle...`)
            await nitrado_client.start_gameserver(nitrado_game_server)
            message.channel.send(`@everyone server is back up!`)
          } catch (error) {
            console.log(error)
            message.channel.send(`there was an error..`)
          }
        }
      }
      if (message.content.substring(0,5) === `!ban `) {
        try {
          const gamer_tag = message
            .content
            .split(' ')
            .filter(s => s !== `!ban`)
            .join(' ')
          bansHash[gamer_tag] = {}
          await doBans()
          message.channel.send(`:oncoming_police_car: banned \`${gamer_tag}\`!`)
        } catch (e) {
          console.error(e)
          message.channel.send(`:shit: error banning!`)
        }
      }
    }

    if (message.content.length === 40) {
      const did = message.author.id
      const pid = message.content
      // const schannel = message.content.split(' ')[0]
      try {
        if (pid.length !== 40) {
          message.author.send(`Invalid XBox ID. Length should be 40 characters, yours was ${pid.length} reading \`${pid}\``)
        } else {
          const query = `
            insert into discordsplayers (pid, did)
            values ($1, $2)
            returning pid, did
          `
          console.log('insert into discordsplayers', pid, did)
          const parameters = [pid, did]
          const result = await db.query(query, parameters)
          console.log('result', result.rows.length)
          if (result.rows.length > 0) {
            message.author.send('Successfully linked!')
          } else {
            message.author.send('Looks like I\'m having an issue, sorry. Try DMing the server owner. Level 2.1')
          }
        }
      } catch (error) {
        console.log(error)
        if (error.detail && error.detail.match(/already exists/g)) {
          try {
            const query = `
              delete from discordsplayers
              where pid = $1
            `
            console.log('deleting from discordsplayers', pid)
            const parameters = [pid]
            const result = await db.query(query, parameters)
            console.log('result', result.rows.length)
            message.author.send('Successfully unlinked!')
          } catch (error1) {
            console.log(error1)
            message.author.send('Looks like I\'m having an issue, sorry. Try DMing the server owner. Level 1.2')
          }
        } else {
          message.author.send('Looks like I\'m having an issue, sorry. Try DMing the server owner. Level 1.1')
        }
      }
    }

    if ((CASINO_CHANNEL_ID === message.channel.id) && (message.content.substring(0,9) === '!roulette')) {
      if (message.content === `!roulette help`) {
        const m = [
          `Usage: \`!roulette <placement[red,black,even,odd,1st12,2nd12,3rd12,1-18,19-36,0,00,1,...,36]> <amount>\``,
          `\n  e.g., \`!roulette red 5000\``,
          `\n  e.g., \`!roulette 00 2500\``,
          `\n  e.g., \`!roulette 2nd12 1000\``,
        ].join('')
        message.channel.send(m)
      }
      const did = message.author.id
      const schannel = KILLFEED_CHANNEL_ID
      try {
        const [placement, amount] = message.content.split('!roulette ')[1].split(' ')
        // const roulette_gambler = new Gambler({ name: `${did}`, cash: 10000 })
        const roulette_gambler = new Gambler({ db, did, schannel })
        await roulette_gambler.pull()
        await roulette_gambler.bet(roulette_table, { placement, amount: parseInt(amount) })  
        message.react(`👍`)
        if (!roulette_table.spinning()) {
          await roulette_dealer.spin(roulette_table, message)
          await roulette_dealer.place_marker(roulette_table)
          await roulette_dealer.payout(roulette_table, message)
          await roulette_dealer.remove_marker(roulette_table, message)
        }
      } catch (betting_error) {
        console.log(betting_error)
        message.react(`❌`)
        if (betting_error.match(/wave/g)) {
          message.channel.send(`Sorry, bets have been waved!`)
        } else if (betting_error.match(/cash/g)) {
          message.channel.send(`Sorry, but you're out of tokens.`)
        } else if (betting_error.match(/find account/g)) {
          message.channel.send(`Sorry, couldn't find an accounts in this channel for <@${did}>.`)
        } else {
          message.channel.send(`Sorry, there was an error.`)
        }
      }

    }
  
    if (((STATS_CHANNEL_ID === message.channel.id) || (CASINO_CHANNEL_ID === message.channel.id)) && (message.content.substring(0,5) === '!bank')) {
      if (message.content.substring(0,13) === '!bank balance') {
        const did = message.author.id
        const schannel = KILLFEED_CHANNEL_ID
        try {
          const query = `
            select p.pname, ps.pscredits
            from
              discordsplayers dp, playersservers ps, players p, servers s
            where
              dp.did = $1
              and dp.pid = ps.pid
              and ps.sid = s.sid
              and s.schannel = $2
              and p.pid = ps.pid
            ;
          `
          console.log('querying for bank balance', did, schannel)
          const parameters = [did, schannel]
          const result = await db.query(query, parameters)
          console.log('result', result.rows.length)
          if (result.rows.length > 0) {
            const m = result.rows.map(r => {
              return `Survivor \`${r.pname}\` has \`${r.pscredits}\` tokens.`
            }).join('\n')
            message.channel.send(m)
          } else {
            message.channel.send('Nothing found..')
          }
        } catch (error) {
          message.channel.send('Looks like I\'m having an issue, sorry. Try again.')
        }
      }
      if (message.content.substring(0,14) === '!bank transfer') {
        const did = message.author.id
        const schannel = KILLFEED_CHANNEL_ID
        try {
          const string = message.content
          const [x, y, amount, ...rest] = string.split(' ')
          const toPlayerName = rest.join(' ')
          const query = `
            select p.pname, p.pid, ps.pscredits
            from
              discordsplayers dp, playersservers ps, players p, servers s
            where
              dp.did = $1
              and dp.pid = ps.pid
              and ps.sid = s.sid
              and s.schannel = $2
              and p.pid = ps.pid
            ;
          `
          console.log('querying for sufficient funds', did, schannel)
          const parameters = [did, schannel]
          const result = await db.query(query, parameters)
          try {
            const { pscredits, pid: pidFrom, pname: pnameFrom } = result.rows[0]
            if (pscredits >= parseInt(amount)) {
              try {
                const query = `
                  select *
                  from players p, discordsplayers dp
                  where p.pname = $1 and p.pid = dp.pid
                  ;
                `
                console.log('querying for recipient', toPlayerName)
                const parameters = [toPlayerName]
                const result = await db.query(query, parameters)
                const { pid: pidTo, did: didTo } = result.rows[0]
                try {
                  const query = `
                    update playersservers
                    set pscredits = pscredits + $1
                    where pid = $2
                    ;
                  `
                  console.log('credit funds', toPlayerName, amount)
                  const parameters = [parseInt(amount), pidTo]
                  const result = await db.query(query, parameters)
                  try {
                    const query = `
                      update playersservers
                      set pscredits = pscredits - $1
                      where pid = $2
                      ;
                    `
                    console.log('debit funds', pnameFrom)
                    const parameters = [parseInt(amount), pidFrom]
                    const result = await db.query(query, parameters)
                    message.channel.send(`Transferred \`${amount}\` tokens from \`${pnameFrom}\` to <@${didTo}> \`${toPlayerName}\`.`)
                  } catch (error) {
                    message.channel.send(`Unable to withdraw funds from survivor \`${pnameFrom}\`, sorry.`)
                  }
                } catch (error) {
                  message.channel.send(`Unable to transfer funds to survivor \`${toPlayerName}\`, sorry.`)
                }
              } catch (error) {
                message.channel.send(`Unable to find account for survivor \`${toPlayerName}\`.`)
              }
            } else {
              message.channel.send(`Insufficient funds, sorry.`)
            }
          } catch (error) {
            message.channel.send(`I seem to be having an issue, sorry. Try again. Make sure you're linked.`)
          }
        } catch (error) {
          message.channel.send(`I seem to be having an issue, sorry. Try again. Make sure you're linked. Usage: \`!bank transfer <amount> <gamer-tag>\` e.g., \`!bank transfer 500 Gamer Tag 333\``)
        }
      }
    }

    if ((INVENTORY_CHANNEL_ID === message.channel.id) && (message.content.substring(0,10) === '!inventory')) {
      if (message.content.substring(0,15) === '!inventory help') {
        const m = [
          `usage: \`!inventory <search,info> [<args>]\``,
          `\n  e.g., \`!inventory search buttstock\``,
          `\n  e.g., \`!inventory info bunker\``,
        ].join('')
        message.channel.send(m)
      }
      if (message.content.substring(0,17) === '!inventory search') {
        const searchString = message.content
          .split('!inventory search ')
          .filter(i => i !== '!inventory search ')
          .join('')
        const searchStringRegExp = new RegExp(searchString.toLowerCase())
        const results = DayzLootMeta.filter(loot => loot.Label.toLowerCase().match(searchStringRegExp) || loot.ClassName.toLowerCase().match(searchStringRegExp))
        const host = `https://static.wikia.nocookie.net`
        const exactMatchLabel = results.filter(loot => loot.Label.toLowerCase() === searchString)
        const exactMatchClassname = results.filter(loot => loot.ClassName.toLowerCase() === searchString)
        const eachLoot = (loot) => {
          const {
            Label,
            Imagesrc,
            Category,
            ...rest
          } = loot
          const objects = TraderBunkerInventory.Objects.filter(object => object.name === loot.ClassName)
          const stockStatus = objects.length > 0 ? `👍 **In stock!**` : `*Out of stock.*`
          let price = 0
          switch (rest.Rarity) {
            case 'N/A': price = `market`; break
            case 'Common': price = 100; break
            case 'Uncommon': price = 200; break
            case 'Unknown': price = 300; break
            case 'Rare': price = 500; break
            case 'Very Rare': price = 800; break
            case 'Extremely Rare': price = 1300; break
            default: price = `market`
          }
          if (loot.ClassName.match(/Green/g) || loot.ClassName.match(/Camo/g) || loot.ClassName.match(/Black/g)) {
            price = price + 300
          }
          if (loot.Type === 'Rifle') {
            price = price + 300
          }
          console.log(loot)
          const desc = `${stockStatus}\n\n\`${price} tokens\``
          const embed = new MessageEmbed()
            .setTitle(`${loot.Label} (${loot.ClassName})`)
            .setFooter(loot.Category)
            .setColor('#000000')
            // .setTimestamp()
            .setDescription({ text: desc })
            // .attachFiles([`${host}${Imagesrc}`])
            .setThumbnail(`${host}${Imagesrc}`)

          // const restKeys = Object.keys(rest)
          // restKeys
            // .filter(k => (k === `Weapon(s)`) || (k === `Magazines`) || (k === `Variants`) || (k === `Cartridge`) || (k === `Size`))
            // .forEach(k => embed.addField(k, rest[k], false))

          message.channel.send(embed)
        }
        if (exactMatchLabel.length > 0) {
          eachLoot(exactMatchLabel[0])
        } else if (exactMatchClassname.length > 0) {
          eachLoot(exactMatchClassname[0])
        } else {       
          if (results.length > 0) {
            results.filter((l,i) => i < 6).forEach(eachLoot)
            if (results.length > 6) {
              message.channel.send(`Limited 6 results per query, try being more specific.`)
            }
          } else {
            message.channel.send(`Didn't find any results..`)
          }
        }
      }
      if (message.content.substring(0,15) === '!inventory info') {
        const searchString = message.content
          .split('!inventory info ')
          .filter(i => i !== '!inventory info ')
          .join('')
        const searchStringRegExp = new RegExp(searchString.toLowerCase())
        const results = DayzLootMeta.filter(loot => loot.Label.toLowerCase().match(searchStringRegExp) || loot.ClassName.toLowerCase().match(searchStringRegExp))
        const host = `https://static.wikia.nocookie.net`
        const exactMatchLabel = results.filter(loot => loot.Label.toLowerCase() === searchString)
        const exactMatchClassname = results.filter(loot => loot.ClassName.toLowerCase() === searchString)
        const eachLoot = (loot) => {
          const {
            Label,
            Imagesrc,
            Category,
            ...rest
          } = loot
          const desc = [
            loot.Price ? `\`${loot.Price}\`` : ``,
            `\`\`\`${JSON.stringify({ ...rest }, null, 2)}\`\`\``
          ].join('')
          const embed = new MessageEmbed()
            .setTitle(`${loot.Label} (${loot.ClassName})`)
            .setFooter(loot.Category)
            .setColor('#000000')
            // .setTimestamp()
            .setDescription({ text: desc })
            // .attachFiles([`${host}${Imagesrc}`])
            .setThumbnail(`${host}${Imagesrc}`)

          // const restKeys = Object.keys(rest)
          // restKeys
            // .filter(k => (k === `Weapon(s)`) || (k === `Magazines`) || (k === `Variants`) || (k === `Cartridge`) || (k === `Size`))
            // .forEach(k => embed.addField(k, rest[k], false))

          message.channel.send(embed)
        }
        if (exactMatchLabel.length > 0) {
          eachLoot(exactMatchLabel[0])
        } else if (exactMatchClassname.length > 0) {
          eachLoot(exactMatchClassname[0])
        } else {       
          if (results.length > 0) {
            results.filter((l,i) => i < 1).forEach(eachLoot)
            if (results.length > 4) {
              message.channel.send(`Limited 1 results per query, try being more specific.`)
            }
          } else {
            message.channel.send(`Didn't find any results..`)
          }
        }
      }
    }

    if ((STATS_CHANNEL_ID === message.channel.id) && (message.content.substring(0,21) === '!satellite buy tracer')) {
      try {
        const [_, gamer_tag] = message.content.split('!satellite buy tracer ')
        const did = message.author.id
        const schannel = KILLFEED_CHANNEL_ID
        try {
          const query = `
            select p.pname, p.pid, ps.pscredits, ps.psid
            from
              discordsplayers dp, playersservers ps, players p, servers s
            where
              dp.did = $1
              and dp.pid = ps.pid
              and ps.sid = s.sid
              and s.schannel = $2
              and p.pid = ps.pid
            ;
          `
          console.log('querying for sufficient funds', did, schannel)
          const parameters = [did, schannel]
          const result = await db.query(query, parameters)
          try {
            const { pscredits, psid, pname } = result.rows[0]
            if (pscredits >= 5000) {
              try {
                const query = `
                  update playersservers
                  set pscredits = pscredits - 5000
                  where psid = $1
                  returning *
                  ;
                `
                console.log('debit account', psid, pname)
                const parameters = [psid]
                const result = await db.query(query, parameters)
                const { sid: target_sid } = result.rows[0]
                try {
                  const query = `select * from playersservers ps, players p where ps.sid = $1 and ps.pid = p.pid and p.pname = $2`
                  const params = [target_sid, gamer_tag]
                  const result = await db.query(query, params)
                  const { pshasjammer, pscoordsx, pscoordsy } = result.rows[0]
                  if (pshasjammer > new Date().getTime()) {
                    message.channel.send(`:satellite: signal jammed, sorry.`)                    
                  } else if ((pscoordsx === 0.00) && (pscoordsy === 0.00)) {
                    new Error('no info')
                  } else {
                    message.channel.send(`:satellite: survivor located, data file uploaded to your dm.`)
                    message.author.send(`:satellite: \`${gamer_tag}\`'s last known position <https://dayz.ginfo.gg/#location=${pscoordsx};${pscoordsy}>`)
                  }
                } catch (e) {
                  console.error('no info satellite')
                  message.channel.send(`:satellite: sorry, no info`)
                }
              } catch (error) {
                console.log(error)
                message.channel.send(`:satellite: i had a problem debiting your account, sorry.`)
              }
            } else {
              message.channel.send(`:satellite: insufficient funds, sorry.`)
            }
          } catch (error) {
            message.channel.send(`:satellite: i seem to be having an issue, sorry. try again. make sure you're linked.`)
          }
        } catch (error) {
          message.channel.send(`:satellite: i seem to be having an issue, sorry. try again. make sure you're linked. usage: \`!satellite buy tracer <gamer-tag>\` e.g., \`!satellite buy tracer Gamer Tag33\``)
        }
      } catch (error) {
        console.error(error)
        message.channel.send(`:satellite: sorry, no info`)
      }
    }

    if ((STATS_CHANNEL_ID === message.channel.id) && (message.content.substring(0,21) === '!satellite buy jammer')) {
      try {
        const did = message.author.id
        const schannel = KILLFEED_CHANNEL_ID
        try {
          const query = `
            select p.pname, p.pid, ps.pscredits, ps.psid
            from
              discordsplayers dp, playersservers ps, players p, servers s
            where
              dp.did = $1
              and dp.pid = ps.pid
              and ps.sid = s.sid
              and s.schannel = $2
              and p.pid = ps.pid
            ;
          `
          console.log('querying for sufficient funds', did, schannel)
          const parameters = [did, schannel]
          const result = await db.query(query, parameters)
          try {
            const { pscredits, psid, pname } = result.rows[0]
            if (pscredits >= 50000) {
              try {
                const query = `
                  update playersservers
                  set pscredits = pscredits - 50000, pshasjammer = $2
                  where psid = $1
                  returning *
                  ;
                `
                console.log('debit account', psid, pname)
                const hrs24 = 1000 * 60 * 60 * 24
                const parameters = [psid, new Date().getTime() + (hrs24)]
                const result = await db.query(query, parameters)
                message.channel.send(`:satellite: your signal has been jammed for the next 24 hours.`)
              } catch (error) {
                console.log(error)
                message.channel.send(`:satellite: i had a problem debiting your account, sorry.`)
              }
            } else {
              message.channel.send(`:satellite: insufficient funds, sorry.`)
            }
          } catch (error) {
            message.channel.send(`:satellite: i seem to be having an issue, sorry. try again. make sure you're linked.`)
          }
        } catch (error) {
          message.channel.send(`:satellite: i seem to be having an issue, sorry. try again. make sure you're linked. usage: \`!satellite buy jammer\` e.g., \`!satellite buy jammer\``)
        }
      } catch (error) {
        console.error(error)
        message.channel.send(`:satellite: sorry, no info`)
      }
    }
  
    if ((STATS_CHANNEL_ID === message.channel.id) && (message.content.substring(0,9) === '!killfeed')) {
      if (message.content.substring(0,16) === '!killfeed bounty') {
        if (message.content.substring(0,20) === '!killfeed bounty set') {
          // !killfeed bounty set 6000 sundaysatan
          try {
            const did = message.author.id
            const schannel = KILLFEED_CHANNEL_ID
            const split = message.content.split(' ')
            const [x,y,z, amount, ...rest] = split
            const player = rest.join(' ')
            console.log('bounty', amount, player)
            const q = `
                select p.pname, p.pid, ps.pscredits, ps.psid
              from
                discordsplayers dp, playersservers ps, players p, servers s
              where
                dp.did = $1
                and dp.pid = ps.pid
                and s.sid = ps.sid
                and ps.pid = p.pid
                and s.schannel = $2
              ;
            `
            const p = [did, schannel]
            console.log('executing link verify', did, schannel, player)
            const r = await db.query(q, p)
            if (r.rows.length > 0) {
              const [{ pscredits, psid }] = r.rows
              console.log('checking credits', pscredits, psid)
              if (amount <= pscredits) {
                // find target player
                const q1 = `
                  select *
                  from
                    players p, playersservers ps, servers s
                  where
                    p.pid = ps.pid
                    and ps.sid = s.sid
                    and s.schannel = $1
                    and p.pname = $2
                  ;
                `
                const p1 = [schannel, player]
                console.log('executing query select target player', schannel, player)
                const r1 = await db.query(q1, p1)
                const [targetPlayerFound] = r1.rows
                console.log('targetPlayerFound', targetPlayerFound)
                if (targetPlayerFound) {
                  // update db with new bounty
                  const q2 = `
                    insert into
                      bountys (bissuerpsid, btargetpsid, bworth)
                      values ($1, $2, $3)
                    returning *
                    ;
                  `
                  const p2 = [psid, targetPlayerFound.psid, parseInt(amount)]
                  console.log('executing bounty set', psid, targetPlayerFound.psid, amount)
                  const r2 = await db.query(q2, p2)
                  if (r2.rows.length > 0) {
                    const [{ pid, psid }] = r.rows
                    // update db survivor minus credits for bounty
                    const q3 = `
                      update playersservers
                      set
                        pscredits = pscredits - $1
                      where psid = $2 and pid = $3
                      returning *
                      ;
                    `
                    const p3 = [parseInt(amount), psid, pid]
                    console.log('executing update debt credits', amount, psid, pid)
                    const r3 = await db.query(q3, p3)
                    if (r3.rows.length > 0) {
                      const q4 = `
                        select *
                        from discordsplayers dp, playersservers ps, players p, servers s
                        where
                          dp.pid = ps.pid
                          and ps.pid = p.pid
                          and p.pname = $1
                          and ps.sid = s.sid
                          and s.schannel = $2
                        ;
                      `
                      const p4 = [player, schannel]
                      console.log('executing select * for did', player, schannel)
                      const r4 = await db.query(q4, p4)
                      const [discordUser] = r4.rows
                      const m = [
                        `A bounty for \`${amount} tokens\` has been issued on \`${player}\``,
                        discordUser ? ` (<@${discordUser.did}>)` : ``,
                        `.`
                      ].join('')
                      message.channel.send(m)
                    } else {
                      message.channel.send(`I seem to be having trouble deducting from your bank account. The bounty has been set but you have not been charged.`)
                    }
                  } else {
                    message.channel.send(`I seem to be having trouble setting this bounty, sorry.`)
                  }
                } else {
                  message.channel.send(`Could not find survivor \`${player}\`.`)
                }
              } else {
                message.channel.send(`You don\'t have enough tokens to set that bounty, sorry. Current balance is \`${pscredits}\` tokens.`)
              }
            } else {
              message.channel.send(`You don\'t seem to be linked. Have you tried \`!killfeed link\`?`)
            }
          } catch (error) {
            console.log(error)
            message.channel.send(`I seem to be having an issue, sorry. Try again.`)
          }
        }
        if (message.content.substring(0,21) === '!killfeed bounty list') {
          try {
            const schannel = KILLFEED_CHANNEL_ID
            console.log('query bounty for', schannel)
            const q = `
                select * from players p, playersservers ps, bountys b, servers s
                where
                  b.btargetpsid = ps.psid
                  and p.pid = ps.pid
                  and ps.sid = s.sid
                  and s.schannel = $1
              ;
            `
            const p = [schannel]
            console.log('querying for bountys', schannel)
            const r = await db.query(q, p)
            if (r.rows.length > 0) {
              r.rows.forEach((bounty) => {
                message.channel.send(`Found \`${bounty.bworth}\` tokens bounty on \`${bounty.pname}\`.`)
              })
            } else {
              message.channel.send(`Crime is low, no bounties found.`)
            }
          } catch (error) {
            console.log(error)
            message.channel.send(`I seem to be having an issue, sorry. Try again.`)
          }
        }
      }
      if (message.content.substring(0,14) === '!killfeed link') {
        const did = message.author.id
        const schannel = KILLFEED_CHANNEL_ID
        try {
          const query = `
            insert into discords (did)
            values ($1)
            returning did
          `
          console.log('insert into discords', did, schannel)
          const parameters = [did]
          const result = await db.query(query, parameters)
          console.log('result', result.rows.length)
          if (result.rows.length > 0) {
            const m = [
              `To link a player to killbox, `,
              `reply to this bot message with your 40 character long xbox id located at the bottom left of the DayZ Play screen. `,
              `(e.g., \`3B4BF81519D7A9D54D2F1A20608E5E7B8F0412E9\`)`
            ].join('')
            message.author.send(m)
          } else {
            message.author.send('Looks like you\'re already linked.')
          }
        } catch (error) {
          const m = [
            `To link a player to killbox, `,
            `Reply to this bot message with your 40 character long xbox id located at the bottom left of the DayZ Play screen. `,
            `(e.g., \`3B4BF81519D7A9D54D2F1A20608E5E7B8F0412E9\`)`
          ].join('')
          message.author.send(m)
        }
      }
      if (message.content.substring(0,14) === '!killfeed help') {
        message.channel.send(`usage: !killfeed <rank,mint,leaderboard,online,link,bounty> [<args>] \n\te.g., try '!killfeed rank help' to see how to use the rank command`)
      }
      if (message.content.substring(0,14) === '!killfeed mint') {
        const targetPlayerName = message.content.substring(15, message.content.length)
        const rankQuery = await db.query(`
          select * from (
            select
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus, ps.pskillstreak, ps.pscurrentkillstreak,
              (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) as score,
              row_number() over(order by (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) desc) as rankk,
              (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
            from
              playersservers ps,
              players p,
              servers s
            where
              ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
            group by
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus, ps.pskillstreak, ps.pscurrentkillstreak
            order by (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) desc
          ) as leaderboard where leaderboard.pname = $1
        `, [targetPlayerName, KILLFEED_CHANNEL_ID])
        console.log('ROWS=====', rankQuery.rows)
        const [rank] = rankQuery.rows
        if (rank) {
          const token = `Survivor _${rank.pname}_ ranked ${rank.rankk}/${rank.of} with ${rank.pskills} kills, ${rank.psdeaths} deaths, for a ${rank.pskd} k/d, dealing ${rank.psdamage} damage, with their longest kill shot from ${rank.psmeters} meters, as well as ${rank.psheadshots} headshots, ${rank.psbrainshots} brainshots, whose current kill streak is ${rank.pscurrentkillstreak}, and longest kill streak at ${rank.pskillstreak} for an overall score of ${rank.score} points.`
          message.channel.send(token)
        } else {
          message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
        }
      }
      if (message.content.substring(0,16) === '!killfeed online') {
        if (message.content.substring(17, 28) === 'leaderboard') {
          const query = `
            select
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus,
              (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) as score,
              row_number() over(order by (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) desc) as rankk
            from
              playersservers ps,
              players p,
              servers s
            where
              ps.pid = p.pid and ps.psstatus = 1 and ps.sid = s.sid and s.schannel = $1
            group by
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus
            order by (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) desc
          `
          const rankQuery = await db.query(query, [KILLFEED_CHANNEL_ID])
    
          if (rankQuery.rows.length > 0) {
            const canvas = createCanvas(915, (rankQuery.rows.length + 3) * 12)
            const ctx = canvas.getContext('2d')
    
            // blue outline
            ctx.fillStyle = 'rgba(0,0,25,1)'
            ctx.beginPath()
            ctx.fillRect(18, 18, 890, ((rankQuery.rows.length + 1) * 12) + 8)
            ctx.stroke()
    
            // primary dark background
            ctx.fillStyle = 'rgba(50,50,50,1)'
            ctx.beginPath()
            ctx.fillRect(20, 20, 886, ((rankQuery.rows.length + 1) * 12) + 4)
            ctx.stroke()
            
            const rows = rankQuery.rows
            const x = [{
              pname: 'survivor',
              pskills: '#kills',
              psdeaths: '#deaths',
              pskd: 'k/d',
              psdamage: 'damage',
              psmeters: 'meters',
              psheadshots: 'headshots',
              psbrainshots: 'brainshots',
              psstatus: 'status',
              score: 'score',
              rankk: 'rank'
            }, ...rows]
    
            // console.log('rowslength', rows.length, x.length)
    
            for (let i = 0; i < x.length; i++) {
              ctx.fillStyle = i % 2 > 0 ? 'rgba(15,15,15,1)' : 'rgba(50,50,50,1)'
              if (x[i].psstatus === 1) {
                ctx.fillStyle = 'rgba(0,25,0,1)'
              }
              ctx.beginPath()
              ctx.fillRect(20, (i * 12) + 3 + 20, 886, 12)
              ctx.stroke()
            }
    
    
            x.map((n, o) => {
              // console.log('for each', o)
              const keys = Object.keys(n)
              const row = keys.map((key) => {
                let j, klength, r = null
                switch (key) {
                  case 'rankk':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((4 - klength) + klength)
                    return r
                  case 'psstatus':
                    j = `${n[key] === 1 ? 'online' : 'offline'}`
                    j = `${n[key] === `status` ? 'status' : j}`
                    klength = j.length
                    r = j.padStart((7 - klength) + klength)
                    return r
                  case 'psheadshots':
                  case 'psbrainshots':
                  case 'psdeaths':
                  case 'pskills':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((10 - klength) + klength)
                    return r
                  case 'psmeters':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((11 - klength) + klength)
                    return r
                  case 'score':
                  case 'psdamage':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((13 - klength) + klength)
                    return r
                  case 'pskd':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((10 - klength) + klength)
                    return r
                  case 'pname':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padEnd((16 - klength) + klength)
                    return r
                  default:
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((16 - klength) + klength)
                    return r
                }
              }).reduce((a,c) => `${a} | ${c}`, ``)
              return row
            }).forEach((n, i) => {
              ctx.font = '10px Courier'
              ctx.fillStyle = 'white'
              ctx.fillText(`${n} |`, 20, ((i + 1) * 12) + 20)
            })
    
            const attachment = new MessageAttachment(canvas.toBuffer(), 'leaderboard.png')
            message.channel.send(attachment)
          } else {
            message.channel.send('There does not appear to be anyone online.')
          }
        } else {
          const query = `select p.pname from playersservers ps, players p, servers s where ps.pid = p.pid and ps.psstatus = 1 and ps.sid = s.sid and s.schannel = $1;`
          const rankQuery = await db.query(query, [KILLFEED_CHANNEL_ID])
          if (rankQuery.rows.length > 0) {
            console.log('>>>>>>>', rankQuery.rows)
            const survivors = rankQuery.rows
              .map(row => `${row.pname}`)
              .reduce((a,c) => {
                // console.log('reducing', `${a}${c}\n`)
                return `${a}${c}\n`
              }, ``)
            message.channel.send(`There are ${rankQuery.rows.length} survivors online.\n\`\`\`\n${survivors}\`\`\``)
          } else {
            message.channel.send('There does not appear to be anyone online.')
          }
        }
      }
      if (message.content.substring(0,14) === '!killfeed rank') {
        if (message.content.substring(15,17) === 'kd') {
          const targetPlayerName = message.content.substring(18,message.content.length)
          const rankQuery = await db.query(`
            select
              r.*, (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
            from (
              select
                ps.pskd,
                p.pname,
                row_number() over(order by ps.pskd desc) as rankk
              from
                playersservers ps,
                players p,
                servers s
              where
                ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
              group by
                ps.pskd,
                p.pname
              order by ps.pskd desc
            ) r
            where
              r.pname = $1
          `, [targetPlayerName, KILLFEED_CHANNEL_ID])
          console.log('rankQuery', rankQuery, rankQuery.rows)
          const rank = rankQuery.rows
            .reduce((a,c,i) => `Survivor _${c.pname}_ ranked ${c.rankk}/${c.of} with a ${c.pskd} k/d ratio.`, `Survivor _${targetPlayerName}_ not ranked.`)
          if (rank.length > 1) {
            message.channel.send(rank)
          } else {
            message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
          }
        } else if (message.content.substring(15,20) === 'kills') {
          const targetPlayerName = message.content.substring(21,message.content.length)
          const rankQuery = await db.query(`
            select
              r.*, (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
            from (
              select
                ps.pskills,
                p.pname,
                row_number() over(order by ps.pskills desc) as rankk
              from
                playersservers ps,
                players p,
                servers s
              where
                ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
              group by
                ps.pskills,
                p.pname
              order by ps.pskills desc
            ) r
            where
              r.pname = $1
          `, [targetPlayerName, KILLFEED_CHANNEL_ID])
          console.log('rankQuery', rankQuery, rankQuery.rows)
          const rank = rankQuery.rows
            .reduce((a,c,i) => `Survivor _${c.pname}_ ranked ${c.rankk}/${c.of} with ${c.pskills} kills.`, `Survivor _${targetPlayerName}_ not ranked.`)
          if (rank.length > 1) {
            message.channel.send(rank)
          } else {
            message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
          }
        } else if (message.content.substring(15,21) === 'deaths') {
          const targetPlayerName = message.content.substring(21,message.content.length)
          const rankQuery = await db.query(`
            select
              r.*, (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
            from (
              select
                ps.psdeaths,
                p.pname,
                row_number() over(order by ps.psdeaths desc) as rankk
              from
                playersservers ps,
                players p,
                servers s
              where
                ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
              group by
                ps.psdeaths,
                p.pname
              order by ps.psdeaths desc
            ) r
            where
              r.pname = $1
          `, [targetPlayerName, KILLFEED_CHANNEL_ID])
          console.log('rankQuery', rankQuery, rankQuery.rows)
          const rank = rankQuery.rows
            .reduce((a,c,i) => `Survivor _${c.pname}_ ranked ${c.rankk}/${c.of} with ${c.psdeaths} deaths.`, `Survivor _${targetPlayerName}_ not ranked.`)
          if (rank.length > 1) {
            message.channel.send(rank)
          } else {
            message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
          }
        } else if (message.content.substring(15,21) === 'damage') {
          const targetPlayerName = message.content.substring(22,message.content.length)
          const rankQuery = await db.query(`
            select
              r.*, (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
            from (
              select
                ps.psdamage,
                p.pname,
                row_number() over(order by ps.psdamage desc) as rankk
              from
                playersservers ps,
                players p,
                servers s
              where
                ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
              group by
                ps.psdamage,
                p.pname
              order by ps.psdamage desc
            ) r
            where
              r.pname = $1
          `, [targetPlayerName, KILLFEED_CHANNEL_ID])
          console.log('rankQuery', rankQuery, rankQuery.rows)
          const rank = rankQuery.rows
            .reduce((a,c,i) => `Survivor _${c.pname}_ ranked ${c.rankk}/${c.of} dealing ${c.psdamage} damage.`, `Survivor _${targetPlayerName}_ not ranked.`)
          if (rank.length > 1) {
            message.channel.send(rank)
          } else {
            message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
          }
        } else if (message.content.substring(15,21) === 'meters') {
          const targetPlayerName = message.content.substring(22,message.content.length)
          const rankQuery = await db.query(`
            select
              r.*, (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
            from (
              select
                ps.psmeters,
                p.pname,
                row_number() over(order by ps.psmeters desc) as rankk
              from
                playersservers ps,
                players p,
                servers s
              where
                ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
              group by
                ps.psmeters,
                p.pname
              order by ps.psmeters desc
            ) r
            where
              r.pname = $1
          `, [targetPlayerName, KILLFEED_CHANNEL_ID])
          console.log('rankQuery', rankQuery, rankQuery.rows)
          const rank = rankQuery.rows
            .reduce((a,c,i) => `Survivor _${c.pname}_ ranked ${c.rankk}/${c.of} with their longest shot from ${c.psmeters} meters.`, `Survivor _${targetPlayerName}_ not ranked.`)
          if (rank.length > 1) {
            message.channel.send(rank)
          } else {
            message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
          }
        } else if (message.content.substring(15,24) === 'headshots') {
          const targetPlayerName = message.content.substring(25,message.content.length)
          const rankQuery = await db.query(`
            select
              r.*, (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
            from (
              select
                ps.psheadshots,
                p.pname,
                row_number() over(order by ps.psheadshots desc) as rankk
              from
                playersservers ps,
                players p,
                servers s
              where
                ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
              group by
                ps.psheadshots,
                p.pname
              order by ps.psheadshots desc
            ) r
            where
              r.pname = $1
          `, [targetPlayerName, KILLFEED_CHANNEL_ID])
          console.log('rankQuery', rankQuery, rankQuery.rows)
          const rank = rankQuery.rows
            .reduce((a,c,i) => `Survivor _${c.pname}_ ranked ${c.rankk}/${c.of} with ${c.psheadshots} headshots.`, `Survivor _${targetPlayerName}_ not ranked.`)
          if (rank.length > 1) {
            message.channel.send(rank)
          } else {
            message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
          }
        } else if (message.content.substring(15,25) === 'brainshots') {
          const targetPlayerName = message.content.substring(25,message.content.length)
          const rankQuery = await db.query(`
            select
              r.*, (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
            from (
              select
                ps.psbrainshots,
                p.pname,
                row_number() over(order by ps.psbrainshots desc) as rankk
              from
                playersservers ps,
                players p,
                servers s
              where
                ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
              group by
                ps.psbrainshots,
                p.pname
              order by ps.psbrainshots desc
            ) r
            where
              r.pname = $1
          `, [targetPlayerName, KILLFEED_CHANNEL_ID])
          console.log('rankQuery', rankQuery, rankQuery.rows)
          const rank = rankQuery.rows
            .reduce((a,c,i) => `Survivor _${c.pname}_ ranked ${c.rankk}/${c.of} with ${c.psbrainshots} brainshots.`, `Survivor _${targetPlayerName}_ not ranked.`)
          if (rank.length > 1) {
            message.channel.send(rank)
          } else {
            message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
          }
        } else if (message.content.substring(15,26) === 'leaderboard') {
          const targetPlayerName = message.content.substring(27,message.content.length)
          const rankQuery = await db.query(`
            select * from (
              select
                p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus,
                (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) as score,
                row_number() over(order by (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) desc) as rankk,
                (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $2) as of
              from
                playersservers ps,
                players p,
                servers s
              where
                ps.pid = p.pid and ps.sid = s.sid and s.schannel = $2
              group by
                p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus
              order by (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) desc
            ) as leaderboard where leaderboard.pname = $1
          `, [targetPlayerName, KILLFEED_CHANNEL_ID])
          const placementString = rankQuery.rows
            .reduce((a,c,i) => `Survivor _${c.pname}_ ranked ${c.rankk}/${c.of} with ${c.pskills} kills, ${c.psdeaths} deaths, for a ${c.pskd} k/d, dealing ${c.psdamage} damage, with their longest kill shot from ${c.psmeters} meters, as well as ${c.psheadshots} headshots, and ${c.psbrainshots} brainshots for an overall score of ${c.score} points.`, `Survivor _${targetPlayerName}_ not ranked.`)
          if (placementString.length > 1) {
            const placement = rankQuery.rows.reduce((a,c) => c, {})
            const rank = placement.rankk
            const desc = rankQuery.rows
              .reduce((a,c,i) => `with ${c.pskills} kills, ${c.psdeaths} deaths, for a ${c.pskd} k/d, dealing ${c.psdamage} damage, their longest kill shot from ${c.psmeters} meters, as well as ${c.psheadshots} headshots, and ${c.psbrainshots} brainshots for an overall score of ${c.score} points.`, `Survivor _${targetPlayerName}_ not ranked.`)
            if (parseInt(rank) === 1) {
              const embed = new MessageEmbed()
                .setTitle(`${placement.pname} is ranked ${rank} of out of ${placement.of} survivors`)
                .setFooter('brought to you by archaeon', 'attachment://th-archaeon-db-purple.png')
                .setColor('#000000')
                .setTimestamp()
                .setDescription({ text: desc })
                .attachFiles(['./src/assets/th-archaeon-db-purple.png', './src/assets/rank-first.png'])
                .setThumbnail('attachment://rank-first.png')
              message.channel.send(embed)
            } else if (parseInt(rank) === 2) {
              const embed = new MessageEmbed()
                .setTitle(`${placement.pname} is ranked ${rank} of out of ${placement.of} survivors`)
                .setFooter('brought to you by archaeon', 'attachment://th-archaeon-db-purple.png')
                .setColor('#000000')
                .setTimestamp()
                .setDescription({ text: desc })
                .attachFiles(['./src/assets/th-archaeon-db-purple.png', './src/assets/rank-second.png'])
                .setThumbnail('attachment://rank-second.png')
              message.channel.send(embed)
            } else if (parseInt(rank) === 3) {
              const embed = new MessageEmbed()
                .setTitle(`${placement.pname} is ranked ${rank} of out of ${placement.of} survivors`)
                .setFooter('brought to you by archaeon', 'attachment://th-archaeon-db-purple.png')
                .setColor('#000000')
                .setTimestamp()
                .setDescription({ text: desc })
                .attachFiles(['./src/assets/th-archaeon-db-purple.png', './src/assets/rank-third.png'])
                .setThumbnail('attachment://rank-third.png')
              message.channel.send(embed)
            } else {
              message.channel.send(placementString)
            }
          } else {
            message.channel.send(`Survivor _${targetPlayerName}_ not ranked.`)
          }
        } else {
          message.channel.send(`usage: !killfeed rank <kd,kills,deaths,damage,meters,headshots,brainshots,leaderboard> <survivor-name> \n\te.g., !killfeed rank kd sundaysatan\n\tnote: player names are case sensitive`)
        }
      }
      if (message.content.substring(0,21) === '!killfeed leaderboard') {
        if (message.content.substring(22,24) === 'kd') {
          const rankQuery = await db.query(`
            select
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus,
              (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) as score,
              row_number() over(order by ps.pskd desc) as rankk,
              (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $1) as of
            from
              playersservers ps,
              players p,
              servers s
            where
              ps.pid = p.pid and ps.sid = s.sid and s.schannel = $1
            group by
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus
            order by ps.pskd desc
            limit 50
          `, [KILLFEED_CHANNEL_ID])
    
          if (rankQuery.rows.length > 0) {
            const canvas = createCanvas(915, 640)
            const ctx = canvas.getContext('2d')
    
            ctx.fillStyle = 'rgba(0,0,25,1)'
            ctx.beginPath()
            ctx.fillRect(18, 18, 890, 608)
            ctx.stroke()
    
            ctx.fillStyle = 'rgba(50,50,50,1)'
            ctx.beginPath()
            ctx.fillRect(20, 20, 886, 600 + 4)
            ctx.stroke()
            
            rankQuery.rows.pop()
            const rows = rankQuery.rows
            const x = [{
              pname: 'survivor',
              pskills: '#kills',
              psdeaths: '#deaths',
              pskd: 'k/d',
              psdamage: 'damage',
              psmeters: 'meters',
              psheadshots: 'headshots',
              psbrainshots: 'brainshots',
              psstatus: 'status',
              score: 'score',
              rankk: 'rank'
            }, ...rows]
    
            for (let i = 1; i < 50; i++) {
              ctx.fillStyle = i % 2 > 0 ? 'rgba(15,0,0,1)' : 'rgba(50,50,50,1)'
              if (rows[i-1].psstatus === 1) {
                ctx.fillStyle = 'rgba(0,25,0,1)'
              }
              ctx.beginPath()
              ctx.fillRect(20, (i * 12) + 3 + 20, 886, 12)
              ctx.stroke()
            }
    
            x.map((n) => {
              const keys = Object.keys(n)
              const row = keys.map((key) => {
                let j, klength, r = null
                switch (key) {
                  case 'rankk':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((4 - klength) + klength)
                    return r
                  case 'psstatus':
                    j = `${n[key] === 1 ? 'online' : 'offline'}`
                    j = `${n[key] === `status` ? 'status' : j}`
                    klength = j.length
                    r = j.padStart((7 - klength) + klength)
                    return r
                  case 'psheadshots':
                  case 'psbrainshots':
                  case 'psdeaths':
                  case 'pskills':
                  case 'psmeters':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((10 - klength) + klength)
                    return r
                  case 'score':
                  case 'psdamage':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((13 - klength) + klength)
                    return r
                  case 'pskd':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((10 - klength) + klength)
                    return r
                  case 'pname':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padEnd((16 - klength) + klength)
                    return r
                  default:
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((16 - klength) + klength)
                    return r
                }
              }).reduce((a,c) => `${a} | ${c}`, ``)
              return row
            }).forEach((n, i) => {
              // write the text
              ctx.font = '10px Courier'
              ctx.fillStyle = 'white'
              ctx.fillText(`${n} |`, 20, ((i + 1) * 12) + 20)
            })
    
            const attachment = new MessageAttachment(canvas.toBuffer(), 'leaderboard.png')
            const embed = new MessageEmbed()
              .setTitle(`k/d leaderboard, out of ${x[1].of} survivors`)
              .setFooter('brought to you by archaeon', 'attachment://th-archaeon-db-purple.png')
              .setColor('#000000')
              .setDescription('rows in green signify players currently online, score is the same as leaderboard')
              .attachFiles(['./src/assets/th-archaeon-db-purple.png', './src/assets/leaderboard-rank.png', attachment])
              .setThumbnail('attachment://leaderboard-rank.png')
              .setImage('attachment://leaderboard.png')
            message.channel.send(embed)
          }
        } else if (message.content.substring(22,28) === 'meters') {
          const rankQuery = await db.query(`
            select
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus,
              (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) as score,
              row_number() over(order by ps.psmeters desc) as rankk,
              (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $1) as of
            from
              playersservers ps,
              players p,
              servers s
            where
              ps.pid = p.pid and ps.sid = s.sid and s.schannel = $1
            group by
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus
            order by ps.psmeters desc
            limit 50
          `, [KILLFEED_CHANNEL_ID])
    
          if (rankQuery.rows.length > 0) {
            const canvas = createCanvas(915, 640)
            const ctx = canvas.getContext('2d')
    
            ctx.font = '10px Courier'
            ctx.fillStyle = 'rgba(0,0,25,1)'
            ctx.beginPath()
            ctx.fillRect(18, 18, 890, 608)
            ctx.stroke()
    
            ctx.fillStyle = 'rgba(50,50,50,1)'
            ctx.beginPath()
            ctx.fillRect(20, 20, 886, 600 + 4)
            ctx.stroke()
            
            rankQuery.rows.pop()
            const rows = rankQuery.rows
            const x = [{
              pname: 'survivor',
              pskills: '#kills',
              psdeaths: '#deaths',
              pskd: 'k/d',
              psdamage: 'damage',
              psmeters: 'meters',
              psheadshots: 'headshots',
              psbrainshots: 'brainshots',
              psstatus: 'status',
              score: 'score',
              rankk: 'rank'
            }, ...rows]
    
            for (let i = 1; i < 50; i++) {
              ctx.fillStyle = i % 2 > 0 ? 'rgba(15,0,0,1)' : 'rgba(50,50,50,1)'
              if (rows[i-1].psstatus === 1) {
                ctx.fillStyle = 'rgba(0,25,0,1)'
              }
              ctx.beginPath()
              ctx.fillRect(20, (i * 12) + 3 + 20, 886, 12)
              ctx.stroke()
            }
    
            x.map((n) => {
              const keys = Object.keys(n)
              const row = keys.map((key) => {
                let j, klength, r = null
                switch (key) {
                  case 'rankk':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((4 - klength) + klength)
                    return r
                  case 'psstatus':
                    j = `${n[key] === 1 ? 'online' : 'offline'}`
                    j = `${n[key] === `status` ? 'status' : j}`
                    klength = j.length
                    r = j.padStart((7 - klength) + klength)
                    return r
                  case 'psheadshots':
                  case 'psbrainshots':
                  case 'psdeaths':
                  case 'pskills':
                  case 'psmeters':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((10 - klength) + klength)
                    return r
                  case 'score':
                  case 'psdamage':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((13 - klength) + klength)
                    return r
                  case 'pskd':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((10 - klength) + klength)
                    return r
                  case 'pname':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padEnd((16 - klength) + klength)
                    return r
                  default:
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((16 - klength) + klength)
                    return r
                }
              }).reduce((a,c) => `${a} | ${c}`, ``)
              return row
            }).forEach((n, i) => {
              // write the text
              ctx.font = '10px Courier'
              ctx.fillStyle = 'white'
              ctx.fillText(`${n} |`, 20, ((i + 1) * 12) + 20)
            })
    
            const attachment = new MessageAttachment(canvas.toBuffer(), 'leaderboard.png')
            const embed = new MessageEmbed()
              .setTitle(`meters leaderboard, out of ${x[1].of} survivors`)
              .setFooter('brought to you by archaeon', 'attachment://th-archaeon-db-purple.png')
              .setColor('#000000')
              .setDescription('longest killshot, rows in green signify players currently online, score is the same as leaderboard')
              .attachFiles(['./src/assets/th-archaeon-db-purple.png', './src/assets/leaderboard-rank.png', attachment])
              .setThumbnail('attachment://leaderboard-rank.png')
              .setImage('attachment://leaderboard.png')
            message.channel.send(embed)
          }
        } else {
          const rankQuery = await db.query(`
            select
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus,
              (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) as score,
              row_number() over(order by (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) desc) as rankk,
              (select count(*) from playersservers ps, servers s where ps.sid = s.sid and s.schannel = $1) as of
            from
              playersservers ps,
              players p,
              servers s
            where
              ps.pid = p.pid and ps.sid = s.sid and s.schannel = $1
            group by
              p.pname, ps.pskills, ps.psdeaths, ps.pskd, ps.psdamage, ps.psmeters, ps.psheadshots, ps.psbrainshots, ps.psstatus
            order by (ps.psheadshots + ps.psbrainshots + ps.pskd + (ps.psmeters * 0.005) + (ps.psdamage * 0.005) + ps.pskills - ps.psdeaths) desc
            limit 50
          `, [KILLFEED_CHANNEL_ID])
    
          if (rankQuery.rows.length > 0) {
            const canvas = createCanvas(915, 640)
            const ctx = canvas.getContext('2d')
    
            ctx.fillStyle = 'rgba(0,0,25,1)'
            ctx.beginPath()
            ctx.fillRect(18, 18, 890, 608)
            ctx.stroke()
    
            ctx.fillStyle = 'rgba(50,50,50,1)'
            ctx.beginPath()
            ctx.fillRect(20, 20, 886, 600 + 4)
            ctx.stroke()
            
            // rankQuery.rows.pop()
            const rows = rankQuery.rows
            const x = [{
              pname: 'survivor',
              pskills: '#kills',
              psdeaths: '#deaths',
              pskd: 'k/d',
              psdamage: 'damage',
              psmeters: 'meters',
              psheadshots: 'headshots',
              psbrainshots: 'brainshots',
              psstatus: 'status',
              score: 'score',
              rankk: 'rank'
            }, ...rows]
    
            for (let i = 0; i < 50; i++) {
              ctx.fillStyle = i % 2 > 0 ? 'rgba(15,0,0,1)' : 'rgba(50,50,50,1)'
              if (rows[i-1] && rows[i-1].psstatus === 1) {
                ctx.fillStyle = 'rgba(0,25,0,1)'
              }
              ctx.beginPath()
              ctx.fillRect(20, (i * 12) + 3 + 20, 886, 12)
              ctx.stroke()
            }
    
            x.map((n) => {
              const keys = Object.keys(n)
              const row = keys.map((key) => {
                let j, klength, r = null
                switch (key) {
                  case 'rankk':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((4 - klength) + klength)
                    return r
                  case 'psstatus':
                    j = `${n[key] === 1 ? 'online' : 'offline'}`
                    j = `${n[key] === `status` ? 'status' : j}`
                    klength = j.length
                    r = j.padStart((7 - klength) + klength)
                    return r
                  case 'psheadshots':
                  case 'psbrainshots':
                  case 'psdeaths':
                  case 'pskills':
                  case 'psmeters':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((10 - klength) + klength)
                    return r
                  case 'score':
                  case 'psdamage':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((13 - klength) + klength)
                    return r
                  case 'pskd':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((10 - klength) + klength)
                    return r
                  case 'pname':
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padEnd((16 - klength) + klength)
                    return r
                  default:
                    j = `${n[key]}`
                    klength = j.length
                    r = j.padStart((16 - klength) + klength)
                    return r
                }
              }).reduce((a,c) => `${a} | ${c}`, ``)
              return row
            }).forEach((n, i) => {
              // write the text
              ctx.font = '10px Courier'
              ctx.fillStyle = 'white'
              ctx.fillText(`${n} |`, 20, ((i + 1) * 12) + 20)
            })
    
            const attachment = new MessageAttachment(canvas.toBuffer(), 'leaderboard.png')
            const embed = new MessageEmbed()
              .setTitle(`leaderboard by overall score, out of ${x[1].of} survivors`)
              .setFooter('brought to you by archaeon', 'attachment://th-archaeon-db-purple.png')
              .setColor('#000000')
              .setDescription('Score is determined by an aggregate of survivor stats to ensure fairness.')
              .attachFiles(['./src/assets/th-archaeon-db-purple.png', './src/assets/th-leaderboard-gold.png', attachment])
              .setThumbnail('attachment://th-leaderboard-gold.png')
              .setImage('attachment://leaderboard.png')
            message.channel.send(embed)
          }
        }
      }
    }

  }
}

// module.exports = {
//   getOnMessageHandler
// }