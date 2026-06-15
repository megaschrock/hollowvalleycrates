import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['sun','mon','tue','wed','thu','fri','sat']
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', background: '#fff', color: 'var(--color-text)' }
const labelStyle = { display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }
const btnPrimary = { padding: '10px 20px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }

export default function Bookings() {
  const [view, setView] = useState('calendar')
  const [inquiries, setInquiries] = useState([])
  const [icalBlocks, setIcalBlocks] = useState([])
  const [blockRows, setBlockRows] = useState([])
  const [baseRates, setBaseRates] = useState({})
  const [priceOverrides, setPriceOverrides] = useState([])
  const [newBlock, setNewBlock] = useState({ start_date:'', end_date:'', reason:'' })
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  // Date selection state
  const [selStart, setSelStart] = useState(null)
  const [selEnd, setSelEnd] = useState(null)
  const [hoverDate, setHoverDate] = useState(null)
  const [selectingEnd, setSelectingEnd] = useState(false)

  // Action panel
  const [action, setAction] = useState(null) // 'block' | 'price'
  const [blockReason, setBlockReason] = useState('')
  const [priceLabel, setPriceLabel] = useState('')
  const [priceRates, setPriceRates] = useState({ sun:'', mon:'', tue:'', wed:'', thu:'', fri:'', sat:'' })
  const [priceRepeatYearly, setPriceRepeatYearly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    supabase.from('inquiries').select('*').not('checkin', 'is', null).not('checkout', 'is', null).order('checkin').then(({ data }) => setInquiries(data || []))
    supabase.from('cached_ical_blocks').select('*').order('start_date').then(({ data }) => setIcalBlocks(data || []))
    supabase.from('blocked_dates').select('*').order('start_date').then(({ data }) => setBlockRows(data || []))
    supabase.from('pricing_base').select('*').then(({ data }) => {
      if (data) { const m = {}; data.forEach(r => { m[r.day_of_week] = r.rate }); setBaseRates(m) }
    })
    supabase.from('pricing_overrides').select('*').then(({ data }) => setPriceOverrides(data || []))
  }, [])

  function getRateForDate(dateStr) {
    const dow = new Date(dateStr + 'T12:00:00').getDay()
    const keys = ['sun','mon','tue','wed','thu','fri','sat']
    const [year, month, day] = dateStr.split('-')
    for (const ovr of priceOverrides) {
      let matches = dateStr >= ovr.start_date && dateStr <= ovr.end_date
      if (!matches && ovr.repeat_yearly) {
        const [sy, sm, sd] = ovr.start_date.split('-')
        const [ey, em, ed] = ovr.end_date.split('-')
        const thisStart = `${year}-${sm}-${sd}`
        const thisEnd = sm === em ? `${year}-${em}-${ed}` : `${Number(year) + (em < sm ? 1 : 0)}-${em}-${ed}`
        matches = dateStr >= thisStart && dateStr <= thisEnd
      }
      if (matches) {
        const val = ovr[keys[dow]]
        if (val != null) return Number(val)
      }
    }
    return baseRates[dow] ? Number(baseRates[dow]) : null
  }

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

  function handleDateClick(dateStr) {
    if (!selStart || !selectingEnd) {
      setSelStart(dateStr)
      setSelEnd(null)
      setSelectingEnd(true)
      setAction(null)
      setSavedMsg('')
    } else {
      if (dateStr <= selStart) {
        setSelStart(dateStr)
        setSelEnd(null)
        return
      }
      setSelEnd(dateStr)
      setSelectingEnd(false)
      setAction(null)
      setSavedMsg('')
      setPriceLabel('')
      setPriceRates({ sun:'', mon:'', tue:'', wed:'', thu:'', fri:'', sat:'' })
      setPriceRepeatYearly(false)
      setBlockReason('')
    }
  }

  function clearSelection() {
    setSelStart(null); setSelEnd(null); setSelectingEnd(false); setAction(null); setSavedMsg('')
  }

  function getEventsForDate(dateStr) {
    const events = []
    for (const inq of inquiries) {
      if (inq.checkin <= dateStr && inq.checkout > dateStr)
        events.push({ type: 'inquiry', label: `${inq.first_name} ${inq.last_name}` })
    }
    for (const block of icalBlocks) {
      if (block.start_date <= dateStr && block.end_date >= dateStr)
        events.push({ type: block.source === 'airbnb' ? 'airbnb' : 'vrbo', label: block.source === 'airbnb' ? 'Airbnb' : 'VRBO' })
    }
    for (const block of blockRows) {
      if (block.start_date <= dateStr && block.end_date >= dateStr)
        events.push({ type: 'manual', label: block.reason || 'Hold' })
    }
    return events
  }

  function isInSelRange(dateStr) {
    const end = selectingEnd && hoverDate ? hoverDate : selEnd
    if (!selStart || !end) return false
    return dateStr > selStart && dateStr < end
  }

  async function saveBlock() {
    if (!selStart || !selEnd) return
    setSaving(true)
    const { data } = await supabase.from('blocked_dates').insert([{
      start_date: selStart, end_date: selEnd,
      reason: blockReason || 'Manual hold',
      created_at: new Date().toISOString(),
    }]).select().single()
    if (data) setBlockRows(r => [...r, data])
    setSaving(false)
    setSavedMsg('Dates blocked successfully.')
    setAction(null)
  }

  async function savePriceOverride() {
    if (!selStart || !selEnd || !priceLabel) return
    setSaving(true)
    const payload = {
      label: priceLabel, start_date: selStart, end_date: selEnd,
      repeat_yearly: priceRepeatYearly,
      created_at: new Date().toISOString(),
    }
    DAYS.forEach(d => { payload[d] = Number(priceRates[d]) || null })
    await supabase.from('pricing_overrides').insert([payload])
    setSaving(false)
    setSavedMsg('Price override saved.')
    setAction(null)
  }

  async function addBlock() {
    if (!newBlock.start_date || !newBlock.end_date) return
    const { data } = await supabase.from('blocked_dates').insert([{ ...newBlock, created_at: new Date().toISOString() }]).select().single()
    if (data) { setBlockRows(r => [...r, data]); setNewBlock({ start_date:'', end_date:'', reason:'' }) }
  }

  async function deleteBlock(id) {
    await supabase.from('blocked_dates').delete().eq('id', id)
    setBlockRows(r => r.filter(b => b.id !== id))
  }

  const upcomingInquiries = inquiries.filter(i => i.checkout >= today)
  const upcomingIcal = icalBlocks.filter(b => b.end_date >= today)
  const upcomingBlocks = blockRows.filter(b => b.end_date >= today)
  const allUpcoming = [
    ...upcomingInquiries.map(i => ({ type: i.status === 'Confirmed' ? 'booking' : 'inquiry', start: i.checkin, end: i.checkout, label: `${i.first_name} ${i.last_name}`, sub: `${fmtDate(i.checkin)} → ${fmtDate(i.checkout)}`, status: i.status, email: i.email })),
    ...upcomingIcal.map(b => ({ type: b.source === 'airbnb' ? 'airbnb' : 'vrbo', start: b.start_date, end: b.end_date, label: b.source === 'airbnb' ? 'Airbnb' : 'VRBO', sub: `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`, source: b.source })),
    ...upcomingBlocks.map(b => ({ type: 'manual', start: b.start_date, end: b.end_date, label: b.reason || 'Hold', sub: `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`, id: b.id })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  const eventColors = {
    inquiry:  { bg: 'rgba(234,179,8,0.22)',   color: '#92700a' },
    booking:  { bg: 'rgba(34,139,34,0.22)',    color: '#1a6b1a' },
    airbnb:   { bg: 'rgba(220,53,69,0.18)',    color: '#a71d2a' },
    vrbo:     { bg: 'rgba(59,130,246,0.18)',   color: '#1d5bbf' },
    manual:   { bg: 'rgba(120,120,130,0.18)',  color: '#555560' },
  }

  const displayEnd = selectingEnd && hoverDate ? hoverDate : selEnd

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em' }}>Calendar</h1>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {['calendar', 'list'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '8px 20px', background: view === v ? 'var(--color-primary)' : 'var(--color-card)', color: view === v ? '#fff' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
      </div>

      {view === 'calendar' ? (
        <>
          <style>{`
            .admin-cal-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
            .admin-cal-grid { min-width: 560px; }
            @media (max-width: 600px) {
              .admin-cal-cell { min-height: 54px !important; padding: 3px 4px !important; }
              .admin-cal-cell-label { font-size: 0.7rem !important; }
              .admin-cal-cell-rate { display: none !important; }
              .admin-cal-cell-event { font-size: 0.55rem !important; }
            }
          `}</style>
          <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <button onClick={prevMonth} style={{ color: 'var(--color-primary)', fontSize: 20, padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer' }}>‹</button>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.04em' }}>{MONTHS[month]} {year}</span>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: 2 }}>
                  {!selStart ? 'Click a date to begin a selection' : !selEnd ? 'Now click the end date' : `${fmtDate(selStart)} → ${fmtDate(selEnd)} · Choose an action below`}
                </div>
              </div>
              <button onClick={nextMonth} style={{ color: 'var(--color-primary)', fontSize: 20, padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer' }}>›</button>
            </div>
            <div className="admin-cal-wrap">
            <div className="admin-cal-grid">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '12px 8px 4px', borderBottom: '1px solid var(--color-border)' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--color-muted)', paddingBottom: 8 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} className="admin-cal-cell" style={{ borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', minHeight: 80 }} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`
                const events = getEventsForDate(dateStr)
                const isStart = dateStr === selStart
                const isEnd = dateStr === selEnd || (selectingEnd && dateStr === hoverDate && hoverDate > selStart)
                const inRange = isInSelRange(dateStr)
                const rate = getRateForDate(dateStr)

                return (
                  <div
                    key={d}
                    className="admin-cal-cell"
                    onClick={() => handleDateClick(dateStr)}
                    onMouseEnter={() => selectingEnd && setHoverDate(dateStr)}
                    onMouseLeave={() => selectingEnd && setHoverDate(null)}
                    style={{
                      borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)',
                      minHeight: 80, padding: '6px 8px', cursor: 'pointer',
                      background: isStart || isEnd ? 'var(--color-primary)' : inRange ? 'rgba(44,74,46,0.08)' : '#fff',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span className="admin-cal-cell-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: isStart || isEnd ? '#fff' : 'var(--color-text)' }}>{d}</span>
                      {rate && <span className="admin-cal-cell-rate" style={{ fontSize: '0.65rem', color: isStart || isEnd ? 'rgba(255,255,255,0.8)' : 'var(--color-muted)' }}>${rate}</span>}
                    </div>
                    {events.map((ev, ei) => (
                      <div key={ei} className="admin-cal-cell-event" style={{
                        fontSize: '0.65rem', fontWeight: 500, padding: '1px 4px', borderRadius: 2, marginBottom: 2,
                        background: isStart || isEnd ? 'rgba(255,255,255,0.25)' : eventColors[ev.type].bg,
                        color: isStart || isEnd ? '#fff' : eventColors[ev.type].color,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{ev.label}</div>
                    ))}
                  </div>
                )
              })}
            </div>
            </div>{/* admin-cal-grid */}
            </div>{/* admin-cal-wrap */}
            <div style={{ display: 'flex', gap: 20, padding: '12px 20px', borderTop: '1px solid var(--color-border)', fontSize: '0.75rem', color: 'var(--color-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(234,179,8,0.22)', display: 'inline-block' }} /> Inquiry</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(34,139,34,0.22)', display: 'inline-block' }} /> Website booking</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(220,53,69,0.18)', display: 'inline-block' }} /> Airbnb</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(59,130,246,0.18)', display: 'inline-block' }} /> VRBO</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(120,120,130,0.18)', display: 'inline-block' }} /> Blocked</span>
            </div>
          </div>

          {/* Action panel */}
          {selStart && selEnd && (
            <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{fmtDate(selStart)} → {fmtDate(selEnd)}</span>
                <button onClick={clearSelection} style={{ fontSize: '0.8rem', color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear selection ×</button>
              </div>

              {savedMsg && <p style={{ color: 'var(--color-primary)', fontSize: '0.85rem', marginBottom: 12 }}>{savedMsg}</p>}

              {!action && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => setAction('block')} style={{ ...btnPrimary, background: '#c0392b' }}>Block These Dates</button>
                  <button onClick={() => setAction('price')} style={{ ...btnPrimary, background: 'var(--color-secondary)', color: 'var(--color-text)' }}>Set Price Override</button>
                </div>
              )}

              {action === 'block' && (
                <div>
                  <label style={labelStyle}>Reason (optional)</label>
                  <input style={{ ...inputStyle, maxWidth: 360, marginBottom: 14 }} value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="e.g. Personal use, maintenance…" />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={saveBlock} disabled={saving} style={{ ...btnPrimary, background: '#c0392b' }}>{saving ? 'Saving…' : 'Confirm Block'}</button>
                    <button onClick={() => setAction(null)} style={{ padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
                  </div>
                </div>
              )}

              {action === 'price' && (
                <div>
                  <label style={labelStyle}>Override Label</label>
                  <input style={{ ...inputStyle, maxWidth: 360, marginBottom: 10 }} value={priceLabel} onChange={e => setPriceLabel(e.target.value)} placeholder="e.g. Labor Day Weekend 2026" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}>
                    <input type="checkbox" checked={priceRepeatYearly} onChange={e => setPriceRepeatYearly(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>Repeat every year</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>(auto-applies same dates in future years)</span>
                  </label>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: 10 }}>Set nightly rates for each day of the week within this range. Leave blank to use base rate.</p>
                  <style>{`.cal-price-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 10px; margin-bottom: 16px; }
                    @media (max-width: 600px) { .cal-price-grid { grid-template-columns: repeat(4,1fr); } }`}</style>
                  <div className="cal-price-grid">
                    {DAYS.map((d, i) => (
                      <div key={d}>
                        <label style={{ ...labelStyle, textAlign: 'center' }}>{DAY_LABELS[i]}</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', fontSize: '0.85rem' }}>$</span>
                          <input type="number" min="0" style={{ ...inputStyle, paddingLeft: 18, textAlign: 'center', fontSize: '0.85rem' }} value={priceRates[d]} onChange={e => setPriceRates(r => ({ ...r, [d]: e.target.value }))} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={savePriceOverride} disabled={saving || !priceLabel} style={{ ...btnPrimary, opacity: !priceLabel ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save Override'}</button>
                    <button onClick={() => setAction(null)} style={{ padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {!allUpcoming.length && <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 40 }}>No upcoming bookings</p>}
          {allUpcoming.map((item, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: { inquiry: '#d4a017', booking: '#1a6b1a', airbnb: '#a71d2a', vrbo: '#1d5bbf', manual: '#888' }[item.type] || '#888' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text)' }}>{item.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: 2 }}>{item.sub}</div>
                {item.email && <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{item.email}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 100, fontWeight: 500, background: (eventColors[item.type] || eventColors.manual).bg, color: (eventColors[item.type] || eventColors.manual).color }}>
                  {item.type === 'inquiry' ? (item.status || 'Inquiry') : item.type === 'booking' ? 'Booked' : item.type === 'airbnb' ? 'Airbnb' : item.type === 'vrbo' ? 'VRBO' : 'Hold'}
                </div>
                {item.type === 'manual' && (
                  <button onClick={() => deleteBlock(item.id)} style={{ fontSize: '0.75rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Holds */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.03em', marginBottom: 16 }}>Manual Holds</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Start','End','Reason',''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 500 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {blockRows.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 12px' }}>{b.start_date}</td>
                <td style={{ padding: '10px 12px' }}>{b.end_date}</td>
                <td style={{ padding: '10px 12px', color: 'var(--color-muted)' }}>{b.reason || '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => deleteBlock(b.id)} style={{ color: '#c0392b', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
            {!blockRows.length && <tr><td colSpan={4} style={{ padding: '16px 12px', color: 'var(--color-muted)', textAlign: 'center' }}>No manual holds</td></tr>}
          </tbody>
        </table>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>Add Hold</h3>
        <style>{`.add-hold-grid { display: grid; grid-template-columns: 1fr 1fr 2fr auto; gap: 10px; align-items: end; }
          @media (max-width: 600px) { .add-hold-grid { grid-template-columns: 1fr 1fr; } .add-hold-grid button { grid-column: span 2; } }`}</style>
        <div className="add-hold-grid">
          <div>
            <label style={labelStyle}>Start</label>
            <input type="date" style={inputStyle} value={newBlock.start_date} onChange={e => setNewBlock(b => ({ ...b, start_date: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>End</label>
            <input type="date" style={inputStyle} value={newBlock.end_date} onChange={e => setNewBlock(b => ({ ...b, end_date: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Reason</label>
            <input style={inputStyle} value={newBlock.reason} onChange={e => setNewBlock(b => ({ ...b, reason: e.target.value }))} placeholder="Optional" />
          </div>
          <button onClick={addBlock} style={btnPrimary}>Add</button>
        </div>
      </div>
    </div>
  )
}
