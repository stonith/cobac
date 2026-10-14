/** ChatGPT connector contract: `search` returns `{ results: [{ id, title, url }] }`. */
import * as z from 'zod'
import { searchActivities } from '../../src/data/search.ts'
import { priceLabel } from '../../src/data/markdown.ts'
import { defineTool } from './types.ts'

export const search = defineTool({
  name: 'search',
  title: 'Search activities',
  description:
    'Full-text search over City of Burnaby recreation activities in the current cobac snapshot: group fitness, indoor cycling, yoga, badminton, basketball, hockey, ringette, figure skating and other programs at community centres, pools and rinks. Matches the title, instructor, centre and calendar names and the start of the description. Returns up to 20 results whose ids work with `fetch` and `get_activity`, each with the cobac.fyi page URL.',
  inputSchema: z.object({
    query: z.string().min(1).describe('Words to look for, e.g. "yoga", "badminton", "Bonsor"'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        id: z.string().describe('Activity id, for fetch / get_activity'),
        title: z.string().describe('Title — centre (calendar, price)'),
        url: z.string().describe('cobac.fyi page for the activity'),
      }),
    ),
  }),
  async handler({ query }, ctx) {
    const [catalog, search] = await Promise.all([ctx.shards.catalog(), ctx.shards.searchContext()])
    const results = searchActivities(catalog.activities, search, query, 20).map((a) => {
      const centre = search.centerById.get(a.centerId)?.name ?? `Centre ${a.centerId}`
      const calendar = search.calendarById.get(a.calendarId)?.name ?? ''
      return {
        id: String(a.id),
        title: `${a.title} — ${centre} (${calendar}, ${priceLabel(a)})`,
        url: `${ctx.site}/activities/${a.id}/`,
      }
    })
    const structuredContent = { results }
    return { structuredContent, text: JSON.stringify(structuredContent) }
  },
})
