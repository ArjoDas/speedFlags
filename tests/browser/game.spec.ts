import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
const manifest = JSON.parse(readFileSync('data/generated/manifest.json', 'utf8'))

async function warmup(page) {
  const input = page.getByRole('combobox', { name: 'Country name' })
  await expect(input).toBeEnabled()
  const name = await page.getByTestId('warmup-answer').innerText()
  await input.fill(name)
  await input.press('Enter')
  await expect(page.getByTestId('warmup-answer')).toHaveCount(0)
  await expect(input).toBeEnabled()
}

async function start(page) {
  await page.goto('/')
  // The header is briefly enabled before startup; a warm-up proves preload has finished.
  await expect(page.getByTestId('warmup-answer')).toBeAttached({ timeout: 20_000 })
  if (!(await page.getByRole('dialog').isVisible()))
    await page.getByRole('button', { name: 'Change settings' }).click()
  await page.getByRole('radio', { name: /^Practice$/ }).check()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
  await warmup(page)
}

test('play, score, skip, review, practice missed and replay', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await start(page)
  const input = page.getByRole('combobox', { name: 'Country name' })
  const src = await page.getByAltText('Flag to identify').getAttribute('src')
  const country = manifest.countries.find((c) => src.includes(c.asset))
  await input.fill(country.name)
  await page.getByRole('button', { name: /Submit/ }).click()
  await expect(page.getByRole('status', { name: 'Answer feedback' })).toContainText('Correct')
  await expect(input).toBeEnabled()
  await page.getByRole('button', { name: /Skip flag/ }).click()
  await expect(page.getByRole('status', { name: 'Answer feedback' })).toContainText('Skipped.')
  await expect(input).toBeEnabled()
  await input.fill('<img src=x onerror=alert(1)>')
  await page.getByRole('button', { name: /Submit/ }).click()
  await expect(page.getByRole('status', { name: 'Answer feedback' })).toContainText(
    'Correct answer:',
  )
  await page.getByRole('button', { name: /Finish round/ }).click()
  await expect(page.getByRole('heading', { name: /^Results$/ })).toBeVisible()
  await expect(page.locator('.review-card')).toHaveCount(3)
  await expect(page.locator('.review-copy').last()).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('.review-copy img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Practice missed flags' }).click()
  await warmup(page)
  await expect(input).toBeEnabled()
  await page.getByRole('button', { name: /Skip flag/ }).click()
  await expect(input).toBeEnabled()
  await page.getByRole('button', { name: /Skip flag/ }).click()
  await expect(page.getByRole('heading', { name: /^Results$/ })).toBeVisible()
  await page.getByRole('button', { name: /Play again/ }).click()
  await expect(input).toBeEnabled()
  expect(errors).toEqual([])
})

test('suggestions submit the default selection on Enter and support touch', async ({ page }) => {
  await start(page)
  const input = page.getByRole('combobox', { name: 'Country name' })
  await input.fill('united')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(5)
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
  const selected = await page.getByRole('option').first().innerText()
  const sent = page.waitForRequest((request) => request.url().endsWith('/answers'))
  await input.press('Enter')
  expect((await sent).postDataJSON().answer).toBe(selected.split('\n')[0])
  await expect(input).toBeEnabled()
  await expect(input).toHaveValue('')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await input.fill('japan')
  await page.getByRole('option', { name: /Japan/ }).click()
  await expect(input).toHaveValue('Japan')
  await input.fill('no-match-ever')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await input.fill('france')
  await input.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('network failure is recoverable and rapid Enter submits once', async ({ page }) => {
  await start(page)
  let requests = 0
  await page.route('**/api/v1/games/*/answers', async (route) => {
    requests++
    if (requests === 1) await route.abort()
    else {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await route.continue()
    }
  })
  const input = page.getByRole('combobox', { name: 'Country name' })
  await input.fill('France')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Could not reach')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(input).toBeEnabled()
  await input.fill('Japan')
  await input.press('Enter')
  await input.press('Enter')
  await expect(input).toBeEnabled()
  expect(requests).toBe(3)
  await page.getByRole('button', { name: /Finish round/ }).click()
  await expect(page.locator('.review-card')).toHaveCount(2)
})

test('layout and accessibility in setup, play and results', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /^New game$/ })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await expect
    .poll(() =>
      page
        .getByRole('dialog')
        .evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length),
    )
    .toBe(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await start(page)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: /Skip flag/ }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
  await page.getByRole('button', { name: /Finish round/ }).click()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
})

test('blocked storage and theme controls do not break games', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('disabled')
      },
    }),
  )
  await start(page)
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: /Finish round/ }).click()
  await expect(page.getByRole('heading', { name: /^Results$/ })).toBeVisible()
})

test('expired session errors never become undefined history', async ({ page }) => {
  await start(page)
  await page.route('**/api/v1/games/*/answers', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'invalid_context', message: 'This game has expired. Start a new game.' },
      }),
    }),
  )
  await page.getByRole('button', { name: /Skip flag/ }).click()
  await expect(page.getByRole('alert')).toContainText('expired')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('undefined')
  await page.getByRole('button', { name: 'Back to setup' }).click()
  await expect(page.getByRole('heading', { name: /^New game$/ })).toBeVisible()
})

test('malformed successful response stays recoverable', async ({ page }) => {
  await start(page)
  await page.route('**/api/v1/games/*/answers', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'broken response' }),
    }),
  )
  await page.getByRole('button', { name: /Skip flag/ }).click()
  await expect(page.getByRole('alert')).toContainText('incomplete game data')
  await expect(page.locator('body')).not.toContainText('undefined')
  await page.unroute('**/api/v1/games/*/answers')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
})

test('failed first asset can retry without starting the clock', async ({ page }) => {
  let fail = true
  await page.route('**/flags/*.svg', (route) => (fail ? route.abort() : route.continue()))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Could not load all flags')
  await expect(page.getByRole('region', { name: 'Flag game' })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
})

test('abandoning an in-flight answer cannot replace the setup screen', async ({ page }) => {
  await start(page)
  await page.route('**/api/v1/games/*/answers', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await route.continue()
  })
  await page.getByRole('button', { name: /Skip flag/ }).click()
  await page.getByRole('link', { name: 'speedFlags home' }).click()
  await expect(page.getByRole('heading', { name: /^New game$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})

test('IME composition does not submit an unfinished answer', async ({ page }) => {
  await start(page)
  const input = page.getByRole('combobox', { name: 'Country name' })
  let requests = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/answers')) requests++
  })
  await input.fill('Japan')
  await input.dispatchEvent('compositionstart')
  await input.press('Enter')
  expect(requests).toBe(0)
  await input.dispatchEvent('compositionend')
  await input.press('Enter')
  await expect(input).toHaveValue('')
  expect(requests).toBe(1)
})

test('real timed round expires once and records no unanswered attempt', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Server boundaries are unit tested; one real wall-clock browser run is sufficient',
  )
  test.setTimeout(45000)
  let finishes = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/finish')) finishes++
  })
  await page.goto('/')
  await page.getByRole('radio', { name: 'Timed', exact: true }).check()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
  await warmup(page)
  await expect(page.getByRole('heading', { name: /^Results$/ })).toBeVisible({ timeout: 35000 })
  await expect(page.getByText('Time’s up.', { exact: false })).toBeVisible()
  await expect(page.locator('.review-card')).toHaveCount(0)
  expect(finishes).toBe(1)
})

test('warm-up reveals the answer and leaves the timer stopped until correct entry', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('radio', { name: 'Timed', exact: true }).check()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const input = page.getByRole('combobox', { name: 'Country name' })
  await expect(input).toBeEnabled()
  const answer = await page.getByTestId('warmup-answer').innerText()
  await input.fill('not a country')
  await input.press('Enter')
  await expect(page.getByRole('status', { name: 'Answer feedback' })).toContainText(
    `Type ${answer} to start.`,
  )
  await page.waitForTimeout(1200)
  await expect(page.locator('.timer')).toHaveText('30s')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await warmup(page)
  await expect(page.locator('.timer')).not.toHaveText('30s')
  await expect(page.locator('.score-panel dd').nth(1)).toHaveText('0')
})

test('wrong answers flash, then remain beside the previous flag', async ({ page }) => {
  await start(page)
  const src = await page.getByAltText('Flag to identify').getAttribute('src')
  const country = manifest.countries.find((c) => src.includes(c.asset))
  await page.getByRole('combobox', { name: 'Country name' }).fill('not a country')
  await page.getByRole('button', { name: /Submit/ }).click()
  await expect(page.locator('.answer-flash')).toContainText(country.name)
  await expect(page.getByRole('complementary', { name: 'Previous answer' })).toContainText(
    country.name,
  )
  await expect(page.locator('.answer-flash')).toHaveCount(0, { timeout: 5000 })
  await expect(
    page.getByRole('complementary', { name: 'Previous answer' }).locator('img'),
  ).toHaveAttribute('src', src)
  await expect(page.locator('.score-panel dd')).toHaveCount(2)
})

test('empty Enter skips once, including whitespace, but cannot skip the warm-up', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('radio', { name: /^Practice$/ }).check()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const input = page.getByRole('combobox', { name: 'Country name' })
  await expect(input).toBeEnabled()
  await input.press('Enter')
  await expect(page.getByTestId('warmup-answer')).toBeVisible()
  await warmup(page)
  await input.press('Enter')
  await expect(page.locator('.score-panel dd').nth(1)).toHaveText('1')
  await expect(input).toBeEnabled()
  await input.fill('   ')
  await input.press('Enter')
  await expect(page.locator('.score-panel dd').nth(1)).toHaveText('2')
  await page.getByRole('button', { name: /Finish round/ }).click()
  await expect(page.locator('.review-card.skipped')).toHaveCount(2)
})

test('answered flag moves to the previous slot without blocking input', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await start(page)
  await page.evaluate(() => {
    const animate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args)
      if (this.matches('.previous-panel img')) {
        animation.pause()
        ;(window as Window & { flagAnimation?: Animation }).flagAnimation = animation
      }
      return animation
    }
  })
  const current = await page.getByAltText('Flag to identify').boundingBox()
  await page.getByRole('combobox', { name: 'Country name' }).press('Enter')
  await expect(page.locator('.score-panel dd').nth(1)).toHaveText('1')
  const previous = page.locator('.previous-panel img')
  const moving = await previous.boundingBox()
  expect(Math.abs(moving!.x - current!.x)).toBeLessThan(2)
  expect(Math.abs(moving!.width - current!.width)).toBeLessThan(2)
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
  await page.evaluate(() =>
    (window as Window & { flagAnimation?: Animation }).flagAnimation!.finish(),
  )
  await expect.poll(() => previous.evaluate((el) => el.getAnimations().length)).toBe(0)
  expect((await previous.boundingBox())!.width).toBeLessThanOrEqual(128)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('combobox', { name: 'Country name' }).press('Enter')
  await expect(page.locator('.score-panel dd').nth(1)).toHaveText('2')
  expect(await previous.evaluate((el) => el.getAnimations().length)).toBe(0)
})

test('settings modal defaults to Challenge, preserves the warm-up on cancel and supports custom Timed', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'speedflags.settings.v1',
      JSON.stringify({ mode: 'timed', duration: 120, bonus: 5 }),
    ),
  )
  await page.goto('/')
  const modal = page.getByRole('dialog', { name: 'New game' })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('radio', { name: 'Daily Challenge', exact: true })).toBeChecked()
  await expect(modal).toContainText('30 flags daily')
  await expect(modal.getByRole('radio', { name: '120s' })).toHaveCount(0)
  await expect(modal.getByRole('button', { name: 'Close settings' })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  await page.getByRole('button', { name: /^(Settings|Change settings)$/ }).click()
  await modal.getByRole('radio', { name: 'Timed', exact: true }).check()
  await modal.getByRole('radio', { name: '120s' }).check()
  await modal.getByRole('radio', { name: '+5s', exact: true }).check()
  await modal.getByRole('radio', { name: 'Daily Challenge', exact: true }).check()
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/games') && response.request().method() === 'POST',
  )
  await modal.getByRole('button', { name: 'Play', exact: true }).click()
  expect((await (await created).json()).settings).toMatchObject({
    mode: 'challenge',
    duration: 30,
    bonus: 0,
  })
  await expect(modal).not.toBeVisible()
  const flag = await page.getByAltText('Flag to identify').getAttribute('src')
  await page.getByRole('button', { name: 'Change settings' }).click()
  await expect(modal).toBeVisible()
  await expect.poll(() => modal.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await modal.getByRole('button', { name: 'Close settings' }).click()
  await expect(modal).not.toBeVisible()
  await expect(page.getByAltText('Flag to identify')).toHaveAttribute('src', flag!)
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeFocused()
  await page.getByRole('button', { name: 'Change settings' }).click()
  await modal.getByRole('radio', { name: 'Timed', exact: true }).check()
  await modal.getByRole('radio', { name: '+2s', exact: true }).check()
  await modal.getByRole('radio', { name: '60s' }).check()
  await modal.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(modal).not.toBeVisible()
  await expect(page.locator('.timer')).toHaveText('60s')
  await page.reload()
  await expect(modal).not.toBeVisible()
  await page.getByRole('button', { name: 'Change settings' }).click()
  await expect(modal.getByRole('radio', { name: 'Timed', exact: true })).toBeChecked()
  await expect(modal.getByRole('radio', { name: '60s' })).toBeChecked()
  await expect(modal.getByRole('radio', { name: '+2s', exact: true })).toBeChecked()
})

test('daily challenge resumes, scores 30 flags and copies dated results with brief statistics', async ({
  page,
}, testInfo) => {
  // This journey submits 30 answers and reloads the game repeatedly on CI browsers.
  test.setTimeout(60_000)
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          ;(window as Window & { shared?: string }).shared = text
        },
      },
      configurable: true,
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await warmup(page)
  const input = page.getByRole('combobox', { name: 'Country name' })
  await input.press('Enter')
  await expect(page.locator('.score-panel dd').nth(1)).toHaveText('1')
  const src = await page.getByAltText('Flag to identify').getAttribute('src')
  await page.reload()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(input).toBeEnabled()
  await expect(page.getByAltText('Flag to identify')).toHaveAttribute('src', src!)
  for (let i = 1; i < 30; i++) {
    await expect(input).toBeEnabled()
    await input.press('Enter')
    if (i < 29) await expect(page.locator('.score-panel dd').nth(1)).toHaveText(String(i + 1))
  }
  await expect(page.getByRole('heading', { name: 'Results', exact: true })).toBeVisible()
  await expect(page.locator('.daily-result')).toContainText('0/30')
  await expect(page.locator('.daily-result')).toContainText('150s penalties')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  if (testInfo.project.name === 'chromium')
    await page.screenshot({ path: '/tmp/speedflags-daily-results.png', fullPage: true })
  await page.getByRole('button', { name: 'Copy result' }).click()
  const shared = await page.evaluate(() => (window as Window & { shared?: string }).shared)
  expect(shared).toMatch(
    /^Here’s my speedFlags\.win result\non \d{2}-\d{2}-\d{2}\n(🟨{6}\n){4}🟨{6}\ntime: \d+:\d{2}, score 0\/30$/u,
  )
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeDisabled()
  await expect(page.locator('.share-status')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copy result', exact: true })).toBeEnabled()
  expect(shared).toBe(await page.getByLabel('Share preview').innerText())
  await expect(page.locator('.results')).not.toContainText('Accuracy includes')
  await expect(page.locator('.results')).not.toContainText('Lowest adjusted time wins')
  if (testInfo.project.name !== 'mobile') {
    const summary = await page.locator('.daily-summary').boundingBox()
    const sharePanel = await page.locator('.daily-share').boundingBox()
    expect(sharePanel!.x).toBeGreaterThanOrEqual(summary!.x + summary!.width)
    expect(Math.abs(sharePanel!.y - summary!.y)).toBeLessThan(2)
  }
  await page.reload()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Results', exact: true })).toBeVisible()
  await expect(page.getByLabel('Share preview')).toHaveText(shared!)
  await expect(page.getByRole('button', { name: 'Practice today’s flags' })).toHaveCount(0)
  await expect(page.locator('.daily-result')).toContainText('Come back tomorrow')
  await page.getByRole('button', { name: 'Change settings' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByLabel('Share preview')).toHaveText(shared!)
})

test('dismissing initial settings starts from a loaded warm-up without pressing Play', async ({
  page,
}) => {
  await page.goto('/')
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await expect(modal).toContainText('One attempt per day')
  await expect(modal).not.toContainText('daily ·')
  await modal.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
  await expect(page.getByTestId('warmup-answer')).toBeVisible()
  await expect(page.locator('.timer')).toHaveText('0:00')
})

test('daily play requires storage so its one-play limit can persist', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('disabled')
      },
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Close settings' }).click()
  const input = page.getByRole('combobox', { name: 'Country name' })
  await expect(input).toBeEnabled()
  await input.fill(await page.getByTestId('warmup-answer').innerText())
  await input.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Daily Challenge needs browser storage')
  await expect(page.getByTestId('warmup-answer')).toBeVisible()
})

test('pointer highlight and Enter submit the same second suggestion', async ({ page }) => {
  await start(page)
  const input = page.getByRole('combobox', { name: 'Country name' })
  await input.fill('united')
  const second = page.getByRole('option').nth(1)
  await second.hover()
  await expect(second).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('option', { selected: true })).toHaveCount(1)
  const name = (await second.innerText()).split('\n')[0]
  const sent = page.waitForRequest((request) => request.url().endsWith('/answers'))
  await input.press('Enter')
  expect((await sent).postDataJSON().answer).toBe(name)
})

test('return visits never mount settings until explicitly opened', async ({ page }) => {
  test.setTimeout(45_000)
  await page.addInitScript(() => {
    localStorage.setItem('speedflags.settings-seen.v1', 'true')
    const state = window as Window & { settingsMounted?: boolean }
    state.settingsMounted = false
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches('.settings-dialog') || node.querySelector('.settings-dialog'))
          )
            state.settingsMounted = true
        }
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await page.goto('/')
  const input = page.getByRole('combobox', { name: 'Country name' })
  await expect(input).toBeEnabled({ timeout: 20_000 })
  await page.reload()
  await expect(input).toBeEnabled({ timeout: 20_000 })
  expect(
    await page.evaluate(() => (window as Window & { settingsMounted?: boolean }).settingsMounted),
  ).toBe(false)
  await expect(page.locator('.settings-dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Change settings' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.locator('.settings-dialog')).toHaveCount(0)
  await expect(input).toBeEnabled()
})
