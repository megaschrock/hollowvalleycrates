import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function formatDate(dateStr) {
  return dateStr.replace(/-/g, '')
}

export default async function handler(req, context) {
  const { data: blocks } = await supabase.from('blocked_dates').select('start_date,end_date,reason')

  const events = (blocks || []).map((b, i) => [
    'BEGIN:VEVENT',
    `UID:hvc-block-${i}-${b.start_date}@hollowvalleycrates.com`,
    `DTSTART;VALUE=DATE:${formatDate(b.start_date)}`,
    `DTEND;VALUE=DATE:${formatDate(b.end_date)}`,
    `SUMMARY:${b.reason || 'Blocked'}`,
    'END:VEVENT',
  ].join('\r\n')).join('\r\n')

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hollow Valley Crates//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  return new Response(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hollow-valley-crates.ics"',
      'Cache-Control': 'no-cache',
    },
  })
}
