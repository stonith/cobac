import { describe, expect, it } from 'vitest'
import { createDeploymentVersion } from './version'

describe('deployment versions', () => {
  it('keeps the same snapshot cache key across rebuilds but changes it when data changes', () => {
    const first = createDeploymentVersion('{"activities":[]}', 'build-one')
    const second = createDeploymentVersion('{"activities":[]}', 'build-two')
    expect(first.snapshot).toMatch(/^[a-f0-9]{64}$/)
    expect(second.snapshot).toBe(first.snapshot)
    expect(second.build).not.toBe(first.build)
    expect(createDeploymentVersion('{"activities":[1]}', 'build-three').snapshot).not.toBe(
      first.snapshot,
    )
  })
})
