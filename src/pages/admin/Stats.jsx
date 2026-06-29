import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const card = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }
const sectionLabel = { fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }
const kpiValue = { fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--color-text)', lineHeight: 1.1 }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function daysInYear(year) {
  return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365
}

function clampNightsToYear(start, end, year) {
  const yStart = new Date(year, 0, 1)
  const yEnd = new Date(year, 11, 31)
  const s = new Date(Math.max(new Date(start), yStart))
  const e = new Date(Math.min(new Date(end), yEnd))
  const diff = Math.round((e - s) / 86400000)
  return Math.max(0, diff)
}

export default function Stats() {
  const [loading, setLoading] = useState(true)
  const [inquiries, setInquiries] = useState([])
  const [icalBlocks, setIcalBlocks] = useState([])
  const [manualBlocks, setManualBlocks] = useState([])
  const [nightlyRate, setNightlyRate] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    async function load() {
      const [
        { data: inqs },
        { data: ical },
        { data: manual },
        { data: settings },
      ] = await Promise.all([
        supabase.from('inquiries').select('submitted_at,status,checkin,checkout,adults,children,pets'),
        supabase.from('cached_ical_blocks').select('source,start_date,end_date'),
        supabase.from('blocked_dates').select('start_date,end_date'),
        supabase.from('settings').select('nightly_rate').eq('id', 1).single(),
      ])
      setInquiries(inqs || [])
      setIcalBlocks(ical || [])
      setManualBlocks(manual || [])
      setNightlyRate(settings?.nightly_rate || null)
      setLoading(false)
    }
    load()
  }, [])

  const years = [...new Set(inquiries.map(i => new Date(i.submitted_at).getFullYear()))].sort((a,b)=>b-a)
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear())

  const yearInqs = inquiries.filter(i => new Date(i.submitted_at).getFullYear() === selectedYear)
  const confirmed = yearInqs.filter(i => i.status === 'Confirmed')
  const total = yearInqs.length
  const convPct = total > 0 ? Math.round((confirmed.length / total) * 100) : 0

  // Booked nights by source
  const directNights = confirmed.reduce((sum, i) => {
    if (!i.checkin || !i.checkout) return sum
    return sum + clampNightsToYear(i.checkin, i.checkout, selectedYear)
  }, 0)
  const airbnbNights = icalBlocks
    .filter(b => b.source === 'airbnb')
    .reduce((sum, b) => sum + clampNightsToYear(b.start_date, b.end_date, selectedYear), 0)
  const vrboNights = icalBlocks
    .filter(b => b.source === 'vrbo')
    .reduce((sum, b) => sum + clampNightsToYear(b.start_date, b.end_date, selectedYear), 0)
  const manualNights = manualBlocks.reduce((sum, b) => sum + clampNightsToYear(b.start_date, b.end_date, selectedYear), 0)
  const totalBooked = directNights + airbnbNights + vrboNights + manualNights
  const totalDays = daysInYear(selectedYear)
  const occupancy = Math.round((totalBooked / totalDays) * 100)

  const revenueEst = nightlyRate ? directNights * nightlyRate : null

  // Funnel
  const funnelStatuses = [
    { label: 'New', color: '#2C4A2E' },
    { label: 'Contacted', color: '#8B6914' },
    { label: 'Confirmed', color: '#1a5c3a' },
    { label: 'Declined', color: '#7a2020' },
  ]
  const funnelCounts = funnelStatuses.map(s => ({
    ...s,
    count: yearInqs.filter(i => i.status === s.label).length,
    pct: total > 0 ? Math.round((yearInqs.filter(i => i.status === s.label).length / total) * 100) : 0,
  }))

  // Source bars
  const sourceBars = [
    { label: 'Direct / Confirmed', nights: directNights, color: '#2C4A2E' },
    { label: 'Airbnb', nights: airbnbNights, color: '#FF5A5F' },
    { label: 'VRBO', nights: vrboNights, color: '#1C6CB5' },
    { label: 'Manual Blocks', nights: manualNights, color: '#8A7F72' },
  ]
  const maxSourceNights = Math.max(...sourceBars.map(s => s.nights), 1)

  // Monthly inquiries chart
  const monthCounts = Array(12).fill(0)
  yearInqs.forEach(i => {
    const m = new Date(i.submitted_at).getMonth()
    monthCounts[m]++
  })
  const maxMonth = Math.max(...monthCounts, 1)

  // Guest profile
  const confirmedWithDates = confirmed.filter(i => i.checkin && i.checkout)
  const avgAdults = confirmedWithDates.length > 0
    ? (confirmedWithDates.reduce((s, i) => s + (i.adults || 0), 0) / confirmedWithDates.length).toFixed(1)
    : '—'
  const avgNights = confirmedWithDates.length > 0
    ? (confirmedWithDates.reduce((s, i) => s + clampNightsToYear(i.checkin, i.checkout, selectedYear), 0) / confirmedWithDates.length).toFixed(1)
    : '—'
  const petStays = confirmed.filter(i => i.pets > 0).length
  const petPct = confirmed.length > 0 ? Math.round((petStays / confirmed.length) * 100) : 0

  if (loading) return <div style={{ color: 'var(--color-muted)', padding: 32 }}>Loading…</div>

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 24 }}>Stats</h1>

      {/* Year selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {years.map(y => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            style={{
              padding: '6px 18px',
              borderRadius: 999,
              border: '1px solid var(--color-border)',
              background: selectedYear === y ? 'var(--color-primary)' : 'var(--color-card)',
              color: selectedYear === y ? '#fff' : 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >{y}</button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Inquiries" value={total} />
        <KpiCard label="Confirmed" value={confirmed.length} accent="#1a5c3a" />
        <KpiCard label="Conversion" value={`${convPct}%`} />
        <KpiCard label="Nights Booked" value={totalBooked} sub={`${occupancy}% occupancy`} />
        {revenueEst !== null && (
          <KpiCard label="Direct Revenue Est." value={`$${revenueEst.toLocaleString()}`} />
        )}
      </div>

      {/* Inquiry Funnel */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={sectionLabel}>Inquiry Funnel</div>
        {funnelCounts.map(s => (
          <div key={s.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--color-text)' }}>{s.label}</span>
              <span style={{ color: 'var(--color-muted)' }}>{s.count} · {s.pct}%</span>
            </div>
            <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Booked nights by source */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={sectionLabel}>Booked Nights by Source</div>
        {sourceBars.map(s => (
          <div key={s.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--color-text)' }}>{s.label}</span>
              <span style={{ color: 'var(--color-muted)' }}>{s.nights} nights</span>
            </div>
            <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((s.nights / maxSourceNights) * 100)}%`, height: '100%', background: s.color, borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
          {totalBooked} booked / {totalDays} days in {selectedYear} — {occupancy}% occupancy
        </div>
      </div>

      {/* Monthly inquiries bar chart */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={sectionLabel}>Monthly Inquiries — {selectedYear}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 6, alignItems: 'end', height: 120 }}>
          {monthCounts.map((count, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: 3 }}>{count > 0 ? count : ''}</span>
              <div style={{
                width: '100%',
                height: `${Math.round((count / maxMonth) * 80)}px`,
                background: 'var(--color-primary)',
                borderRadius: '3px 3px 0 0',
                minHeight: count > 0 ? 4 : 0,
                opacity: count > 0 ? 1 : 0.15,
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 6, marginTop: 4 }}>
          {MONTHS.map(m => (
            <div key={m} style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--color-muted)' }}>{m}</div>
          ))}
        </div>
      </div>

      {/* Guest profile */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={sectionLabel}>Guest Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 20 }}>
          <MiniStat label="Avg Adults / Stay" value={avgAdults} />
          <MiniStat label="Avg Nights / Stay" value={avgNights} />
          <MiniStat label="Pet-Friendly Stays" value={petStays} sub={`${petPct}% of confirmed`} />
          <MiniStat label="Total Confirmed Stays" value={confirmed.length} />
        </div>
        {confirmedWithDates.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8 }}>Confirmed Stay Dates</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {confirmedWithDates.map((i, idx) => (
                <span key={idx} style={{ fontSize: '0.78rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', color: 'var(--color-text)' }}>
                  {new Date(i.checkin).toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {new Date(i.checkout).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, accent, sub }) {
  return (
    <div style={card}>
      <div style={sectionLabel}>{label}</div>
      <div style={{ ...kpiValue, color: accent || 'var(--color-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function MiniStat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--color-text)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
