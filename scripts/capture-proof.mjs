// Dependency-free visual-proof capture: drives headless Chrome over the
// DevTools protocol, waits for the harness to signal readiness via
// document.title, then captures full-page screenshots into redesign-proof/.
// Usage: node scripts/capture-proof.mjs [baseUrl]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.argv[2] || 'http://localhost:4174'
const OUT_DIR = 'redesign-proof'
const PORT = 9223

const captures = [
  { path: `${BASE}/contact-sheet.html`, out: 'contact-sheets-all-presets.png', width: 1900, ready: /^contact-sheet-(ready|failed)$/ },
  { path: `${BASE}/contact-sheet.html?full=1&slide=0&preset=impact`, out: 'full-01-hook-impact-stack-bold.png', width: 1120, ready: /^contact-sheet-ready$/ },
  { path: `${BASE}/contact-sheet.html?full=1&slide=3&preset=zine`, out: 'full-04-tension-rail-zine.png', width: 1120, ready: /^contact-sheet-ready$/ },
  { path: `${BASE}/contact-sheet.html?full=1&slide=1&preset=docu`, out: 'full-02-evidence-card-docu.png', width: 1120, ready: /^contact-sheet-ready$/ },
  { path: `${BASE}/contact-sheet.html?full=1&slide=6&preset=log`, out: 'full-07-cta-stamp-log.png', width: 1120, ready: /^contact-sheet-ready$/ },
]

const profile = join(tmpdir(), `chrome-proof-${process.pid}`)
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

  for (const capture of captures) {
    process.stdout.write(`→ ${capture.out} `)
    await cdp.send('Page.navigate', { url: capture.path })
    let title = ''
    for (let attempt = 0; attempt < 240; attempt += 1) {
      await wait(500)
      title = String(await evaluate(cdp, 'document.title'))
      if (capture.ready.test(title)) break
    }
    if (!capture.ready.test(title)) throw new Error(`${capture.path} never signalled readiness (title: "${title}").`)
    if (title === 'contact-sheet-failed') {
      const status = await evaluate(cdp, 'document.getElementById("status")?.textContent')
      throw new Error(`Harness reported a render failure: ${status}`)
    }
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    await wait(300)
    const metrics = await cdp.send('Page.getLayoutMetrics')
    const height = Math.min(16000, Math.ceil(metrics.cssContentSize.height))
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: capture.width, height, deviceScaleFactor: 1, mobile: false })
    await wait(400)
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    writeFileSync(join(OUT_DIR, capture.out), Buffer.from(shot.data, 'base64'))
    console.log(`✓ (${height}px tall)`)
  }
  cdp.close()
  console.log('All captures complete.')
} finally {
  chrome.kill()
  await wait(1500)
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* profile dir is disposable tmp */ }
}
