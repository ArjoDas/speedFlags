import { test, expect } from '@playwright/test'

test('all flags finish loading before a game can start', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let held = false
  let created = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/games')) created++
  })
  await page.route('**/flags/*.svg', async (route) => {
    if (!held) {
      held = true
      await gate
    }
    await route.continue()
  })
  await page.goto('/')
  try {
    await expect(page.getByRole('status')).toContainText('Loading flags… 244/245')
    await expect(page.getByRole('button', { name: 'Loading…', exact: true })).toBeDisabled()
    expect(created).toBe(0)
  } finally {
    release()
  }
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
  await expect(page.getByTestId('warmup-answer')).toBeVisible()
  await expect(page.getByLabel('0:00 adjusted time')).toBeVisible()
})

test('playing reuses the preloaded collection', async ({ page }) => {
  await page.addInitScript(() => performance.setResourceTimingBufferSize(2000))
  const downloads = new Set<string>()
  page.on('response', (response) => {
    if (/\/flags\/[a-f0-9]{24}\.svg$/.test(response.url())) downloads.add(response.url())
  })
  await page.goto('/')
  await page.getByRole('radio', { name: /^Practice$/ }).check()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const input = page.getByRole('combobox', { name: 'Country name' })
  await expect(input).toBeEnabled()
  expect(downloads.size).toBe(245)
  await page.evaluate(() => performance.clearResourceTimings())
  await input.fill(await page.getByTestId('warmup-answer').innerText())
  await input.press('Enter')
  await expect(page.getByTestId('warmup-answer')).toHaveCount(0)
  for (let i = 0; i < 3; i++) {
    await expect(input).toBeEnabled()
    await input.press('Enter')
    await expect(page.locator('.score-panel dd').last()).toHaveText(String(i + 1))
  }
  await expect(input).toBeEnabled()
  const transferred = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => new URL(entry.name).pathname.startsWith('/flags/'))
      .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).transferSize, 0),
  )
  expect(transferred).toBe(0)

  // Destroy the in-memory images; the next visit should reuse the HTTP cache.
  await page.goto('about:blank')
  await page.goto('/')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(input).toBeEnabled()
  const revisit = await page.evaluate(() => {
    const flags = performance
      .getEntriesByType('resource')
      .filter((entry) =>
        new URL(entry.name).pathname.startsWith('/flags/'),
      ) as PerformanceResourceTiming[]
    return flags.reduce((sum, entry) => sum + entry.transferSize, 0)
  })
  // Firefox can omit resource entries entirely when images come from memory.
  expect(revisit).toBe(0)
})
