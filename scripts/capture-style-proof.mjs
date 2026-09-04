// One-off visual proof for the image-style selector: drives headless Chrome
// over CDP against the preview server and captures the studio UI in default,
// Custom-selected, and mobile-width states into redesign-proof/.
// Usage: node scripts/capture-style-proof.mjs [baseUrl]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.argv[2] || 'http://localhost:4174'
const OUT_DIR = 'redesign-proof'
const PORT = 9224

const profile = join(tmpdir(), `chrome-style-proof-${process.pid}`)
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

async function capture(cdp, out, width) {
  await cdp.send('Emulation.clearDeviceMetricsOverride')
  await wait(300)
  const metrics = await cdp.send('Page.getLayoutMetrics')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(16000, Math.ceil(metrics.cssContentSize.height)), deviceScaleFactor: 1, mobile: width < 500 })
  await wait(400)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(join(OUT_DIR, out), Buffer.from(shot.data, 'base64'))
  console.log(`✓ ${out}`)
}

try {
  mkdirSync(OUT_DIR, { recursive: true })
  const cdp = await connect(await findPageTarget())
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.navigate', { url: `${BASE}/` })

  let ready = false
  for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
    await wait(300)
    ready = Boolean(await evaluate(cdp, 'Boolean(document.querySelector(\'[role="radiogroup"][aria-label="Image generation style"]\'))'))
  }
  if (!ready) throw new Error('Image style selector never appeared.')

  await capture(cdp, 'studio-image-style-selector.png', 1440)

  await evaluate(cdp, `(() => {
    const group = document.querySelector('[role="radiogroup"][aria-label="Image generation style"]')
    const custom = [...group.querySelectorAll('[role="radio"]')].find((radio) => radio.textContent.includes('Custom'))
    custom.click()
    return true
  })()`)
  await wait(400)
  const clickedCustom = await evaluate(cdp, 'Boolean(document.querySelector(\'#custom-style\'))')
  if (!clickedCustom) throw new Error('Custom style textarea did not appear after selection.')
  await evaluate(cdp, `(() => {
    const field = document.querySelector('#custom-style')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(field, 'Expired 35mm film at a night market, sodium-vapor glow, subject sharp, top third kept dark for text.')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await wait(300)
  await capture(cdp, 'studio-image-style-custom.png', 1440)

  await evaluate(cdp, `(() => {
    const group = document.querySelector('[role="radiogroup"][aria-label="Image generation style"]')
    const y2k = [...group.querySelectorAll('[role="radio"]')].find((radio) => radio.textContent.includes('Y2K Internet'))
    y2k.click()
    return true
  })()`)
  await wait(300)
  await capture(cdp, 'studio-image-style-mobile.png', 390)

  cdp.close()
  console.log('All style-selector captures complete.')
} finally {
  chrome.kill()
  await wait(1500)
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* disposable tmp profile */ }
}
