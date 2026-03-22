/**
 * Headless UI test — runs against the local dev server
 * Tests mock mode first, then checks credential/auth flow
 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const errors = []
  const logs = []

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`
    logs.push(text)
    if (msg.type() === 'error') errors.push(text)
  })

  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))

  page.on('requestfailed', req => {
    errors.push(`[reqfail] ${req.url()} — ${req.failure()?.errorText}`)
  })

  page.on('response', resp => {
    if (resp.status() >= 400) {
      errors.push(`[http ${resp.status()}] ${resp.url()}`)
    }
  })

  // --- Test 1: Mock mode (no credentials) ---
  console.log('\n=== Test 1: Mock mode ===')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  const roomName = await page.textContent('h1').catch(() => null)
  const statusText = await page.locator('text=Available, text=In Use').first().textContent().catch(() => null)
  const demoIndicator = await page.locator('text=Demo mode').textContent().catch(() => null)

  console.log('Room name:', roomName)
  console.log('Status:', statusText)
  console.log('Demo mode indicator:', demoIndicator)
  console.log('Console errors:', errors.length ? errors : 'none')
  console.log('Console logs:', logs.filter(l => l.includes('[gcal]')))

  // Screenshot
  await page.screenshot({ path: '/tmp/test-mock.png', fullPage: true })
  console.log('Screenshot: /tmp/test-mock.png')

  errors.length = 0
  logs.length = 0

  // --- Test 2: Book now button ---
  console.log('\n=== Test 2: Book Now ===')
  const bookBtn = page.locator('text=Book Now')
  const bookVisible = await bookBtn.isVisible().catch(() => false)
  console.log('Book Now visible:', bookVisible)

  if (bookVisible) {
    await bookBtn.click()
    await page.waitForTimeout(500)
    const modal = await page.locator('text=Book This Room').isVisible().catch(() => false)
    console.log('Booking modal opened:', modal)
    await page.screenshot({ path: '/tmp/test-booking.png' })
    console.log('Screenshot: /tmp/test-booking.png')
    await page.keyboard.press('Escape')
  }

  // --- Test 3: Settings tap ×3 ---
  console.log('\n=== Test 3: Settings (3-tap) ===')
  for (let i = 0; i < 3; i++) {
    await page.locator('body').evaluate(el => {
      const tap = new MouseEvent('click', { bubbles: true })
      // Target top-right corner zone
      const zone = document.querySelector('div.absolute.top-0.right-0')
      zone?.dispatchEvent(tap)
    })
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(500)
  const settingsVisible = await page.locator('text=Settings').isVisible().catch(() => false)
  console.log('Settings modal opened:', settingsVisible)
  if (settingsVisible) {
    await page.screenshot({ path: '/tmp/test-settings.png' })
    console.log('Screenshot: /tmp/test-settings.png')
  }

  console.log('\n=== Summary ===')
  console.log('Errors:', errors.length ? errors : 'none ✓')

  await browser.close()
}

run().catch(e => { console.error('Test failed:', e); process.exit(1) })
