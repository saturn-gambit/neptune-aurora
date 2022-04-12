export const randomString = function (len) {
  var buf = []
    , chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    , charlen = chars.length;

  for (var i = 0; i < len; ++i) {
    buf.push(chars[getRandomInt(0, charlen - 1)]);
  }

  return buf.join('');
};

export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class Uint8ArrayToStringsTransformer {
  constructor() {
    this.decoder = new TextDecoder()
    this.lastString = ''
  }

  /**
   * Receives the next Uint8Array chunk from `fetch` and transforms it.
   *
   * @param {Uint8Array} chunk The next binary data chunk.
   * @param {TransformStreamDefaultController} controller The controller to enqueue the transformed chunks to.
   */
  transform(chunk, controller) {
    // console.log('Received chunk %o with %d bytes.', chunk, chunk.byteLength)

    // Decode the current chunk to string and prepend the last string
    const string = `${this.lastString}${this.decoder.decode(chunk)}`

    // Extract lines from chunk
    const lines = string.split(/\r\n|[\r\n]/g)

    // Save last line, as it might be incomplete
    this.lastString = lines.pop() || ''

    // Enqueue each line in the next chunk
    for (const line of lines) {
      controller.enqueue(line)
    }
  }

  /**
   * Is called when `fetch` has finished writing to this transform stream.
   *
   * @param {TransformStreamDefaultController} controller The controller to enqueue the transformed chunks to.
   */
  flush(controller) {
    // Is there still a line left? Enqueue it
    if (this.lastString) {
      controller.enqueue(this.lastString)
    }
  }
}

export const EXPERIMENTAL_SERVER_ID = '5370029'

import request from 'request'
import WebSocket from 'ws'

export const asyncForEach = async (A, cb) => {
  for (let i = 0; i < A.length; i++) {
    await cb(A[i], i, A)
  }
}

export const doNitradoFileServerApi = (method, url, token, file, resolve, reject) => {
  const options = {
    'method': method,
    'url': url,
    'headers': {
      'token': token
    },
    'encoding': null,
    'body': file
  }
  request(options, (error, response) => { 
    if (error) reject(error)
    resolve(response)
  })
}

export const doNitradoFileServerApiProper = (method, url, token, resolve, reject) => {
  console.log('doNitradoFileServerApiProper', method, url, token)
  const options = {
    'method': method,
    'url': url,
    'headers': {
      'token': token
    }
  }
  request(options, (error, response) => { 
    if (error) reject(error)
    resolve(response)
  })
}

export const doNitradoApi = (method, path, resolve, reject, authBearer) => {
  const options = {
    'method': method,
    'url': `https://api.nitrado.net${path}`,
    'headers': {
      'Authorization': `Bearer ${authBearer}`
    }
  }
  request(options, (error, response) => { 
    if (error) reject(error)
    resolve(response)
  })
}

export const doNitradoFileServer = (method, path, resolve, reject) => {
  const options = {
    'method': method,
    'url': path
  }
  request(options, (error, response) => { 
    if (error) reject(error)
    resolve(response)
  })
}

export const getServices = () => new Promise((resolve, reject) => {
  doNitradoApi('GET', `/services`, (response) => {
    const { body } = response
    const pojo = JSON.parse(body)
    const services = pojo.data.services
    resolve(services)
  }, reject)
})

export const getGameserver = (service, authBearer) => new Promise((resolve, reject) => {
  console.log('authBearer', authBearer)
  const method = 'GET'
  const url = `/services/${service.id}/gameservers`
  console.log(`** ${method}ing ${url}`)
  doNitradoApi(method, url, (response) => {
    console.log('gameserver response', url)
    try {
      const { body } = response
      const pojo = JSON.parse(body)
      const gameserver = pojo.data ? pojo.data.gameserver : { ...pojo, settings: { config: { hostname: `suspended` } } }
      resolve(gameserver)
    } catch (e) {
      reject(e)
    }
  }, reject, authBearer)
})

export const main1 = async () => {
  // const services = await getServices()
  // asyncForEach(services, async (service, serviceIndex) => {
  //   const gameserver = await getGameserver(service)
  //   // console.log('gameserver', gameserver)
  //   services[serviceIndex] = {
  //     ...services[serviceIndex],
  //     gameserver
  //   }
  // })
  // console.log(services.map(service => service))
}

export const getWsConnection = (service) => new Promise((resolve, reject) => {
  const { id, websocket_token } = service
  const ws = new WebSocket('wss://websocket.nitrado.net/')
  ws.on('open', () => {
    console.log(`> opened connection to ${id}!`)
    const pojo = {
      action: 'login',
      data: {
        service_id: id,
        label: 'ni',
        token: websocket_token
      }
    }
    const jsonString = JSON.stringify(pojo)
    ws.send(jsonString)
    resolve(ws)
  })
  ws.on('close', () => {
    console.log(`> closed connection to ${id}!`)
    reject(ws)
  })
  // ws.on('message', (data) => {
  //   console.log(`> incoming from ${id}:`, data)
  // })
})

export const reinstallServer = (service) => new Promise((resolve, reject) => {
  const method = 'POST'
  const url = `/services/${service.id}/gameservers/games/install?game=dayzxb`
  // console.log(`** ${method}ing ${url}`)
  doNitradoApi(method, url, (response) => {
    // console.log('response', response.body)
    const { body } = response
    const pojo = JSON.parse(body)
    const result = pojo
    resolve(result)
  }, reject)
})

export const serverOnline = (serverId) => new Promise((resolve, reject) => {

})

export const getServerFileList = (service) => new Promise((resolve, reject) => {
  // /file_server/list  
  const method = 'GET'
  const url = `/services/${service.id}/gameservers/file_server/list`
  // console.log(`** ${method}ing ${url}`)
  doNitradoApi(method, url, (response) => {
    // console.log('response', response.body)
    const { body } = response
    const pojo = JSON.parse(body)
    const result = pojo.data ? pojo.data.entries : []
    resolve(result)
  }, reject)
})

export const main = async (serverId) => {
  console.log(`** getting services for ${serverId}...`)
  const services = await getServices()
  const service = services.filter(service => `${service.id}` === serverId).reduce((a,c) => c, {})
  if (service.id) {
    console.log(`** got service for ${serverId}!`)
    console.log('** attempting socket connection...', service.id, service.websocket_token)
    const wsConnection = await getWsConnection(service)
    console.log('** got connection ready state:', wsConnection.readyState)
    wsConnection.on('message', (data) => {
      console.log(`> incoming from ${service.id}:`, data)
    })
    const serverFileList = await getServerFileList(service)
    console.log(serverFileList)
    // const reinstallServerResult = await reinstallServer(service)
    // console.log('reinstallServerResult', reinstallServerResult)
    // if (reinstallServerResult.status && reinstallServerResult.status === 'success') {
    //   await serverOnline(service)
    //   await stopServer(service)
    //   await uploadFtpFiles(service, files)
    //   await configureSettings(service, settings)
    //   await startServer(service)
    // } else {
    //   console.log('no install', reinstallServerResult)
    // }
  } else {
    console.log('no service found')
  }
}

// main(EXPERIMENTAL_SERVER_ID).catch(e => console.log('error:', e))

// console.log(`Done!`)

// export 

// module.exports = {
//   doNitradoFileServerApiProper,
//   randomString,
//   Uint8ArrayToStringsTransformer,
//   doNitradoFileServerApi,
//   getWsConnection,
//   getGameserver,
//   doNitradoFileServer,
//   doNitradoApi
// }
