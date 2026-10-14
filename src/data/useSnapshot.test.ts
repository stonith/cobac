import { describe, expect, it, vi } from 'vitest'
import { snapshot } from '@/test/fixture'
import { loadSnapshot, SNAPSHOT_URL } from './useSnapshot'

describe('loadSnapshot', () => {
  it('uses a build-time cache key and requires revalidation', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => snapshot })
    expect(await loadSnapshot(undefined, fetchFn)).toEqual(snapshot)
    expect(SNAPSHOT_URL).toBe('/data/snapshot.json?v=test-snapshot')
    expect(fetchFn).toHaveBeenCalledWith(SNAPSHOT_URL, { cache: 'no-cache' })
  })

  it('retains the HTTP error for failed loads', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    await expect(loadSnapshot(undefined, fetchFn)).rejects.toThrow('HTTP 503')
  })
})
