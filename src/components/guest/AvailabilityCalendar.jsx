import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const TZ = 'America/New_York'

function toDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

function datesInRange(start, end) {
  const dates = []
  const cur = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export default function AvailabilityCalendar() {
  const [blockedDates, setBlockedDates] = useState(new Set())
  const [today] = useState(() => toDateStr(new Date()))
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  useEffect(() => {
    async function load() {
      const [{ data: manual }, { data: ical }] = await Promise.all([
        supabase.from('blocked_dates').select('start_date,end_date'),
        supabase.from('cached_ical_blocks').select('start_date,end_date'),
      ])
      const all = new Set()
      for (const row of [...(manual || []), ...(ical || [])]) {
        for (const d of datesInRange(row.start_date, row.end_date)) all.add(d)
      }
      setBlockedDates(all)
    }
    load()
  }, [])

  function prevMonth() {
    setViewDate(v => {
      if (v.month === 0) return { year: v.year - 1, month: 11 }
      return { year: v.year, month: v.month - 1 }
    })
  }
  function nextMonth() {
    setViewDate(v => {
      if (v.month === 11) return { year: v.year + 1, month: 0 }
      return { year: v.year, month: v.month + 1 }
    })
  }

  const { year, month } = viewDate
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: TZ })

  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ day: d, dateStr, blocked: blockedDates.has(dateStr), past: dateStr < today })
  }

  return (
    <section id="availability" style={{ padding: 'var(--section-pad)', background: 'var(--color-card)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '0.04em', marginBottom: 8, textAlign: 'center' }}>Availability</h2>
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', marginBottom: 32, fontSize: '0.9rem' }}>Calendar is display only — book via the links above or submit a private inquiry below.</p>

        <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <button onClick={prevMonth} style={{ color: 'var(--color-primary)', fontSize: 20, padding: '4px 8px' }}>‹</button>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.04em' }}>{monthName}</span>
            <button onClick={nextMonth} style={{ color: 'var(--color-primary)', fontSize: 20, padding: '4px 8px' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '12px 16px 4px' }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--color-muted)', paddingBottom: 8 }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 16px 16px', gap: 4 }}>
            {days.map((d, i) => {
              if (!d) return <div key={`e${i}`} />
              return (
                <div key={d.dateStr} style={{
                  textAlign: 'center', padding: '8px 0', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem',
                  background: d.blocked ? 'var(--color-border)' : 'transparent',
                  color: d.blocked || d.past ? 'var(--color-muted)' : 'var(--color-text)',
                  textDecoration: d.blocked ? 'line-through' : 'none',
                  fontWeight: d.dateStr === today ? 600 : 400,
                  outline: d.dateStr === today ? '2px solid var(--color-primary)' : 'none',
                  outlineOffset: -2,
                }}>
                  {d.day}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 20, padding: '12px 20px', borderTop: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: 'var(--color-border)', display: 'inline-block' }} /> Unavailable
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: 'transparent', border: '1px solid var(--color-border)', display: 'inline-block' }} /> Available
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
