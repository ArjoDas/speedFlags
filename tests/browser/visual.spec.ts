import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const manifest = JSON.parse(readFileSync('data/generated/manifest.json', 'utf8'))

test('all flag assets decode with usable dimensions', async ({ page }) => {
  const paths = manifest.countries.map((c) => `/flags/${c.asset}.svg`)
  await page.goto('/')
  const broken = await page.evaluate(async (paths) => {
    const checks = await Promise.all(
      paths.map(
        (url) =>
          new Promise<string | null>((resolve) => {
            const image = new Image()
            image.onload = () =>
              resolve(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : url)
            image.onerror = () => resolve(url)
            image.src = url
          }),
      ),
    )
    return checks.filter(Boolean)
  }, paths)
  expect(broken).toEqual([])
})

test('small viewport and dark layout remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  const flag = await page.getByAltText('Flag to identify').boundingBox()
  expect(flag!.width).toBeLessThanOrEqual(292)
})

test('capture desktop, mobile and flag contact sheets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'One visual artifact set is sufficient')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.screenshot({ path: '/tmp/speedflags-setup.png', fullPage: true })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Country name' })).toBeEnabled()
  await page.screenshot({ path: '/tmp/speedflags-warmup.png', fullPage: true })
  const input = page.getByRole('combobox', { name: 'Country name' })
  await input.fill(await page.getByTestId('warmup-answer').innerText())
  await input.press('Enter')
  await expect(page.getByTestId('warmup-answer')).toHaveCount(0)
  await expect(input).toBeEnabled()
  await input.fill('not a country')
  await input.press('Enter')
  await expect(page.locator('.answer-flash')).toBeVisible()
  await expect
    .poll(() => page.locator('.previous-panel img').evaluate((el) => el.getAnimations().length))
    .toBe(0)
  const current = await page.getByAltText('Flag to identify').boundingBox()
  const previous = await page.locator('.previous-panel img').boundingBox()
  const stats = await page.locator('.score-panel').boundingBox()
  expect(previous!.x + previous!.width).toBeLessThan(current!.x)
  expect(stats!.x).toBeGreaterThan(current!.x + current!.width)
  await page.screenshot({ path: '/tmp/speedflags-game.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/tmp/speedflags-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1200, height: 1350 })
  for (let start = 0; start < 250; start += 50) {
    await page.setContent(
      `<html><head><style>body{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;font:12px sans-serif;background:#f3f3f3;color:#111}figure{margin:0;background:white;padding:8px}img{display:block;width:100%;height:95px;object-fit:contain}figcaption{height:25px;margin-top:4px}</style></head><body>${manifest.countries
        .slice(start, start + 50)
        .map(
          (c) =>
            `<figure><img src="http://127.0.0.1:8000/flags/${c.asset}.svg"><figcaption>${c.id} ${c.name}</figcaption></figure>`,
        )
        .join('')}</body></html>`,
    )
    await page.locator('img').evaluateAll(async (images) => {
      await Promise.all(images.map((img: HTMLImageElement) => img.decode()))
    })
    await page.screenshot({ path: `/tmp/speedflags-flags-${start / 50 + 1}.png`, fullPage: true })
  }
})
