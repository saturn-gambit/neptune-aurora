import https from 'https'
import xml2js from 'xml2js'

export const busy = () => setInterval(() => process.stdout.write(`.`), 1000)

export const wait = (minutes = 1) => {
  return new Promise(r => setTimeout(r, minutes * 60000))
}

export const fetch = async (url, options) => {
  return new Promise((resolve, reject) => {
    let data = ``
    const { body, ...rest } = options
    const request = https.request(rest, (response) => {
      response.on('data', (chunk) => data = `${data}${chunk}`)
      response.on('end', () => resolve({
          data,
          text: () => {
            try {
              const text = data
              return Promise.resolve(text)
            } catch (error) {
              return Promise.reject()
            }
          },
          json: () => {
            try {
              const json = JSON.parse(data)
              return Promise.resolve(json)
            } catch (error) {
              return Promise.reject(error)
            }
          }
      }))
    })
    request.on('error', (error) => reject(error))
    if (body) {
      request.write(body)
    }
    request.end()
  })
}

export const getJsFromXml = async (xmlString) => {
  return new Promise((resolve, reject) => {
      const parser = new xml2js.Parser()
      parser.parseString(xmlString, (error, results) => {
          resolve(results)
      })
  })
}

export const getStringFromJs = async (js) => {
  return new Promise((resolve, reject) => {
      const builder = new xml2js.Builder({ renderOpts: { 'pretty': true, 'indent': `    `, 'newLine': `\n` } })
      const xmlStringFromJs = builder.buildObject({ ...js })
      resolve(xmlStringFromJs)
  })
}

export class NitradoRESTClient {

  constructor (apiKey) {
    this.apiKey = apiKey
  }

  async get_services () {
    const response = await this.request('GET', '/services')
    const services_dto = await response.json()
    const { services } = services_dto.data
    return services
  }

  async get_gameserver (service_id) {
    const response = await this.request('GET', `/services/${service_id}/gameservers`)
    const gameserver_dto = await response.json()
    const { gameserver } = gameserver_dto.data
    return gameserver
  }

  async stop_gameserver (service_id) {
    const response = await this.request('POST', `/services/${service_id}/gameservers/stop`)
    const stop_gameserver_dto = await response.json()
    return stop_gameserver_dto
  }

  async start_gameserver (service_id) {
    const response = await this.request('POST', `/services/${service_id}/gameservers/restart`)
    const start_gameserver_dto = await response.json()
    return start_gameserver_dto
  }

  async get_download (service_id, file) {
    const response = await this.request('GET', `/services/${service_id}/gameservers/file_server/download?file=${file}`)
    const download_dto = await response.json()
    const download = download_dto.data
    return download
  }

  async get_upload (service_id, file) {
    const split = file.split('/')
    const file_name = split[split.length-1]
    const path = split.filter(s => s !== file_name).join('/')
    const response = await this.request('POST', `/services/${service_id}/gameservers/file_server/upload?path=${path}&file=${file_name}`)
    const upload_dto = await response.json()
    const upload = upload_dto.data
    return upload
  }

  async get_file (url, token) {
    const response = await this.request_file(url, token)
    const file = await response.text()
    return file
  }

  async post_file (url, token, content_type, body) {
    const response = await this.request_file_post('POST', url, content_type, body, token)
    return response
  }

  async get_file_list (service_id, dir) {
    const response = await this.request('GET', `/services/${service_id}/gameservers/file_server/list${dir ? `?dir=${dir}` : ``}`)
    const file_list_dto = await response.json()
    const { entries } = file_list_dto.data
    return entries
  }

  async request (method, path, content_type, body, token) {
    const headers = {
      ...body ? { 'Content-Type': content_type, 'Content-Length': body.length } : {},
      ...!token ? {'Authorization': `Bearer ${this.apiKey}`} : { token }
    }
    const options = {
      hostname: 'api.nitrado.net',
      port: 443,
      path,
      method,
      headers,
      ...body ? {body} : {}
    }
    const url = `https://${options.hostname}${options.path}`
    const response = await fetch(url, options)
    console.log('======================================================')
    console.log(response, url, options)
    return response
  }

  async request_file_post (method, url, content_type, body, token) {
    const path = url.split('https://').join('').split('fileserver.nitrado.net').join('')
    const headers = {
      ...body ? { 'Content-Type': content_type, 'Content-Length': body.length } : {},
      ...!token ? {'Authorization': `Bearer ${this.apiKey}`} : { token }
    }
    const options = {
      hostname: 'fileserver.nitrado.net',
      port: 443,
      path,
      method,
      headers,
      ...body ? {body} : {}
    }
    const _url = `https://${options.hostname}${options.path}`
    const response = await fetch(_url, options)
    return response
  }

  async request_file (url, token) {
    const path = url.split('https://').join('').split('fileserver.nitrado.net').join('')
    const options = {
      hostname: 'fileserver.nitrado.net',
      port: 443,
      path,
      method: 'GET'
    }
    const response = await fetch(url, options)
    return response
  }

}

export class NitradoClient {
  constructor (api_key) {
    this.api_key = api_key
    this.nitrado_rest_client = new NitradoRESTClient(this.api_key)
  }
  get_gameserver_by_sid (service_id) {
    return new Promise(async (resolve, reject) => {
      try {
        const gameserver = await this.nitrado_rest_client.get_gameserver(service_id)
        resolve(gameserver)
      } catch (error) {
        reject(error)
      }
    })
  }
  get_nitrado_file (nitrado_gameserver, file_path) {
    return new Promise(async (resolve, reject) => {
      try {
        const nitrado_file = new NitradoFile(this, nitrado_gameserver, file_path)
        resolve(nitrado_file)
      } catch (error) {
        reject(error)
      }
    })
  }
  get_download (nitrado_file) {
    return new Promise(async (resolve, reject) => {
      try {
        const download = await this.nitrado_rest_client.get_download(nitrado_file.nitrado_gameserver.service_id, nitrado_file.file_path)
        resolve(download)
      } catch (error) {
        reject(error)
      }
    })
  }
  get_upload (nitrado_file) {
    return new Promise(async (resolve, reject) => {
      try {
        const upload = await this.nitrado_rest_client.get_upload(nitrado_file.nitrado_gameserver.service_id, nitrado_file.file_path)
        resolve(upload)
      } catch (error) {
        reject(error)
      }
    })
  }
  get_file (url, token) {
    return new Promise(async (resolve, reject) => {
      try {
        const file = await this.nitrado_rest_client.get_file(url, token)
        resolve(file)
      } catch (error) {
        reject(error)
      }
    })
  }
  post_file (url, token, nitrado_file) {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await this.nitrado_rest_client.post_file(url, token, nitrado_file.content_type, Buffer.from(nitrado_file.file, 'utf-8'))
        resolve(response)
      } catch (error) {
        reject(error)
      }
    })
  }
  stop_gameserver (nitrado_gameserver) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('req stopping server...')
        await this.nitrado_rest_client.stop_gameserver(nitrado_gameserver.service_id)
        console.log('requested to stop..')
        await new Promise((r, j) => {
          const i = setInterval(async () => {
            console.log('polling status...')
            const gameserver = await this.get_gameserver_by_sid(nitrado_gameserver.service_id)
            console.log(gameserver.status)
            if (gameserver && gameserver.status === 'stopped') {
              clearInterval(i)
              r()
            }
          }, 15000)
        })
        resolve(undefined)
      } catch (error) {
        reject(error)
      }
    })
  }
  start_gameserver (nitrado_gameserver) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('req starting server...')
        await this.nitrado_rest_client.start_gameserver(nitrado_gameserver.service_id)
        console.log('requested to start..')
        await new Promise((r, j) => {
          const i = setInterval(async () => {
            console.log('polling status...')
            const gameserver = await this.get_gameserver_by_sid(nitrado_gameserver.service_id)
            console.log(gameserver.status)
            if (gameserver && gameserver.status === 'started') {
              clearInterval(i)
              r()
            }
          }, 15000)
        })
        resolve(undefined)
      } catch (error) {
        reject(error)
      }
    })
  }
}

export class NitradoFile {
  constructor (nitrado_client, nitrado_gameserver, file_path) {
    this.file = undefined
    this.nitrado_client = nitrado_client
    this.nitrado_gameserver = nitrado_gameserver
    this.file_path = file_path
    const split = file_path.split('.')
    this.content_type = split[split.length-1]
  }
  pull () {
    return new Promise(async (resolve, reject) => {
      try {
        const download = await this.nitrado_client.get_download(this)
        const { token: { url, token } } = download
        const file = await this.nitrado_client.get_file(url, token)
        this.file = file
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }
  push () {
    return new Promise(async (resolve, reject) => {
      try {
        const upload = await this.nitrado_client.get_upload(this)
        const { token: { url, token } } = upload
        const response = await this.nitrado_client.post_file(url, token, this)
        resolve(response)
      } catch (error) {
        reject(error)
      }
    })
  }
  toggle_events (event_name, event_value) {
    return new Promise(async (resolve, reject) => {
      try {
        const xmlString = this.file
        const xmlAsJs = await getJsFromXml(xmlString)
        const regexp = new RegExp(event_name)
        xmlAsJs.events.event = xmlAsJs.events.event.map((event) => {
          if (event.$.name.match(regexp)) {
            const toggledEvent = {
              ...event,
              active: [`${event_value}`]
            }
            return toggledEvent
          } else {
            return event
          }
        })
        const jsAsXmlString = await getStringFromJs(xmlAsJs)
        this.file = jsAsXmlString
        resolve(undefined)
      } catch (error) {
        reject(error)
      }
    })
  }
  toggle_base_damage (toggle_value) {
    return new Promise(async (resolve, reject) => {
      try {
        const json_string = this.file
        const json = JSON.parse(json_string)
        json.GeneralData.disableBaseDamage = toggle_value
        const new_json_string = JSON.stringify(json, null, 2)
        this.file = new_json_string
        resolve(undefined)
      } catch (error) {
        reject(error)
      }
    })
  }
}

// module.exports = {
//   busy,
//   wait,
//   fetch,
//   getJsFromXml,
//   getStringFromJs,
//   NitradoRESTClient,
//   NitradoClient,
//   NitradoFile
// }