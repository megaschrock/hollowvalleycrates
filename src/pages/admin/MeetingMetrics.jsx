import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function monthOf(s) { return new Date(s + 'T12:00:00').getMonth() }
function yearOf(s) { return new Date(s + 'T12:00:00').getFullYear() }
function fmt$(n) { if (n == null || isNaN(n)) return '—'; return '$' + Math.round(Math.abs(n)).toLocaleString('en-US') }
function fmtPct(n) { if (n == null || isNaN(n)) return '—'; return Math.round(n) + '%' }
function fmtN(n) { if (n == null || isNaN(n)) return '—'; return String(Math.round(n)) }
function uid() { return Math.random().toString(36).slice(2) }

function prevMonthOf(meetingDate) {
  const d = new Date(meetingDate + 'T12:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { month: d.getMonth(), year: d.getFullYear() }
}

function nightsBetween(start, end) {
  if (!start || !end) return 0
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 86400000))
}

function calcMetrics(reservations, month, year) {
  const monthRes = reservations.filter(r => r.start_date && monthOf(r.start_date) === month && yearOf(r.start_date) === year)
  const lyMonthRes = reservations.filter(r => r.start_date && monthOf(r.start_date) === month && yearOf(r.start_date) === year - 1)
  const ytdRes = reservations.filter(r => r.start_date && yearOf(r.start_date) === year && monthOf(r.start_date) <= month)
  const ytdLYRes = reservations.filter(r => r.start_date && yearOf(r.start_date) === year - 1 && monthOf(r.start_date) <= month)

  function sum(arr, field) { return arr.reduce((s, r) => s + (r[field] || 0), 0) }
  function nights(arr) { return arr.reduce((s, r) => s + (r.nights || nightsBetween(r.start_date, r.end_date) || 0), 0) }

  const rentable = daysInMonth(year, month)
  const lyRentable = daysInMonth(year - 1, month)
  const ytdRentable = (month + 1) * rentable
  const ytdLYRentable = (month + 1) * lyRentable

  const gross = sum(monthRes, 'gross_amount')
  const discounts = sum(monthRes, 'discount')
  const profitAfterDisc = gross - discounts
  const hostFees = sum(monthRes, 'host_fee')
  const netAfterFees = sum(monthRes, 'net_payout')
  const nightsBooked = nights(monthRes)
  const occ = rentable > 0 ? (nightsBooked / rentable) * 100 : 0
  const pctInFees = gross > 0 ? (hostFees / gross) * 100 : 0
  const adr = nightsBooked > 0 ? gross / nightsBooked : null
  const adrAfterFees = nightsBooked > 0 ? netAfterFees / nightsBooked : null
  const revpar = rentable > 0 ? netAfterFees / rentable : null

  const lyGross = sum(lyMonthRes, 'gross_amount')
  const lyNet = sum(lyMonthRes, 'net_payout')
  const lyNightsBooked = nights(lyMonthRes)
  const lyOcc = lyRentable > 0 ? (lyNightsBooked / lyRentable) * 100 : 0

  const ytdGross = sum(ytdRes, 'gross_amount')
  const ytdDisc = sum(ytdRes, 'discount')
  const ytdProfit = ytdGross - ytdDisc
  const ytdFees = sum(ytdRes, 'host_fee')
  const ytdNet = sum(ytdRes, 'net_payout')
  const ytdNights = nights(ytdRes)
  const ytdOcc = ytdRentable > 0 ? (ytdNights / ytdRentable) * 100 : 0
  const ytdPctFees = ytdGross > 0 ? (ytdFees / ytdGross) * 100 : 0
  const ytdAdr = ytdNights > 0 ? ytdGross / ytdNights : null
  const ytdAdrFees = ytdNights > 0 ? ytdNet / ytdNights : null
  const ytdRevpar = ytdRentable > 0 ? ytdNet / ytdRentable : null

  const airbnbCount = monthRes.filter(r => r.source === 'airbnb').length
  const vrboCount = monthRes.filter(r => r.source === 'vrbo').length
  const websiteCount = monthRes.filter(r => r.source === 'website' || r.source === 'direct').length

  return {
    gross, discounts, profitAfterDisc, hostFees, netAfterFees,
    nightsBooked, rentable, occ, pctInFees, adr, adrAfterFees, revpar,
    lyGross, lyNet, lyNightsBooked, lyOcc,
    ytdGross, ytdDisc, ytdProfit, ytdFees, ytdNet,
    ytdNights, ytdOcc, ytdPctFees, ytdAdr, ytdAdrFees, ytdRevpar,
    airbnbCount, vrboCount, websiteCount,
  }
}

function migrateExpenses(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return []
  return Object.entries(obj)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => ({
      id: uid(),
      name: k.charAt(0).toUpperCase() + k.slice(1),
      amount: parseFloat(v) || 0,
      recurring: ['mortgage', 'internet'].includes(k),
    }))
}

const inp = { padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', background: '#fff', color: 'var(--color-text)', boxSizing: 'border-box' }
const metricCard = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', position: 'relative' }
const sectionLabel = { fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-muted)', fontWeight: 700, marginBottom: 10 }

export default function MeetingMetrics({ meetingId, meetingDate, reservations, done, onFlag }) {
  const { month: prevMonth, year: prevYear } = prevMonthOf(meetingDate)
  const auto = calcMetrics(reservations, prevMonth, prevYear)

  const [report, setReport] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [expenses, setExpenses] = useState([])
  const [newExpName, setNewExpName] = useState('')
  const [bankBalance, setBankBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadReport() {
      const { data } = await supabase.from('monthly_reports').select('*').eq('meeting_id', meetingId).maybeSingle()
      if (data) {
        setReport(data)
        setOverrides(data.metrics?.overrides || {})
        setBankBalance(data.metrics?.bankBalance || '')
        const exp = data.expenses
        setExpenses(Array.isArray(exp) ? exp : migrateExpenses(exp))
      } else {
        // Pre-populate recurring expenses from the most recent prior report
        const { data: prev } = await supabase.from('monthly_reports')
          .select('expenses').order('report_month', { ascending: false }).limit(1).maybeSingle()
        if (prev) {
          const prevExp = Array.isArray(prev.expenses) ? prev.expenses : migrateExpenses(prev.expenses)
          setExpenses(prevExp.filter(e => e.recurring).map(e => ({ ...e, id: uid(), amount: e.amount || 0 })))
        }
      }
    }
    loadReport()
  }, [meetingId])

  function val(key, autoVal) {
    const ov = overrides[key]
    return ov !== undefined && ov !== null ? ov : autoVal
  }

  function setOverride(key, v) {
    setOverrides(prev => {
      if (v === null) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: v }
    })
    setSaved(false)
  }

  function addExpense() {
    if (!newExpName.trim()) return
    setExpenses(prev => [...prev, { id: uid(), name: newExpName.trim(), amount: 0, recurring: false }])
    setNewExpName('')
    setSaved(false)
  }

  function updateExp(id, field, value) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
    setSaved(false)
  }

  function removeExp(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const reportMonth = new Date(prevYear, prevMonth, 1).toISOString().slice(0, 10)
    const payload = {
      meeting_id: meetingId,
      report_month: reportMonth,
      metrics: { ...auto, overrides, bankBalance },
      expenses,
      updated_at: new Date().toISOString(),
    }
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

  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const netAfterExpenses = (val('netAfterFees', auto.netAfterFees) || 0) - totalExpenses
  const prevLabel = `${MONTHS[prevMonth]} ${prevYear}`
  const lyLabel = `${MONTHS[prevMonth].slice(0, 3)} ${prevYear - 1}`

  function MetricBlock({ label, autoVal, lyValue, fmt, overrideKey }) {
    const v = val(overrideKey, autoVal)
    const diff = lyValue != null && v != null ? v - lyValue : null
    const pct = lyValue > 0 && diff != null ? Math.round((diff / lyValue) * 100) : null
    const up = pct != null && pct > 0
    const dn = pct != null && pct < 0

    return (
      <div style={metricCard}>
        <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4, paddingRight: onFlag ? 22 : 0 }}>{label}</div>
        <NumEditor
          value={overrides[overrideKey] !== undefined ? overrides[overrideKey] : null}
          autoVal={autoVal}
          fmt={fmt}
          onChange={n => setOverride(overrideKey, n)}
          disabled={done}
        />
        {lyValue != null && (
          <div style={{ fontSize: '0.68rem', color: up ? '#2C4A2E' : dn ? '#a33' : 'var(--color-muted)', marginTop: 3 }}>
            {pct != null ? (up ? `↑ ${pct}%` : dn ? `↓ ${Math.abs(pct)}%` : '± 0%') : ''} vs {lyLabel} <span style={{ color: 'var(--color-muted)' }}>({fmt(lyValue)})</span>
          </div>
        )}
        {onFlag && !done && (
          <button
            onClick={() => onFlag(`Discuss: ${label}`)}
            title="Flag for discussion"
            style={{ position: 'absolute', top: 8, right: 8, padding: '2px 5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-muted)', lineHeight: 1 }}
          >🚩</button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', margin: 0 }}>{prevLabel} Metrics</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '3px 0 0' }}>Auto-calculated from reservations. Click any number to override. 🚩 flags for discussion.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!done && (
            <button onClick={save} disabled={saving} style={{ padding: '7px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
            </button>
          )}
          <button onClick={() => window.print()} style={{ padding: '7px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--color-text)', cursor: 'pointer' }}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="print-only" style={{ display: 'none', marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>Hollow Valley Crates</div>
        <div style={{ fontSize: '1.1rem', color: '#555', marginTop: 4 }}>{prevLabel} — Monthly Report</div>
        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>

      {/* Bank Balance */}
      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabel}>Bank Balance</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>$</span>
          <input type="number" value={bankBalance} onChange={e => { setBankBalance(e.target.value); setSaved(false) }} placeholder="Current balance" disabled={done} style={{ ...inp, maxWidth: 180 }} step="0.01" />
          {onFlag && !done && (
            <button onClick={() => onFlag('Discuss: Bank Balance')} title="Flag for discussion" style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-muted)' }}>🚩</button>
          )}
        </div>
      </div>

      {/* Revenue */}
      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabel}>Revenue — {prevLabel}</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MetricBlock label="Gross Sales" autoVal={auto.gross} lyValue={auto.lyGross} fmt={fmt$} overrideKey="gross" />
          <MetricBlock label="Discounts Given" autoVal={auto.discounts} fmt={fmt$} overrideKey="discounts" />
          <MetricBlock label="Profit after Discounts" autoVal={auto.profitAfterDisc} fmt={fmt$} overrideKey="profitAfterDisc" />
          <MetricBlock label="Host Fees Paid" autoVal={auto.hostFees} fmt={fmt$} overrideKey="hostFees" />
          <MetricBlock label="Net after Fees" autoVal={auto.netAfterFees} lyValue={auto.lyNet} fmt={fmt$} overrideKey="netAfterFees" />
          <div style={metricCard}>
            <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4 }}>Net after Expenses</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: netAfterExpenses >= 0 ? 'var(--color-primary)' : '#a33', lineHeight: 1.1 }}>{fmt$(netAfterExpenses)}</div>
          </div>
        </div>
      </div>

      {/* Occupancy */}
      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabel}>Occupancy — {prevLabel}</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MetricBlock label="Nights Booked" autoVal={auto.nightsBooked} lyValue={auto.lyNightsBooked} fmt={fmtN} overrideKey="nightsBooked" />
          <MetricBlock label="Total Rentable Nights" autoVal={auto.rentable} fmt={fmtN} overrideKey="rentable" />
          <MetricBlock label="Occupancy Rate" autoVal={auto.occ} lyValue={auto.lyOcc} fmt={fmtPct} overrideKey="occ" />
          <MetricBlock label="% Sales in Fees" autoVal={auto.pctInFees} fmt={fmtPct} overrideKey="pctInFees" />
          <MetricBlock label="Avg Booked Nightly Rate" autoVal={auto.adr} fmt={fmt$} overrideKey="adr" />
          <MetricBlock label="Avg Rate after Fees" autoVal={auto.adrAfterFees} fmt={fmt$} overrideKey="adrAfterFees" />
          <MetricBlock label="RevPAR (Net / Rentable Nights)" autoVal={auto.revpar} fmt={fmt$} overrideKey="revpar" />
        </div>
      </div>

      {/* YTD */}
      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabel}>Year-to-Date {prevYear}</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MetricBlock label="YTD Gross" autoVal={auto.ytdGross} fmt={fmt$} overrideKey="ytdGross" />
          <MetricBlock label="YTD Discounts" autoVal={auto.ytdDisc} fmt={fmt$} overrideKey="ytdDisc" />
          <MetricBlock label="YTD Profit after Discounts" autoVal={auto.ytdProfit} fmt={fmt$} overrideKey="ytdProfit" />
          <MetricBlock label="YTD Host Fees" autoVal={auto.ytdFees} fmt={fmt$} overrideKey="ytdFees" />
          <MetricBlock label="YTD Net after Fees" autoVal={auto.ytdNet} fmt={fmt$} overrideKey="ytdNet" />
          <MetricBlock label="YTD Nights Booked" autoVal={auto.ytdNights} fmt={fmtN} overrideKey="ytdNights" />
          <MetricBlock label="YTD Occupancy" autoVal={auto.ytdOcc} fmt={fmtPct} overrideKey="ytdOcc" />
          <MetricBlock label="YTD % in Fees" autoVal={auto.ytdPctFees} fmt={fmtPct} overrideKey="ytdPctFees" />
          <MetricBlock label="YTD RevPAR" autoVal={auto.ytdRevpar} fmt={fmt$} overrideKey="ytdRevpar" />
        </div>
      </div>

      {/* Booking Sources */}
      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabel}>Bookings by Source — {prevLabel}</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MetricBlock label="Airbnb" autoVal={auto.airbnbCount} fmt={fmtN} overrideKey="airbnbCount" />
          <MetricBlock label="VRBO" autoVal={auto.vrboCount} fmt={fmtN} overrideKey="vrboCount" />
          <MetricBlock label="Website / Direct" autoVal={auto.websiteCount} fmt={fmtN} overrideKey="websiteCount" />
        </div>
      </div>

      {/* Pricing prompt (replaces rates textarea) */}
      <div style={{ marginBottom: 18, background: 'rgba(44,74,46,0.04)', border: '1px solid rgba(44,74,46,0.15)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Rates & Pricing</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 2 }}>Decide on rates for next month — weeknight, weekend, and holiday pricing.</div>
        </div>
        {onFlag && !done && (
          <button
            onClick={() => onFlag('Set rates for next month')}
            style={{ padding: '7px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🚩 Flag for Discussion
          </button>
        )}
      </div>

      {/* Expenses */}
      <div style={{ marginBottom: 16 }}>
        <div style={sectionLabel}>Monthly Expenses</div>
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
          {expenses.map(exp => (
            <div key={exp.id} style={metricCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', flex: 1 }}>{exp.name}</span>
                {!done && (
                  <button onClick={() => removeExp(exp.id)} style={{ padding: '0 4px', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1, flexShrink: 0 }}>×</button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>$</span>
                <input
                  type="number"
                  value={exp.amount}
                  onChange={e => updateExp(exp.id, 'amount', parseFloat(e.target.value) || 0)}
                  disabled={done}
                  placeholder="0"
                  style={{ ...inp, fontFamily: 'var(--font-display)', fontSize: '1.3rem', padding: '2px 6px', flex: 1, minWidth: 0 }}
                  step="0.01"
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--color-muted)', cursor: done ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!exp.recurring}
                  onChange={e => updateExp(exp.id, 'recurring', e.target.checked)}
                  disabled={done}
                  style={{ cursor: done ? 'default' : 'pointer' }}
                />
                Recurring
              </label>
            </div>
          ))}
          <div style={{ ...metricCard, background: 'rgba(44,74,46,0.04)', borderColor: 'rgba(44,74,46,0.2)' }}>
            <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4 }}>Total Expenses</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', lineHeight: 1.1 }}>{fmt$(totalExpenses)}</div>
          </div>
        </div>
        {!done && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={newExpName}
              onChange={e => setNewExpName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExpense()}
              placeholder="Expense name (e.g. Mortgage)"
              style={{ ...inp, maxWidth: 220 }}
            />
            <button onClick={addExpense} disabled={!newExpName.trim()} style={{ padding: '7px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 500, cursor: newExpName.trim() ? 'pointer' : 'default', opacity: newExpName.trim() ? 1 : 0.45 }}>
              + Add Expense
            </button>
          </div>
        )}
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
        @media (max-width: 600px) { .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 380px) { .metrics-grid { grid-template-columns: 1fr !important; } }
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
    const cur = value !== null && value !== undefined ? value : (autoVal ?? 0)
    setDraft(String(Math.round(cur)))
    setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  function commit() {
    setEditing(false)
    const n = parseFloat(draft)
    if (isNaN(n)) return
    // Clear override if user typed the same as auto (within $1)
    if (autoVal != null && Math.abs(n - autoVal) < 1) onChange(null)
    else onChange(n)
  }

  const displayValue = value !== null && value !== undefined ? value : autoVal
  const isOverridden = value !== null && value !== undefined && autoVal != null && Math.abs(value - autoVal) >= 1

  return editing ? (
    <input
      ref={ref}
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ ...inp, fontFamily: 'var(--font-display)', fontSize: '1.2rem', padding: '2px 6px', width: 110 }}
      step="1"
    />
  ) : (
    <div
      onClick={start}
      style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--color-text)', lineHeight: 1.1, cursor: disabled ? 'default' : 'text', display: 'flex', alignItems: 'baseline', gap: 5 }}
    >
      {displayValue != null && !isNaN(displayValue) ? fmt(displayValue) : '—'}
      {isOverridden && !disabled && <span style={{ fontSize: '0.58rem', color: '#a33', fontFamily: 'var(--font-body)', fontWeight: 600 }}>overridden</span>}
    </div>
  )
}
