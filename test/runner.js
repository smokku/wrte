// @flow
/* eslint-disable global-require, no-console, unicorn/no-process-exit */
(async () => {
  const puppeteer = require('puppeteer-core')
  const liveServer = require('live-server')

  const { HEADFUL = false, CHROME_BIN } = process.env

  const ls = await new Promise((resolve, reject) => {
    const server = liveServer.start({
      root: 'dist/',
      open: false,
    })
    server.addListener('listening', (/* e */) => {
      resolve(server)
    })
  })
  const { address, port } = ls.address()
  const URL = `http://${address}:${port}/`

  const browser = await puppeteer.launch({
    headless: !HEADFUL,
    executablePath: CHROME_BIN,
  })

  const page = await browser.newPage()

  page.on('console', msg => console.log(msg.text()))

  await page.goto(URL)

  await browser.close()
  ls.close(process.exit)
})()
