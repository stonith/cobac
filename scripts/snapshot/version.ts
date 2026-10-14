import { createHash, randomUUID } from 'node:crypto'

/** A stable data cache key and a per-build ID that also detects code-only deployments. */
export function createDeploymentVersion(snapshotJson: string, build: string = randomUUID()) {
  return { build, snapshot: createHash('sha256').update(snapshotJson).digest('hex') }
}
