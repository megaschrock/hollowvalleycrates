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

function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDay()
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function nightsBetween(checkin, checkout) {
  const a = new Date(checkin + 'T12:00:00')
  const b = new Date(checkout + 'T12:00:00')
  return Math.round((b - a) / 86400000)
}

export default function AvailabilityCalendar({ onDatesSelected, selectedCheckin, selectedCheckout }) {
  const [blockedDates, setBlockedDates] = useState(new Set())
  const [baseRates, setBaseRates] = useState({})
  const [overrides, setOverrides] = useState([])
  const [today] = useState(() => toDateStr(new Date()))
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [hoverDate, setHoverDate] = useState(null)
  const [selectingCheckout, setSelectingCheckout] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: manual }, { data: ical }, { data: base }, { data: ovr }] = await Promise.all([
        supabase.from('blocked_dates').select('start_date,end_date'),
        supabase.from('cached_ical_blocks').select('start_date,end_date'),
        supabase.from('pricing_base').select('*').order('day_of_week'),
        supabase.from('pricing_overrides').select('*'),
      ])
      const all = new Set()
      for (const row of [...(manual || []), ...(ical || [])]) {
        for (const d of datesInRange(row.start_date, row.end_date)) all.add(d)
      }
      setBlockedDates(all)
      const rateMap = {}
      for (const row of (base || [])) rateMap[row.day_of_week] = row.rate
      setBaseRates(rateMap)
      setOverrides(ovr || [])
    }
    load()
  }, [])

  function getRateForDate(dateStr) {
    const dow = getDayOfWeek(dateStr)
    // Check overrides first
    for (const ovr of overrides) {
      if (dateStr >= ovr.start_date && dateStr <= ovr.end_date) {
        const keys = ['sun','mon','tue','wed','thu','fri','sat']
        const val = ovr[keys[dow]]
        if (val != null) return Number(val)
      }
    }
    return baseRates[dow] ? Number(baseRates[dow]) : null
  }

  function getPriceBreakdown(checkin, checkout) {
    if (!checkin || !checkout) return null
    const nights = nightsBetween(checkin, checkout)
    if (nights <= 0) return null
    const lines = []
    let subtotal = 0
    const cur = new Date(checkin + 'T12:00:00')
    for (let i = 0; i < nights; i++) {
      const dateStr = cur.toISOString().slice(0, 10)
      const rate = getRateForDate(dateStr)
      if (rate) {
        lines.push({ date: dateStr, rate })
        subtotal += rate
      }
      cur.setDate(cur.getDate() + 1)
    }
    return { nights, lines, subtotal }
  }

  function handleDateClick(dateStr) {
    if (blockedDates.has(dateStr) || dateStr < today) return

    if (!selectedCheckin || selectingCheckout === false && selectedCheckin) {
      // Start fresh selection
      onDatesSelected(dateStr, null)
      setSelectingCheckout(true)
      return
    }

    if (selectingCheckout) {
      if (dateStr <= selectedCheckin) {
        // Clicked before checkin — restart
        onDatesSelected(dateStr, null)
        return
      }
      // Check no blocked dates in range
      const range = datesInRange(selectedCheckin, addDays(dateStr, -1))
      const hasBlocked = range.some(d => blockedDates.has(d))
      if (hasBlocked) {
        onDatesSelected(dateStr, null)
        return
      }
      onDatesSelected(selectedCheckin, dateStr)
      setSelectingCheckout(false)
    }
  }

  function isInSelectedRange(dateStr) {
    const end = selectingCheckout && hoverDate ? hoverDate : selectedCheckout
    if (!selectedCheckin || !end) return false
    return dateStr > selectedCheckin && dateStr < end
  }

  function prevMonth() {
    setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  }
  function nextMonth() {
    setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })
  }

  const { year, month } = viewDate
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: TZ })

  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const blocked = blockedDates.has(dateStr)
    const past = dateStr < today
    const rate = (!blocked && !past) ? getRateForDate(dateStr) : null
    days.push({ day: d, dateStr, blocked, past, rate })
  }

  const breakdown = getPriceBreakdown(selectedCheckin, selectedCheckout)
  const hoverEnd = selectingCheckout && hoverDate ? hoverDate : selectedCheckout

  return (
    <section id="availability" style={{ padding: 'var(--section-pad)', background: 'var(--color-card)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '0.04em', marginBottom: 8, textAlign: 'center' }}>Check Availability</h2>
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', marginBottom: 32, fontSize: '0.9rem' }}>
          {!selectedCheckin ? 'Select your check-in date' : selectingCheckout ? 'Now select your check-out date' : 'Dates selected — fill out the form below to request booking'}
        </p>

        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <button onClick={prevMonth} style={{ color: 'var(--color-primary)', fontSize: 20, padding: '4px 8px' }}>‹</button>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.04em' }}>{monthName}</span>
            <button onClick={nextMonth} style={{ color: 'var(--color-primary)', fontSize: 20, padding: '4px 8px' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '12px 8px 4px' }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--color-muted)', paddingBottom: 8 }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 8px 12px', gap: 2 }}>
            {days.map((d, i) => {
              if (!d) return <div key={`e${i}`} />
              const isCheckin = d.dateStr === selectedCheckin
              const isCheckout = d.dateStr === selectedCheckout
              const inRange = isInSelectedRange(d.dateStr)
              const isHoverEnd = selectingCheckout && d.dateStr === hoverDate && d.dateStr > selectedCheckin
              const clickable = !d.blocked && !d.past

              return (
                <div
                  key={d.dateStr}
                  onClick={() => clickable && handleDateClick(d.dateStr)}
                  onMouseEnter={() => selectingCheckout && setHoverDate(d.dateStr)}
                  onMouseLeave={() => selectingCheckout && setHoverDate(null)}
                  style={{
                    textAlign: 'center', padding: '6px 2px', borderRadius: 'var(--radius-sm)',
                    cursor: clickable ? 'pointer' : 'default',
                    background: isCheckin || isCheckout || isHoverEnd
                      ? 'var(--color-primary)'
                      : inRange ? 'rgba(44,74,46,0.12)'
                      : d.blocked ? 'var(--color-border)'
                      : 'transparent',
                    color: isCheckin || isCheckout || isHoverEnd ? '#fff'
                      : d.blocked || d.past ? 'var(--color-muted)'
                      : 'var(--color-text)',
                    opacity: d.past ? 0.4 : 1,
                    outline: d.dateStr === today ? '2px solid var(--color-primary)' : 'none',
                    outlineOffset: -2,
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: isCheckin || isCheckout ? 600 : 400, lineHeight: 1.3 }}>{d.day}</div>
                  {d.rate && !d.blocked && !d.past && (
                    <div style={{ fontSize: '0.6rem', opacity: isCheckin || isCheckout ? 0.8 : 0.65, letterSpacing: '0.02em' }}>${d.rate}</div>
                  )}
                  {d.blocked && (
                    <div style={{ fontSize: '0.55rem', opacity: 0.5 }}>—</div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 20, padding: '12px 20px', borderTop: '1px solid var(--color-border)', fontSize: '0.75rem', color: 'var(--color-muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: 'var(--color-border)', display: 'inline-block' }} /> Unavailable
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: 'var(--color-primary)', display: 'inline-block' }} /> Selected
            </span>
          </div>
        </div>

        {/* Price summary */}
        {breakdown && (
          <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{breakdown.nights} night{breakdown.nights > 1 ? 's' : ''}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--color-primary)' }}>${breakdown.subtotal.toLocaleString()}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {breakdown.lines.map(l => (
                <div key={l.date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                  <span>{new Date(l.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span>${l.rate}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>Subtotal</span>
              <span>${breakdown.subtotal.toLocaleString()}</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 8 }}>Cleaning fee and pet fee (if applicable) added at confirmation.</p>
            <a href="#inquiry" style={{ display: 'block', textAlign: 'center', marginTop: 16, padding: '13px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', letterSpacing: '0.08em', fontWeight: 500 }}>
              Request to Book
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
