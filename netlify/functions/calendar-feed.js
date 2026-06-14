export default async function handler(req, context) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY

    const res = await fetch(`${supabaseUrl}/rest/v1/blocked_dates?select=id,start_date,end_date,reason`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    })

    const blocks = await res.json()
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

    const events = (blocks || []).map(b => {
      const uid = `hvc-${b.id}@hollowvalleycrates.com`
      const dtstart = b.start_date.replace(/-/g, '')
      const endDate = new Date(b.end_date + 'T12:00:00')
      endDate.setDate(endDate.getDate() + 1)
      const dtend = endDate.toISOString().slice(0, 10).replace(/-/g, '')
      const summary = b.reason || 'Blocked'

      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${summary}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT',
      ].join('\r\n')
    })

    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Hollow Valley Crates//Blocked Dates//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Hollow Valley Crates',
      'X-WR-TIMEZONE:America/New_York',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n')

    return new Response(ical, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="hollow-valley-crates.ics"',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Hollow Valley Crates//EN\r\nEND:VCALENDAR', {
      status: 200,
      headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
    })
  }
}
