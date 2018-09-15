// @flow
/* eslint-disable no-console, max-len, no-shadow, unicorn/no-process-exit */
const puppeteer = require('puppeteer-core')
const liveServer = require('live-server')
const cors = require('cors')
const test = require('tape')
const fs = require('fs-extra')

/**
 * Wait for console message.
 * @param frame - Frame object.
 * @param message - Text to match.
 * @returns Promise.
 */
function waitForMessage (frame, message) {
  return new Promise((resolve, reject) => {
    frame.on('console', (msg) => {
      const match = msg.text().match(message)
      if (match) {
        resolve(match)
      }
    })
  })
}

(async () => {
  const { HEADFUL = false, CHROME_BIN } = process.env

  const ls = await new Promise((resolve, reject) => {
    const server = liveServer.start({
      root: 'dist/',
      open: false,
      middleware: [
        cors({
          origin: true,
        }),
      ],
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
  const finish = waitForMessage(page, /^All tests finished$/)
  await page.goto(URL)
  await finish

  /* functional tests */
  test('channel', async (t) => {
    const finish = waitForMessage(page, /test\/channel.*TEST SUCCESS$/)
    const pid1 = await page.evaluate(() => window.kernel.spawn(`${window.location.origin}/current/test/channel.js`))
    t.ok(pid1)
    t.ok(typeof pid1 === 'string')
    const pid2 = await page.evaluate(
      other => window.kernel.spawn(`${window.location.origin}/current/test/channel.js`, [other]),
      pid1
    )
    t.ok(pid2)
    t.ok(typeof pid2 === 'string')
    const workers = await page.workers()
    t.ok(workers.length > 0)
    await finish
    t.end()
  })

  /* fetch coverage */
  test.onFinish(async () => {
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

    console.log('All testing done - closing browser')
    await browser.close()
    ls.close(process.exit)
  })
})()
