import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
const manifest = JSON.parse(readFileSync('data/generated/manifest.json', 'utf8'))

async function warmup(page) {
  const input = page.getByRole('combobox', { name: 'Which country or territory is this?' })
  await expect(input).toBeEnabled()
  const name = await page.getByTestId('warmup-answer').innerText()
  await input.fill(name)
  await input.press('Enter')
  await expect(page.getByTestId('warmup-answer')).toHaveCount(0)
  await expect(input).toBeEnabled()
}

async function start(page) {
  await page.goto('/')
  await page.getByRole('radio', { name: /^Practice$/ }).check()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Which country or territory is this?' }),
  ).toBeEnabled()
  await warmup(page)
}

test('play, score, skip, review, practice missed and replay', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await start(page)
  const input = page.getByRole('combobox', { name: 'Which country or territory is this?' })
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
  const input = page.getByRole('combobox', { name: 'Which country or territory is this?' })
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
  const input = page.getByRole('combobox', { name: 'Which country or territory is this?' })
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
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await start(page)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: /Skip flag/ }).click()
  await expect(
    page.getByRole('combobox', { name: 'Which country or territory is this?' }),
  ).toBeEnabled()
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
  await expect(
    page.getByRole('combobox', { name: 'Which country or territory is this?' }),
  ).toBeEnabled()
})

test('failed first asset can retry without starting the clock', async ({ page }) => {
  await page.goto('/')
  let fail = true
  await page.route('**/flags/*.svg', (route) => (fail ? route.abort() : route.continue()))
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('flag could not load')
  await expect(page.getByRole('region', { name: 'Flag game' })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Which country or territory is this?' }),
  ).toBeEnabled()
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
  const input = page.getByRole('combobox', { name: 'Which country or territory is this?' })
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
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Which country or territory is this?' }),
  ).toBeEnabled()
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
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const input = page.getByRole('combobox', { name: 'Which country or territory is this?' })
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
  await page
    .getByRole('combobox', { name: 'Which country or territory is this?' })
    .fill('not a country')
  await page.getByRole('button', { name: /Submit/ }).click()
  await expect(page.locator('.answer-flash')).toContainText(country.name)
  await expect(page.getByRole('complementary', { name: 'Previous answer' })).toContainText(
    country.name,
  )
  await expect(page.locator('.answer-flash')).toHaveCount(0, { timeout: 5000 })
  await expect(
    page.getByRole('complementary', { name: 'Previous answer' }).locator('img'),
  ).toHaveAttribute('src', src)
  await expect(page.locator('.score-panel dd').nth(2)).toHaveText('1')
})
