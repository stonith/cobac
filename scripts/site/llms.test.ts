import { describe, expect, it } from 'vitest'
import {
  buildActivityDetail,
  buildCatalog,
  buildCentres,
  buildSiteMeta,
  occurrencesByActivity,
} from '../../src/data/catalog.ts'
import { index, snapshot } from '../../src/test/fixture.ts'
import { centreMarkdown, llmsFullTxt, llmsTxt } from './llms.ts'

const meta = buildSiteMeta(snapshot, '1.0.0')
const centres = buildCentres(snapshot).centres
const ctx = { meta, centres, calendars: snapshot.calendars }
const catalog = buildCatalog(snapshot)
const sessions = occurrencesByActivity(snapshot.occurrences)

describe('llmsTxt', () => {
  const text = llmsTxt(ctx)
  it('follows the llms.txt shape', () => {
    expect(text.startsWith('# cobac\n\n> cobac (City of Burnaby recreation)')).toBe(true)
    expect(text).toContain(
      '2 registered programs and drop-in activities with 3 scheduled sessions at 2 community centres',
    )
    expect(text).toContain('## How to query')
    expect(text).toContain('https://cobac-g3k.pages.dev/mcp')
    expect(text).toContain('## Centres\n')
    expect(text).toContain(
      '- [Bonsor Recreation Complex (BON)](https://cobac-g3k.pages.dev/llms/centres/63.md): 1 activities, 6550 Bonsor Avenue, Burnaby, (604) 421-5962',
    )
    expect(text).toContain(
      '- [Rosemary Brown Recreation Centre (RBR)](https://cobac-g3k.pages.dev/llms/centres/180.md): 1 activities',
    )
    expect(text).toContain('- Multi-sport (Drop-in, id 6)')
    expect(text).toContain('## Optional')
  })
})

describe('llmsFullTxt', () => {
  it('lists every activity under its centre', () => {
    const byCentre = new Map<number, typeof catalog.activities>()
    for (const a of catalog.activities)
      byCentre.set(a.centerId, [...(byCentre.get(a.centerId) ?? []), a])
    const text = llmsFullTxt(ctx, byCentre)
    expect(text).toContain('### Bonsor Recreation Complex (BON)')
    expect(text).toContain(
      '- [Multi-sport](https://cobac-g3k.pages.dev/activities/1/) · Multi-sport · Free · All ages · 2 sessions',
    )
    expect(text).toContain('### Rosemary Brown Recreation Centre (RBR)')
    expect(text).toContain(
      '[Reserve In Advance: Adult Badminton](https://cobac-g3k.pages.dev/activities/2/)',
    )
  })
})

describe('centreMarkdown', () => {
  it('embeds full write-ups under group headings', () => {
    const detail = buildActivityDetail(
      index,
      snapshot.activities[0]!,
      sessions.get(1)!,
      '2026-09-08',
    )
    const md = centreMarkdown(centres[0]!, [detail], '2026-09-08')
    expect(
      md.startsWith(
        '# Bonsor Recreation Complex (BON)\n\n6550 Bonsor Avenue, Burnaby · (604) 421-5962 · https://www.openstreetmap.org/',
      ),
    ).toBe(true)
    expect(md).toContain(
      '## Drop-in\n\n### Multi-sport\n\n- Centre: Bonsor Recreation Complex (BON), 6550 Bonsor Avenue, Burnaby',
    )
    expect(md).toContain('#### Upcoming sessions (Pacific time)')
    expect(md).toContain('https://cobac-g3k.pages.dev/activities/{id}/')
  })
})
