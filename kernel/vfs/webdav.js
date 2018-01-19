export default function () {
  let argv
  self.onmessage = (evt) => {
    const { data } = evt
    // console.debug('[webdav:]', data)
    if (data.type === 'INIT' && !argv) {
      ({ argv } = data.payload)
      self.console.log(`[webdav:] started ${JSON.stringify(argv)}`)
    } else if (data.type === 'ERROR') {
      self.console.warn(`[webdav:] ERROR: ${JSON.stringify(data.payload)}`)
    } else {
      self.console.log(`[webdav:] ${JSON.stringify(data)}`)
      self.postMessage({
        type: 'ERROR',
        process: data.process,
        payload: {
          type: 'ENOENT',
          path: data.path,
        },
      })
    }
  }
}
