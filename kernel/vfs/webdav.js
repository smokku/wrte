export default function () {
  let init

  function buildUrl (opts) {
    const { volume, argv } = opts
    const schema = argv.secure ? 'https' : 'http'
    let { path } = opts
    if (!Array.isArray(argv) || !argv.includes('with-host')) {
      if (!argv.auth || !argv.auth.host) {
        throw new Error(`No auth data for ${volume}:`)
      }
      path = [argv.auth.host, path].join('/')
    }
    return [schema, path].join('://')
  }

  global.onmessage = (evt) => {
    const { data } = evt
    // console.debug('[webdav:]', data)
    if (data.type === 'INIT' && !init) {
      init = data.payload
      global.console.log(`[webdav:] started ${JSON.stringify(init.argv)}`)
    } else if (data.type === 'ERROR') {
      global.console.warn(`[webdav:] ERROR: ${JSON.stringify(data.payload)}`)
    } else if (data.type === 'READ') {
      const url = buildUrl(data.handler)
      global.console.debug('[webdav:] fetching', url)
      fetch(url)
        .then((resp) => {
          if (resp.ok) {
            return resp.arrayBuffer()
          }
          global.postMessage({
            type: 'ERROR',
            process: data.process,
            payload: {
              type: resp.status === 404 ? 'ENOENT' : 'EPERM',
              path: data.path,
            },
          })
          return null
        })
        .then((resp) => {
          if (resp) {
            global.postMessage(
              {
                type: 'DATA',
                process: data.process,
                payload: resp,
                id: data.id,
              },
              [resp]
            )
          }
        })
        .catch(() => {
          global.postMessage({
            type: 'ERROR',
            process: data.process,
            payload: {
              type: 'EFAULT',
              path: data.path,
            },
          })
        })
    } else {
      global.console.warn(`[webdav:] ${JSON.stringify(data)}`)
      global.postMessage({
        type: 'ERROR',
        process: data.process,
        payload: {
          type: 'EOPNOTSUPP',
          path: data.path,
        },
      })
    }
  }
}
