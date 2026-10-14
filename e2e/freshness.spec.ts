import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

interface Version {
  build: string
  snapshot: string
}

test('the built app requests the matching content-hashed snapshot and data revalidates', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get('/version.json')
  expect(manifestResponse.headers()['cache-control']).toBe('no-store')
  const manifest = (await manifestResponse.json()) as Version
  expect(manifest.build).toBeTruthy()
  expect(manifest.snapshot).toBe(
    createHash('sha256').update(readFileSync('dist/data/snapshot.json')).digest('hex'),
  )
  const loaded = page.waitForRequest((url) => new URL(url.url()).pathname === '/data/snapshot.json')
  await page.goto('/?week=2026-11-09')
  expect(new URL((await loaded).url()).searchParams.get('v')).toBe(manifest.snapshot)
  await expect(page.getByRole('combobox', { name: 'Calendars' })).toBeVisible()
  await expect(page.getByText('An update is available.')).toHaveCount(0)
  const stable = await request.head('/data/snapshot.json')
  expect(stable.headers()['cache-control']).toBe('public, max-age=0, must-revalidate')
  const html = await request.head('/')
  expect(html.headers()['cache-control']).toContain('must-revalidate')
})

test('an open tab notices a data deployment without interrupting activity details, and Reload retains filters', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/version.json')).json()) as Version
  let manifest = original
  await page.route('**/version.json', (route) => route.fulfill({ json: manifest }))
  const filterUrl = '/?week=2026-11-09&q=aquafit&cal=-27&dropin=1&activity=138791'
  await page.goto(filterUrl)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload', exact: true })).toHaveCount(0)
  const url = page.url()
  const count = await page.getByText(/sessions this week/).textContent()
  manifest = { ...original, snapshot: 'changed-data' }
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('status')).toContainText('An update is available.')
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.getByText(/sessions this week/).textContent()).toBe(count)
  expect(page.url()).toBe(url)
  // Dismiss the modal only to reach the reload control underneath; URL keeps other filters.
  await page.keyboard.press('Escape')
  const beforeReload = page.url()
  manifest = original
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reload', exact: true }).click(),
  ])
  expect(page.url()).toBe(beforeReload)
  await expect(page.getByRole('button', { name: 'Drop-in', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('searchbox', { name: 'Search activities' })).toHaveValue('aquafit')
  await expect(page.getByText('An update is available.')).toHaveCount(0)
})

test('a code-only deployment already available at load still produces an update notice', async ({
  page,
  request,
}) => {
  const current = (await (await request.get('/version.json')).json()) as Version
  await page.route('**/version.json', (route) =>
    route.fulfill({ json: { ...current, build: 'new-code-build' } }),
  )
  await page.goto('/?week=2026-11-09')
  await expect(page.getByRole('status')).toContainText('An update is available.')
})
