function parseIcal(text) {
  const events = []
  const lines = text.replace(/\r\n /g, '').replace(/\r\n/g, '\n').split('\n')
  let inEvent = false
  let current = {}
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; current = {} }
    else if (line === 'END:VEVENT') {
      inEvent = false
      if (current.start && current.end) events.push(current)
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        const val = line.split(':')[1]?.trim()
        if (val) current.start = val.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':')[1]?.trim()
        if (val) current.end = val.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      } else if (line.startsWith('SUMMARY:')) {
        current.summary = line.slice(8)
      }
    }
  }
  return events
}

export default async function handler(req, context) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    }

    const settingsRes = await fetch(`${supabaseUrl}/rest/v1/settings?id=eq.1&select=airbnb_ical_url,vrbo_ical_url`, { headers })
    const [settings] = await settingsRes.json()
    if (!settings) return new Response('No settings', { status: 500 })

    const sources = [
      { key: 'airbnb', url: settings.airbnb_ical_url },
      { key: 'vrbo', url: settings.vrbo_ical_url },
    ].filter(s => s.url)

    for (const source of sources) {
      try {
        const res = await fetch(source.url)
        if (!res.ok) continue
        const text = await res.text()
        const events = parseIcal(text)

        await fetch(`${supabaseUrl}/rest/v1/cached_ical_blocks?source=eq.${source.key}`, { method: 'DELETE', headers })

        if (events.length) {
          await fetch(`${supabaseUrl}/rest/v1/cached_ical_blocks`, {
            method: 'POST',
            headers,
            body: JSON.stringify(events.map(e => ({
              source: source.key,
              start_date: e.start,
              end_date: e.end,
              summary: e.summary || '',
              last_synced: new Date().toISOString(),
            }))),
          })
        }
      } catch {}
    }

    await fetch(`${supabaseUrl}/rest/v1/settings?id=eq.1`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ last_ical_refresh: new Date().toISOString() }),
    })

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export const config = {
  schedule: '0 * * * *'
}
