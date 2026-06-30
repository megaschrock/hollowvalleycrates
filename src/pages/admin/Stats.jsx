import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const card = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }
const sectionLabel = { fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }
const kpiValue = { fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--color-text)', lineHeight: 1.1 }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function daysInYear(year) {
  return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365
}

function yearOf(s) {
  return new Date(s + 'T12:00:00').getFullYear()
}

function monthOf(s) {
  return new Date(s + 'T12:00:00').getMonth()
}

function fmt$(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function Stats() {
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    async function load() {
      const [{ data: res }, { data: inqs }] = await Promise.all([
        supabase.from('reservations').select('source,start_date,end_date,nights,net_payout,gross_amount,cleaning_fee,pet_fee,guest_name'),
        supabase.from('inquiries').select('submitted_at,status,checkin,checkout,adults,children,pets'),
      ])
      setReservations(res || [])
      setInquiries(inqs || [])
      setLoading(false)
    }
    load()
  }, [])

  // Year list from both reservations and inquiries
  const resYears = reservations.map(r => yearOf(r.start_date))
  const inqYears = inquiries.map(i => new Date(i.submitted_at).getFullYear())
  const years = [...new Set([...resYears, ...inqYears, new Date().getFullYear()])].sort((a, b) => b - a)

  const yearRes = reservations.filter(r => yearOf(r.start_date) === selectedYear)
  const yearInqs = inquiries.filter(i => new Date(i.submitted_at).getFullYear() === selectedYear)

  // --- Occupancy ---
  const totalNights = yearRes.reduce((s, r) => s + (r.nights || 0), 0)
  const totalDays = daysInYear(selectedYear)
  const occupancy = Math.round((totalNights / totalDays) * 100)

  // --- Revenue ---
  const resWithPayout = yearRes.filter(r => r.net_payout != null)
  const totalNet = resWithPayout.reduce((s, r) => s + r.net_payout, 0)
  const netNights = resWithPayout.reduce((s, r) => s + (r.nights || 0), 0)
  const adr = netNights > 0 ? totalNet / netNights : null
  const revpar = adr != null ? adr * (occupancy / 100) : null

  const totalCleaning = yearRes.reduce((s, r) => s + (r.cleaning_fee || 0), 0)
  const totalPetFee = yearRes.reduce((s, r) => s + (r.pet_fee || 0), 0)
  const petStays = yearRes.filter(r => r.pet_fee != null && r.pet_fee > 0).length
  const petPct = yearRes.length > 0 ? Math.round((petStays / yearRes.length) * 100) : 0

  const alos = yearRes.length > 0
    ? (yearRes.reduce((s, r) => s + (r.nights || 0), 0) / yearRes.length).toFixed(1)
    : null

  // --- Source breakdown ---
  const sources = ['airbnb', 'vrbo']
  const sourceStats = sources.map(src => {
    const rows = yearRes.filter(r => r.source === src)
    const nights = rows.reduce((s, r) => s + (r.nights || 0), 0)
    const net = rows.filter(r => r.net_payout != null).reduce((s, r) => s + r.net_payout, 0)
    const hasNet = rows.some(r => r.net_payout != null)
    return { src, label: src === 'airbnb' ? 'Airbnb' : 'VRBO', nights, net, hasNet, count: rows.length }
  })

  // --- Monthly charts ---
  const monthlyNights = Array(12).fill(0)
  const monthlyNet = Array(12).fill(null).map(() => ({ total: 0, hasData: false }))
  yearRes.forEach(r => {
    const m = monthOf(r.start_date)
    monthlyNights[m] += r.nights || 0
    if (r.net_payout != null) {
      monthlyNet[m].total += r.net_payout
      monthlyNet[m].hasData = true
    }
  })
  const maxMonthNights = Math.max(...monthlyNights, 1)
  const maxMonthNet = Math.max(...monthlyNet.map(m => m.total), 1)

  // --- Inquiry funnel ---
  const confirmed = yearInqs.filter(i => i.status === 'Confirmed')
  const total = yearInqs.length
  const convPct = total > 0 ? Math.round((confirmed.length / total) * 100) : 0
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

  if (loading) return <div style={{ color: 'var(--color-muted)', padding: 32 }}>Loading…</div>

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 24 }}>Stats</h1>

      {/* Year selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {years.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)} style={{
            padding: '6px 18px', borderRadius: 999, border: '1px solid var(--color-border)',
            background: selectedYear === y ? 'var(--color-primary)' : 'var(--color-card)',
            color: selectedYear === y ? '#fff' : 'var(--color-text)',
            fontFamily: 'var(--font-body)', fontSize: '0.85rem', cursor: 'pointer',
          }}>{y}</button>
        ))}
      </div>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Reservations" value={yearRes.length} />
        <KpiCard label="Nights Booked" value={totalNights} sub={`${occupancy}% occupancy`} />
        <KpiCard label="Net Revenue" value={fmt$(totalNet)} accent="#1a5c3a" sub={resWithPayout.length < yearRes.length ? `${resWithPayout.length} of ${yearRes.length} have payout data` : undefined} />
        <KpiCard label="ADR" value={adr != null ? fmt$(Math.round(adr)) : '—'} sub="avg daily rate" />
        <KpiCard label="RevPAR" value={revpar != null ? fmt$(Math.round(revpar)) : '—'} sub="rev per avail night" />
        <KpiCard label="Avg Stay" value={alos != null ? `${alos} nights` : '—'} />
      </div>

      {/* Monthly occupancy chart */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={sectionLabel}>Monthly Nights Booked — {selectedYear}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 6, alignItems: 'end', height: 100 }}>
          {monthlyNights.map((n, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-muted)', marginBottom: 3 }}>{n > 0 ? n : ''}</span>
              <div style={{
                width: '100%',
                height: `${Math.round((n / maxMonthNights) * 80)}px`,
                background: 'var(--color-primary)',
                borderRadius: '3px 3px 0 0',
                minHeight: n > 0 ? 4 : 0,
                opacity: n > 0 ? 1 : 0.15,
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 6, marginTop: 4 }}>
          {MONTHS.map(m => <div key={m} style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--color-muted)' }}>{m}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 6, marginTop: 8 }}>
          {monthlyNights.map((n, i) => {
            const avail = daysInMonth(selectedYear, i)
            const pct = Math.round((n / avail) * 100)
            return (
              <div key={i} style={{ textAlign: 'center', fontSize: '0.6rem', color: pct >= 80 ? '#1a5c3a' : pct >= 50 ? '#8B6914' : 'var(--color-muted)' }}>
                {n > 0 ? `${pct}%` : ''}
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly revenue chart */}
      {resWithPayout.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={sectionLabel}>Monthly Net Revenue — {selectedYear}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 6, alignItems: 'end', height: 100 }}>
            {monthlyNet.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)', marginBottom: 3 }}>{m.hasData ? `$${Math.round(m.total / 1000)}k` : ''}</span>
                <div style={{
                  width: '100%',
                  height: `${Math.round((m.total / maxMonthNet) * 80)}px`,
                  background: '#1a5c3a',
                  borderRadius: '3px 3px 0 0',
                  minHeight: m.hasData ? 4 : 0,
                  opacity: m.hasData ? 1 : 0.1,
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 6, marginTop: 4 }}>
            {MONTHS.map(m => <div key={m} style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--color-muted)' }}>{m}</div>)}
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
            Total net: {fmt$(Math.round(totalNet))} · ADR: {fmt$(adr != null ? Math.round(adr) : null)} · RevPAR: {fmt$(revpar != null ? Math.round(revpar) : null)}
          </div>
        </div>
      )}

      {/* Source breakdown */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={sectionLabel}>By Platform</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {sourceStats.map(s => (
            <div key={s.src}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: s.src === 'airbnb' ? '#FF5A5F' : '#1C6CB5', marginBottom: 10 }}>{s.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <MiniStat label="Bookings" value={s.count} />
                <MiniStat label="Nights" value={s.nights} />
                {s.hasNet && <MiniStat label="Net Payout" value={fmt$(Math.round(s.net))} />}
                {s.hasNet && s.nights > 0 && <MiniStat label="ADR" value={fmt$(Math.round(s.net / s.nights))} />}
              </div>
            </div>
          ))}
        </div>
        {(totalCleaning > 0 || totalPetFee > 0) && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {totalCleaning > 0 && <MiniStat label="Cleaning Fees" value={fmt$(totalCleaning)} />}
<<<<<<< HEAD
            {totalPetFee > 0 && <MiniStat label="Pet Fees" value={fmt$(totalPetFee)} sub={`${petStays} of ${yearRes.length} stays (${petPct}%)`} />}
=======
            {totalPetFee > 0 && <MiniStat label="Pet Fees" value={fmt$(totalPetFee)} />}
>>>>>>> 30dab5e (Rebuild Stats page with reservation-based KPIs, ADR, RevPAR, monthly charts)
          </div>
        )}
      </div>

      {/* Inquiry funnel */}
      {total > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={sectionLabel}>Direct Inquiry Funnel — {selectedYear}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 16, marginBottom: 16 }}>
            <MiniStat label="Inquiries" value={total} />
            <MiniStat label="Confirmed" value={confirmed.length} />
            <MiniStat label="Conversion" value={`${convPct}%`} />
          </div>
          {funnelCounts.map(s => (
            <div key={s.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--color-text)' }}>{s.label}</span>
                <span style={{ color: 'var(--color-muted)' }}>{s.count} · {s.pct}%</span>
              </div>
              <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {yearRes.length === 0 && (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>No reservations found for {selectedYear}. Import CSVs or wait for the iCal sync to populate data.</p>
      )}
    </div>
  )
}

function KpiCard({ label, value, accent, sub }) {
  return (
    <div style={card}>
      <div style={sectionLabel}>{label}</div>
      <div style={{ ...kpiValue, color: accent || 'var(--color-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function MiniStat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--color-text)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
