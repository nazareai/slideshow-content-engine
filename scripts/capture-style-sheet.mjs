// Captures the image-style taxonomy proof page (style-contact-sheet.html)
// with headless Chrome over CDP into redesign-proof/.
// Usage: node scripts/capture-style-sheet.mjs [baseUrl]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.argv[2] || 'http://localhost:4174'
const OUT_DIR = 'redesign-proof'
const PORT = 9225

const profile = join(tmpdir(), `chrome-style-sheet-${process.pid}`)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' })

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function findPageTarget() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch { /* chrome not up yet */ }
    await wait(200)
  }
  throw new Error('Chrome DevTools endpoint never became available.')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const pending = new Map()
    let nextId = 1
    socket.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const id = nextId++
        pending.set(id, { res, rej })
        socket.send(JSON.stringify({ id, method, params }))
      }),
      close: () => socket.close(),
    })
    socket.onerror = () => reject(new Error('Could not connect to Chrome DevTools.'))
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.id && pending.has(message.id)) {
        const { res, rej } = pending.get(message.id)
        pending.delete(message.id)
        message.error ? rej(new Error(message.error.message)) : res(message.result)
      }
    }
  })
}

async function evaluate(cdp, expression) {
  const { result } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true })
  return result.value
}

try {
  mkdirSync(OUT_DIR, { recursive: true })
  const cdp = await connect(await findPageTarget())
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.navigate', { url: `${BASE}/style-contact-sheet.html` })

  let title = ''
  for (let attempt = 0; attempt < 200 && !/^style-sheet-(ready|failed)$/.test(title); attempt += 1) {
    await wait(300)
    title = await evaluate(cdp, 'document.title')
  }
  if (title !== 'style-sheet-ready') throw new Error(`Style sheet page never became ready (title: ${title}).`)

  await wait(400)
  const metrics = await cdp.send('Page.getLayoutMetrics')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: Math.min(16000, Math.ceil(metrics.cssContentSize.height)), deviceScaleFactor: 1, mobile: false })
  await wait(500)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(join(OUT_DIR, 'style-taxonomy-contact-sheet.png'), Buffer.from(shot.data, 'base64'))
  console.log('✓ style-taxonomy-contact-sheet.png')

  cdp.close()
} finally {
  chrome.kill()
  await wait(1500)
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* disposable tmp profile */ }
}
