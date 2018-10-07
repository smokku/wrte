// @flow
/* eslint-disable no-console, max-len, no-shadow, unicorn/no-process-exit */
const puppeteer = require('puppeteer-core')
const pti = require('puppeteer-to-istanbul')
const liveServer = require('live-server')
const cors = require('cors')
const test = require('tape')
const fs = require('fs-extra')

/**
 * Wait for console message.
 * @param frame - Frame object.
 * @param ack - Text to match ro resolve Promise.
 * @param nak - Text to match ro reject Promise.
 * @returns Promise.
 */
function waitForMessage (frame, ack, nak) {
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      const match = msg.text().match(ack)
      if (match) {
        frame.removeListener('console', handler)
        resolve(match)
      }
      if (nak) {
        const match = msg.text().match(nak)
        if (match) {
          frame.removeListener('console', handler)
          reject(match)
        }
      }
    }
    frame.on('console', handler)
  })
}

/**
 * Promise based async/await sleep.
 * @param ms - Wait for given milliseconds.
 * @returns - Timeout Promise.
 */
function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

(async () => {
  const { HEADFUL = false, CHROME_BIN } = process.env

  /* start local server */
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

  /* generate local server URL */
  const { address, port } = ls.address()
  const URL = `http://${address}:${port}/`

  /* launch Chrome under Puppeteer */
  const browser = await puppeteer.launch({
    headless: !HEADFUL,
    executablePath: CHROME_BIN,
  })
  const page = await browser.newPage()

  /* Enable both JavaScript and CSS coverage */
  await Promise.all([page.coverage.startJSCoverage(), page.coverage.startCSSCoverage()])

  /* wire browser console to node console */
  page.on('console', msg => console.log(msg.text()))

  /* run in-page unit tests */
  const finish = waitForMessage(page, /^All tests finished$/)
  await page.goto(URL)
  await finish

  /* functional tests */
  test('spawning', async (t) => {
    const pid = await page.evaluate(() => window.kernel.spawn(`${window.location.origin}/current/test/non-exist.js`))
    t.ok(pid, 'has Pid')
    t.equal(typeof pid, 'string', 'Pid is a string')
    let ps = (await page.evaluate(() => window.kernel.ps())).find(item => item.pid === pid)
    t.ok(ps, 'Process exists')
    t.equal(ps.pid, pid, 'Process found properly')
    t.equal(ps.status, 'SPAWNING', 'Process is SPAWNING')
    await sleep(300)
    ps = (await page.evaluate(() => window.kernel.ps())).find(item => item.pid === pid)
    console.log(ps)
    t.notOk(ps, 'Process does not exist')
    t.end()
  })

  test('channel', async (t) => {
    waitForMessage(page, /test\/channel.*TEST SUCCESS$/, /test\/channel.*TEST FAILURE/).then(
      () => t.end(),
      t.fail
    )

    const pid1 = await page.evaluate(() => window.kernel.spawn(`${window.location.origin}/current/test/channel.js`))
    t.ok(pid1, 'LEFT has Pid')
    t.equal(typeof pid1, 'string', 'LEFT Pid is a string')
    const pid2 = await page.evaluate(
      other => window.kernel.spawn(`${window.location.origin}/current/test/channel.js`, [other]),
      pid1
    )
    t.ok(pid2, 'RIGHT has Pid')
    t.equal(typeof pid2, 'string', 'RIGHT Pid is a string')
  })

  test('window', async (t) => {
    waitForMessage(page, /test\/window.*TEST SUCCESS$/).then(() => t.end())

    const pid = await page.evaluate(() => window.kernel.spawn(`${window.location.origin}/current/test/window.js`))
    t.ok(pid, 'has Pid')
    t.equal(typeof pid, 'string', 'Pid is a string')
  })

  test.onFinish(async () => {
    /* Disable both JavaScript and CSS coverage */
    const [jsCoverage, cssCoverage] = await Promise.all([
      page.coverage.stopJSCoverage(),
      page.coverage.stopCSSCoverage(),
    ])

    /* fetch Istanbul coverage */
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

    /* write Chrome coverage */
    pti.write(jsCoverage)
    await fs.move('.nyc_output/out.json', '.nyc_output/js.json')
    pti.write(cssCoverage)
    await fs.move('.nyc_output/out.json', '.nyc_output/css.json')

    console.log('All testing done - closing browser')
    await browser.close()
    ls.close(process.exit)
  })
})()
