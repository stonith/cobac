import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UPDATE_CHECK_INTERVAL, useDeploymentUpdate } from './useDeploymentUpdate'

const current = { build: 'test-build', snapshot: 'test-snapshot' }
const settle = async () => {
  await act(async () => {})
}

function mockManifest(value: unknown = current) {
  const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => value })
  vi.stubGlobal('fetch', fetchFn)
  return fetchFn
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('deployment update detection', () => {
  it('does not poll before the snapshot is loaded and compares against the embedded version', async () => {
    const fetchFn = mockManifest({ ...current, build: 'new-build' })
    const { result, rerender } = renderHook(({ ready }) => useDeploymentUpdate(ready), {
      initialProps: { ready: false },
    })
    expect(fetchFn).not.toHaveBeenCalled()
    rerender({ ready: true })
    await settle()
    expect(result.current).toBe(true)
    expect(fetchFn).toHaveBeenCalledWith(
      '/version.json',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('checks on focus and keeps an update available once detected', async () => {
    const fetchFn = mockManifest()
    const { result } = renderHook(() => useDeploymentUpdate(true))
    await settle()
    expect(result.current).toBe(false)
    fetchFn.mockResolvedValue({
      ok: true,
      json: async () => ({ ...current, snapshot: 'new-snapshot' }),
    })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(true)
    fetchFn.mockResolvedValue({ ok: true, json: async () => current })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(true)
  })

  it('polls visible tabs periodically and checks when a hidden tab becomes visible', async () => {
    vi.useFakeTimers()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const fetchFn = mockManifest()
    const { result } = renderHook(() => useDeploymentUpdate(true))
    await settle()
    await act(async () => {
      vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL)
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    visibility.mockReturnValue('hidden')
    await act(async () => {
      vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL)
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    visibility.mockReturnValue('visible')
    fetchFn.mockResolvedValue({
      ok: true,
      json: async () => ({ ...current, build: 'another-build' }),
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(true)
  })

  it('ignores offline, malformed and HTTP failures and retries later', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetchFn = mockManifest(null)
    const { result } = renderHook(() => useDeploymentUpdate(true))
    await settle()
    expect(fetchFn).not.toHaveBeenCalled()
    online.mockReturnValue(true)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(false)
    fetchFn.mockResolvedValue({ ok: false, status: 503 })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(false)
    fetchFn.mockRejectedValue(new Error('offline'))
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(false)
    fetchFn.mockResolvedValue({ ok: true, json: async () => ({ ...current, build: 'new-build' }) })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(true)
  })

  it('times out stalled checks so a later focus can retry', async () => {
    vi.useFakeTimers()
    const fetchFn = vi.fn().mockImplementation(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('timeout')))
        }),
    )
    vi.stubGlobal('fetch', fetchFn)
    const { unmount } = renderHook(() => useDeploymentUpdate(true))
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('deduplicates in-flight checks and aborts them on unmount', async () => {
    vi.useFakeTimers()
    const fetchFn = vi.fn().mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchFn)
    const { unmount } = renderHook(() => useDeploymentUpdate(true))
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(fetchFn).toHaveBeenCalledOnce()
    const signal = fetchFn.mock.calls[0]![1].signal as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
    window.dispatchEvent(new Event('focus'))
    expect(fetchFn).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
