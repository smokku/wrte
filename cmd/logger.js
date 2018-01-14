global.onmessage = evt => global.console.log(`[logger] ${JSON.stringify(evt.data)}`)
global.console.log('[logger] started')
