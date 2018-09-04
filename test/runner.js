// @flow
/* eslint-disable global-require, no-console, unicorn/no-process-exit */
(async () => {
  const puppeteer = require('puppeteer-core')
  const liveServer = require('live-server')
  const fs = require('fs-extra')

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

  /* run in-page unit tests */
  page.on('console', msg => console.log(msg.text()))
  await page.goto(URL)
  await page.waitForFunction('window.__tests_done__')

  /* fetch coverage */
  // eslint-disable-next-line no-underscore-dangle
  const coverage = await page.evaluate(() => window.__coverage__)
  await fs.emptyDir('.nyc_output')
  await Promise.all(
    Object.values(coverage).map((cov) => {
      if (
        cov &&
        typeof cov === 'object' &&
        typeof cov.path === 'string' &&
        typeof cov.hash === 'string'
      ) {
        return fs.writeJson(`.nyc_output/${cov.hash}.json`, { [cov.path]: cov })
      }
      return Promise.resolve()
    })
  )

  await browser.close()
  ls.close(process.exit)
})()
