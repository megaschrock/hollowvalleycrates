import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function monthOf(s) { return new Date(s + 'T12:00:00').getMonth() }
function yearOf(s) { return new Date(s + 'T12:00:00').getFullYear() }
function fmt$(n) { if (n == null || isNaN(n)) return '—'; return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtPct(n) { if (n == null || isNaN(n)) return '—'; return Math.round(n) + '%' }

function prevMonthOf(meetingDate) {
  const d = new Date(meetingDate + 'T12:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { month: d.getMonth(), year: d.getFullYear() }
}

function calcMetrics(reservations, month, year) {
  const monthRes = reservations.filter(r => r.start_date && monthOf(r.start_date) === month && yearOf(r.start_date) === year)
  const lyMonthRes = reservations.filter(r => r.start_date && monthOf(r.start_date) === month && yearOf(r.start_date) === year - 1)
  const ytdRes = reservations.filter(r => r.start_date && yearOf(r.start_date) === year && monthOf(r.start_date) <= month)
  const ytdLYRes = reservations.filter(r => r.start_date && yearOf(r.start_date) === year - 1 && monthOf(r.start_date) <= month)

  function sum(arr, field) { return arr.reduce((s, r) => s + (r[field] || 0), 0) }
  function nights(arr) { return arr.reduce((s, r) => s + (r.nights || nightsBetween(r.start_date, r.end_date) || 0), 0) }

  const rentable = daysInMonth(year, month)
  const lyRentable = (month + 1) * daysInMonth(year - 1, month)

  const gross = sum(monthRes, 'gross_amount')
  const discounts = sum(monthRes, 'discount')
  const profitAfterDisc = gross - discounts
  const hostFees = sum(monthRes, 'host_fee')
  const netAfterFees = sum(monthRes, 'net_payout')

  const nightsBooked = nights(monthRes)
  const lyNightsBooked = nights(lyMonthRes)
  const occ = rentable > 0 ? (nightsBooked / rentable) * 100 : 0
  const lyOcc = rentable > 0 ? (lyNightsBooked / daysInMonth(year - 1, month)) * 100 : 0
  const pctInFees = gross > 0 ? (hostFees / gross) * 100 : 0

  const ytdGross = sum(ytdRes, 'gross_amount')
  const ytdDisc = sum(ytdRes, 'discount')
  const ytdProfit = ytdGross - ytdDisc
  const ytdFees = sum(ytdRes, 'host_fee')
  const ytdNet = sum(ytdRes, 'net_payout')
  const ytdNights = nights(ytdRes)
  const ytdLYNet = sum(ytdLYRes, 'net_payout')
  const ytdLYNights = nights(ytdLYRes)
  const ytdRentable = (month + 1) * rentable
  const ytdOcc = ytdRentable > 0 ? (ytdNights / ytdRentable) * 100 : 0
  const ytdLYOcc = lyRentable > 0 ? (ytdLYNights / lyRentable) * 100 : 0
  const ytdPctFees = ytdGross > 0 ? (ytdFees / ytdGross) * 100 : 0

  const adr = nightsBooked > 0 ? gross / nightsBooked : null
  const adrAfterFees = nightsBooked > 0 ? netAfterFees / nightsBooked : null
  const revpar = rentable > 0 ? netAfterFees / rentable : null
  const ytdAdr = ytdNights > 0 ? ytdGross / ytdNights : null
  const ytdAdrFees = ytdNights > 0 ? ytdNet / ytdNights : null
  const ytdRevpar = ytdRentable > 0 ? ytdNet / ytdRentable : null

  const lyGross = sum(lyMonthRes, 'gross_amount')
  const lyNet = sum(lyMonthRes, 'net_payout')

  const airbnbCount = monthRes.filter(r => r.source === 'airbnb').length
  const vrboCount = monthRes.filter(r => r.source === 'vrbo').length
  const websiteCount = monthRes.filter(r => r.source === 'website' || r.source === 'direct').length

  return {
    gross, discounts, profitAfterDisc, hostFees, netAfterFees,
    nightsBooked, rentable, occ, pctInFees,
    ytdGross, ytdDisc, ytdProfit, ytdFees, ytdNet,
    ytdNights, ytdOcc, ytdPctFees,
    lyGross, lyNet, lyNightsBooked, lyOcc,
    adr, adrAfterFees, revpar,
    ytdAdr, ytdAdrFees, ytdRevpar,
    airbnbCount, vrboCount, websiteCount,
  }
}

function nightsBetween(start, end) {
  if (!start || !end) return 0
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 86400000))
}

const inp = { padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', background: '#fff', color: 'var(--color-text)', width: '100%', boxSizing: 'border-box' }
const metricCard = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '13px 15px' }
const sectionLabel = { fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-muted)', fontWeight: 700, marginBottom: 10 }

function OverrideField({ label, value, auto, prefix = '$', suffix = '', isAuto }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef()

  useEffect(() => {
    if (!editing) setDraft(value !== undefined && value !== null && value !== '' ? String(value) : '')
  }, [value, editing])

  function startEdit() {
    setDraft(value !== undefined && value !== null && value !== '' ? String(value) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commit() {
    setEditing(false)
    const n = parseFloat(draft)
    return isNaN(n) ? null : n
  }

  const display = value !== undefined && value !== null && value !== ''
    ? `${prefix}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${suffix}`
    : (auto !== undefined && auto !== null ? `${prefix}${Number(auto).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${suffix}` : '—')

  return (
    <div style={metricCard}>
      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { const v = commit(); if (typeof window.__metricsOnChange === 'function') window.__metricsOnChange(label, v) }}
          onKeyDown={e => { if (e.key === 'Enter') { const v = commit(); if (typeof window.__metricsOnChange === 'function') window.__metricsOnChange(label, v) } if (e.key === 'Escape') { setEditing(false) } }}
          style={{ ...inp, fontSize: '1.1rem', padding: '2px 6px', width: 120 }}
          step="0.01"
        />
      ) : (
        <div onClick={startEdit} style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--color-text)', cursor: 'text', lineHeight: 1.1 }}>
          {display}
          {isAuto && <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)', marginLeft: 4, fontFamily: 'var(--font-body)' }}>auto</span>}
        </div>
      )}
    </div>
  )
}

export default function MeetingMetrics({ meetingId, meetingDate, reservations, done }) {
  const { month: prevMonth, year: prevYear } = prevMonthOf(meetingDate)
  const auto = calcMetrics(reservations, prevMonth, prevYear)

  const [report, setReport] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [expenses, setExpenses] = useState({ mortgage: '', internet: '', electric: '', trash: '', other: '' })
  const [rateNote, setRateNote] = useState('')
  const [bankBalance, setBankBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    supabase.from('monthly_reports').select('*').eq('meeting_id', meetingId).maybeSingle().then(({ data }) => {
      if (data) {
        setReport(data)
        setOverrides(data.metrics?.overrides || {})
        setExpenses(data.expenses || { mortgage: '', internet: '', electric: '', trash: '', other: '' })
        setRateNote(data.metrics?.rateNote || '')
        setBankBalance(data.metrics?.bankBalance || '')
      }
    })
  }, [meetingId])

  function val(key, autoVal) {
    return overrides[key] !== undefined && overrides[key] !== null ? overrides[key] : autoVal
  }

  function setOverride(key, v) {
    setOverrides(prev => ({ ...prev, [key]: v }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const reportMonth = new Date(prevYear, prevMonth, 1).toISOString().slice(0, 10)
    const metricsPayload = { ...auto, overrides, rateNote, bankBalance }
    const payload = { meeting_id: meetingId, report_month: reportMonth, metrics: metricsPayload, expenses, updated_at: new Date().toISOString() }
    if (report?.id) {
      await supabase.from('monthly_reports').update(payload).eq('id', report.id)
    } else {
      const { data } = await supabase.from('monthly_reports').insert(payload).select().single()
      setReport(data)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function printReport() {
    setPrinting(true)
    setTimeout(() => { window.print(); setPrinting(false) }, 100)
  }

  const totalExpenses = ['mortgage','internet','electric','trash','other'].reduce((s, k) => s + (parseFloat(expenses[k]) || 0), 0)
  const netAfterExpenses = (val('netAfterFees', auto.netAfterFees) || 0) - totalExpenses

  const prevLabel = `${MONTHS[prevMonth]} ${prevYear}`
  const lyLabel = `${MONTHS_SHORT[prevMonth]} ${prevYear - 1}`

  function MetricBlock({ label, value, auto: autoV, lyValue, lyLabel: ll, fmt, overrideKey, pctKey }) {
    const v = val(overrideKey || label, value)
    const ly = lyValue
    const diff = ly != null && v != null ? v - ly : null
    const pct = ly > 0 && diff != null ? Math.round((diff / ly) * 100) : null
    const up = pct != null && pct > 0
    const dn = pct != null && pct < 0

    return (
      <div style={metricCard}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
        <NumEditor value={v} autoVal={autoV !== undefined ? autoV : value} fmt={fmt} onChange={n => setOverride(overrideKey || label, n)} disabled={done} />
        {ly != null && (
          <div style={{ fontSize: '0.7rem', color: up ? '#2C4A2E' : dn ? '#a33' : 'var(--color-muted)', marginTop: 3 }}>
            {pct != null ? (up ? `↑ ${pct}%` : dn ? `↓ ${Math.abs(pct)}%` : '± 0%') : ''} vs {ll || lyLabel} <span style={{ color: 'var(--color-muted)' }}>({fmt(ly)})</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', margin: 0 }}>{prevLabel} Metrics</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: '3px 0 0' }}>Auto-calculated from reservations. Click any number to override.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!done && <button onClick={save} disabled={saving} style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>}
          <button onClick={printReport} style={{ padding: '8px 18px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--color-text)', cursor: 'pointer' }}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="print-only" style={{ display: 'none', marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.04em' }}>Hollow Valley Crates</div>
        <div style={{ fontSize: '1.1rem', color: '#555', marginTop: 4 }}>{prevLabel} — Monthly Report</div>
        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>

      {/* Bank balance */}
      <div style={{ marginBottom: 16 }}>
        <div style={sectionLabel}>Bank Balance</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>$</span>
          <input
            type="number"
            value={bankBalance}
            onChange={e => { setBankBalance(e.target.value); setSaved(false) }}
            placeholder="Current bank balance"
            disabled={done}
            style={{ ...inp, maxWidth: 200 }}
          />
        </div>
      </div>

      {/* Revenue Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={sectionLabel}>Revenue — {prevLabel}</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MetricBlock label="Gross Sales" value={auto.gross} autoV={auto.gross} lyValue={auto.lyGross} fmt={fmt$} overrideKey="gross" />
          <MetricBlock label="Discounts Given" value={auto.discounts} autoV={auto.discounts} fmt={fmt$} overrideKey="discounts" />
          <MetricBlock label="Profit after Discounts" value={auto.profitAfterDisc} autoV={auto.profitAfterDisc} fmt={fmt$} overrideKey="profitAfterDisc" />
          <MetricBlock label="Host Fees Paid" value={auto.hostFees} autoV={auto.hostFees} fmt={fmt$} overrideKey="hostFees" />
          <MetricBlock label="Net after Fees" value={auto.netAfterFees} autoV={auto.netAfterFees} lyValue={auto.lyNet} fmt={fmt$} overrideKey="netAfterFees" />
          <div style={metricCard}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4 }}>Net after Expenses</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: netAfterExpenses >= 0 ? 'var(--color-primary)' : '#a33', lineHeight: 1.1 }}>{fmt$(netAfterExpenses)}</div>
          </div>
        </div>
      </div>

      {/* Occupancy Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={sectionLabel}>Occupancy — {prevLabel}</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MetricBlock label="Nights Booked" value={auto.nightsBooked} autoV={auto.nightsBooked} lyValue={auto.lyNightsBooked} fmt={n => String(Math.round(n))} overrideKey="nightsBooked" />
          <MetricBlock label="Total Rentable Nights" value={auto.rentable} autoV={auto.rentable} fmt={n => String(n)} overrideKey="rentable" />
          <MetricBlock label="Occupancy Rate" value={auto.occ} autoV={auto.occ} lyValue={auto.lyOcc} fmt={fmtPct} overrideKey="occ" />
          <MetricBlock label="% Sales in Fees" value={auto.pctInFees} autoV={auto.pctInFees} fmt={fmtPct} overrideKey="pctInFees" />
          <MetricBlock label="Avg Booked Nightly Rate" value={auto.adr} autoV={auto.adr} fmt={fmt$} overrideKey="adr" />
          <MetricBlock label="Avg Rate after Fees" value={auto.adrAfterFees} autoV={auto.adrAfterFees} fmt={fmt$} overrideKey="adrAfterFees" />
          <MetricBlock label="RevPAR (Net / Rentable Nights)" value={auto.revpar} autoV={auto.revpar} fmt={fmt$} overrideKey="revpar" />
        </div>
      </div>

      {/* YTD Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={sectionLabel}>Year-to-Date {prevYear}</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MetricBlock label="YTD Gross" value={auto.ytdGross} autoV={auto.ytdGross} fmt={fmt$} overrideKey="ytdGross" />
          <MetricBlock label="YTD Discounts" value={auto.ytdDisc} autoV={auto.ytdDisc} fmt={fmt$} overrideKey="ytdDisc" />
          <MetricBlock label="YTD Profit after Discounts" value={auto.ytdProfit} autoV={auto.ytdProfit} fmt={fmt$} overrideKey="ytdProfit" />
          <MetricBlock label="YTD Host Fees" value={auto.ytdFees} autoV={auto.ytdFees} fmt={fmt$} overrideKey="ytdFees" />
          <MetricBlock label="YTD Net after Fees" value={auto.ytdNet} autoV={auto.ytdNet} fmt={fmt$} overrideKey="ytdNet" />
          <MetricBlock label="YTD Nights Booked" value={auto.ytdNights} autoV={auto.ytdNights} fmt={n => String(Math.round(n))} overrideKey="ytdNights" />
          <MetricBlock label="YTD Occupancy" value={auto.ytdOcc} autoV={auto.ytdOcc} fmt={fmtPct} overrideKey="ytdOcc" />
          <MetricBlock label="YTD % in Fees" value={auto.ytdPctFees} autoV={auto.ytdPctFees} fmt={fmtPct} overrideKey="ytdPctFees" />
          <MetricBlock label="YTD RevPAR" value={auto.ytdRevpar} autoV={auto.ytdRevpar} fmt={fmt$} overrideKey="ytdRevpar" />
        </div>
      </div>

      {/* Booking Sources */}
      <div style={{ marginBottom: 20 }}>
        <div style={sectionLabel}>Bookings by Source — {prevLabel}</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MetricBlock label="Airbnb Bookings" value={auto.airbnbCount} autoV={auto.airbnbCount} fmt={n => String(n)} overrideKey="airbnbCount" />
          <MetricBlock label="VRBO Bookings" value={auto.vrboCount} autoV={auto.vrboCount} fmt={n => String(n)} overrideKey="vrboCount" />
          <MetricBlock label="Website / Direct" value={auto.websiteCount} autoV={auto.websiteCount} fmt={n => String(n)} overrideKey="websiteCount" />
        </div>
      </div>

      {/* Rates for the Month */}
      <div style={{ marginBottom: 20 }}>
        <div style={sectionLabel}>Rates for {prevLabel}</div>
        <textarea
          value={rateNote}
          onChange={e => { setRateNote(e.target.value); setSaved(false) }}
          placeholder="e.g. Weeknight: $225 / Weekend: $275 / Holiday: $325"
          disabled={done}
          rows={2}
          style={{ ...inp, resize: 'vertical' }}
        />
      </div>

      {/* Expenses */}
      <div style={{ marginBottom: 20 }}>
        <div style={sectionLabel}>Monthly Expenses</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['Mortgage','mortgage'],['Internet','internet'],['Electric','electric'],['Trash','trash'],['Other','other']].map(([label, key]) => (
            <div key={key} style={metricCard}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>$</span>
                <input
                  type="number"
                  value={expenses[key]}
                  onChange={e => { setExpenses(prev => ({ ...prev, [key]: e.target.value })); setSaved(false) }}
                  disabled={done}
                  placeholder="0"
                  style={{ ...inp, padding: '3px 6px', fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}
                  step="0.01"
                />
              </div>
            </div>
          ))}
          <div style={{ ...metricCard, background: 'rgba(44,74,46,0.04)', borderColor: 'rgba(44,74,46,0.2)' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4 }}>Total Expenses</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--color-text)', lineHeight: 1.1 }}>{fmt$(totalExpenses)}</div>
          </div>
        </div>
      </div>

      {!done && (
        <div className="no-print" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Report'}
          </button>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: #fff; color: #000; }
          .metrics-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 380px) {
          .metrics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function NumEditor({ value, autoVal, fmt, onChange, disabled }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef()

  function start() {
    if (disabled) return
    setDraft(value !== null && value !== undefined ? String(Math.round(value)) : '')
    setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  function commit() {
    setEditing(false)
    const n = parseFloat(draft)
    if (!isNaN(n)) onChange(n)
    else onChange(null)
  }

  const display = value !== null && value !== undefined ? fmt(value) : (autoVal !== null && autoVal !== undefined ? fmt(autoVal) : '—')
  const isOverridden = value !== null && value !== undefined

  return editing ? (
    <input
      ref={ref}
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ ...inp, fontFamily: 'var(--font-display)', fontSize: '1.2rem', padding: '2px 6px', width: 120 }}
      step="0.01"
    />
  ) : (
    <div
      onClick={start}
      style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--color-text)', lineHeight: 1.1, cursor: disabled ? 'default' : 'text', display: 'flex', alignItems: 'baseline', gap: 4 }}
    >
      {display}
      {isOverridden && !disabled && <span style={{ fontSize: '0.6rem', color: '#a33', fontFamily: 'var(--font-body)' }}>overridden</span>}
    </div>
  )
}
