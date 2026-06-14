import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtShort(d) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function Bookings() {
  const [view, setView] = useState('calendar')
  const [inquiries, setInquiries] = useState([])
  const [icalBlocks, setIcalBlocks] = useState([])
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  useEffect(() => {
    supabase.from('inquiries').select('*').not('checkin', 'is', null).not('checkout', 'is', null).order('checkin').then(({ data }) => setInquiries(data || []))
    supabase.from('cached_ical_blocks').select('*').order('start_date').then(({ data }) => setIcalBlocks(data || []))
  }, [])

  const { year, month } = viewDate
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  function prevMonth() {
    setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  }
  function nextMonth() {
    setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })
  }

  function getEventsForDate(dateStr) {
    const events = []
    for (const inq of inquiries) {
      if (inq.checkin <= dateStr && inq.checkout > dateStr) {
        events.push({ type: 'inquiry', label: `${inq.first_name} ${inq.last_name}`, inq })
      }
    }
    for (const block of icalBlocks) {
      if (block.start_date <= dateStr && block.end_date >= dateStr) {
        events.push({ type: 'ical', label: block.source === 'airbnb' ? 'Airbnb' : 'VRBO', source: block.source })
      }
    }
    return events
  }

  // List view: upcoming only
  const today = new Date().toISOString().slice(0, 10)
  const upcomingInquiries = inquiries.filter(i => i.checkout >= today)
  const upcomingIcal = icalBlocks.filter(b => b.end_date >= today)
  const allUpcoming = [
    ...upcomingInquiries.map(i => ({ type: 'inquiry', start: i.checkin, end: i.checkout, label: `${i.first_name} ${i.last_name}`, sub: `${fmtDate(i.checkin)} → ${fmtDate(i.checkout)}`, status: i.status, email: i.email })),
    ...upcomingIcal.map(b => ({ type: 'ical', start: b.start_date, end: b.end_date, label: b.source === 'airbnb' ? 'Airbnb Booking' : 'VRBO Booking', sub: `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`, source: b.source })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em' }}>Bookings</h1>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {['calendar', 'list'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '8px 20px', background: view === v ? 'var(--color-primary)' : 'var(--color-card)', color: view === v ? '#fff' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
      </div>

      {view === 'calendar' ? (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <button onClick={prevMonth} style={{ color: 'var(--color-primary)', fontSize: 20, padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer' }}>‹</button>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.04em' }}>{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} style={{ color: 'var(--color-primary)', fontSize: 20, padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '12px 8px 4px', borderBottom: '1px solid var(--color-border)' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--color-muted)', paddingBottom: 8 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} style={{ borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', minHeight: 90 }} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`
              const events = getEventsForDate(dateStr)
              return (
                <div key={d} style={{ borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', minHeight: 90, padding: '6px 8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-muted)', marginBottom: 4 }}>{d}</div>
                  {events.map((ev, ei) => (
                    <div key={ei} style={{
                      fontSize: '0.7rem', fontWeight: 500, padding: '2px 5px', borderRadius: 3, marginBottom: 2,
                      background: ev.type === 'inquiry' ? 'rgba(44,74,46,0.15)' : 'rgba(0,0,0,0.07)',
                      color: ev.type === 'inquiry' ? 'var(--color-primary)' : 'var(--color-muted)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{ev.label}</div>
                  ))}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 20, padding: '12px 20px', borderTop: '1px solid var(--color-border)', fontSize: '0.75rem', color: 'var(--color-muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(44,74,46,0.15)', display: 'inline-block' }} /> Website inquiry</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(0,0,0,0.07)', display: 'inline-block' }} /> Platform booking (Airbnb/VRBO)</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!allUpcoming.length && <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 40 }}>No upcoming bookings</p>}
          {allUpcoming.map((item, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.type === 'inquiry' ? 'var(--color-primary)' : 'var(--color-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: item.type === 'ical' ? 'var(--color-muted)' : 'var(--color-text)' }}>{item.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: 2 }}>{item.sub}</div>
                {item.email && <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{item.email}</div>}
              </div>
              <div style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 100, background: item.type === 'inquiry' ? 'rgba(44,74,46,0.1)' : 'rgba(0,0,0,0.06)', color: item.type === 'inquiry' ? 'var(--color-primary)' : 'var(--color-muted)', fontWeight: 500 }}>
                {item.type === 'inquiry' ? (item.status || 'New') : (item.source === 'airbnb' ? 'Airbnb' : 'VRBO')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
