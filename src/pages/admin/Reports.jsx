import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt$(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + Math.round(n).toLocaleString('en-US')
}

function fmtMonth(d) {
  const dt = new Date(d + 'T12:00:00')
  return MONTHS[dt.getMonth()].slice(0, 3) + ' ' + dt.getFullYear()
}

function getNet(r) {
  const m = r.metrics || {}
  return m.overrides?.netAfterFees ?? m.netAfterFees ?? 0
}

function getExpTotal(r) {
  const exp = r.expenses
  if (Array.isArray(exp)) return exp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  return Object.values(exp || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
}

function getOcc(r) {
  const m = r.metrics || {}
  return m.overrides?.occ ?? m.occ ?? null
}

function getRevpar(r) {
  const m = r.metrics || {}
  return m.overrides?.revpar ?? m.revpar ?? null
}

function quarterOf(dateStr) {
  const month = new Date(dateStr + 'T12:00:00').getMonth()
  return Math.floor(month / 3) + 1
}

function yearOf(dateStr) {
  return new Date(dateStr + 'T12:00:00').getFullYear()
}

export default function Reports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedYears, setExpandedYears] = useState({})

  useEffect(() => {
    supabase.from('monthly_reports').select('*').order('report_month', { ascending: false }).then(({ data }) => {
      setReports(data || [])
      const years = [...new Set((data || []).map(r => yearOf(r.report_month)))]
      const init = {}
      years.forEach(y => { init[y] = true })
      setExpandedYears(init)
      setLoading(false)
    })
  }, [])

  async function deleteReport(id) {
    await supabase.from('monthly_reports').delete().eq('id', id)
    setReports(rs => rs.filter(r => r.id !== id))
  }

  if (loading) return <div style={{ color: 'var(--color-muted)', padding: 32 }}>Loading…</div>

  // Group by year
  const years = [...new Set(reports.map(r => yearOf(r.report_month)))].sort((a, b) => b - a)

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', margin: 0 }}>Reports</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: 6 }}>Auto-saved from each meeting's metrics step.</p>
      </div>

      {reports.length === 0 ? (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '40px 32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>No reports yet. Reports save automatically during the Monthly Metrics step of each meeting.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 32 }}>
          {years.map(year => {
            const yearReports = reports.filter(r => yearOf(r.report_month) === year)
            const yearNet = yearReports.reduce((s, r) => s + getNet(r), 0)
            const yearExp = yearReports.reduce((s, r) => s + getExpTotal(r), 0)
            const expanded = expandedYears[year] !== false

            // Quarterly summaries
            const quarters = [1,2,3,4].map(q => {
              const qReports = yearReports.filter(r => quarterOf(r.report_month) === q)
              if (!qReports.length) return null
              const net = qReports.reduce((s, r) => s + getNet(r), 0)
              const exp = qReports.reduce((s, r) => s + getExpTotal(r), 0)
              const occs = qReports.map(r => getOcc(r)).filter(v => v != null)
              const avgOcc = occs.length ? occs.reduce((s, v) => s + v, 0) / occs.length : null
              return { q, net, exp, avgOcc, count: qReports.length }
            }).filter(Boolean)

            return (
              <div key={year}>
                {/* Year header */}
                <div
                  onClick={() => setExpandedYears(prev => ({ ...prev, [year]: !expanded }))}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{expanded ? '▼' : '▶'}</span>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.03em', margin: 0 }}>{year}</h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{yearReports.length} month{yearReports.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <YearStat label="Net Revenue" value={fmt$(yearNet)} />
                    <YearStat label="Expenses" value={yearExp > 0 ? fmt$(yearExp) : '—'} />
                    <YearStat label="Net after Exp." value={fmt$(yearNet - yearExp)} color={yearNet - yearExp >= 0 ? 'var(--color-primary)' : '#a33'} />
                  </div>
                </div>

                {expanded && (
                  <>
                    {/* Quarterly summary row */}
                    {quarters.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${quarters.length}, 1fr)`, gap: 8, marginBottom: 12 }}>
                        {quarters.map(({ q, net, exp, avgOcc }) => (
                          <div key={q} style={{ background: 'rgba(44,74,46,0.05)', border: '1px solid rgba(44,74,46,0.12)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 6 }}>Q{q}</div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              <QStat label="Net" value={fmt$(net)} />
                              {exp > 0 && <QStat label="Exp" value={fmt$(exp)} />}
                              {avgOcc != null && <QStat label="Avg Occ" value={Math.round(avgOcc) + '%'} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Monthly rows */}
                    <div style={{ display: 'grid', gap: 8 }}>
                      {yearReports.map(r => (
                        <ReportRow key={r.id} r={r} onDelete={deleteReport} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function YearStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--color-muted)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: color || 'var(--color-text)' }}>{value}</div>
    </div>
  )
}

function QStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-muted)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>{value}</div>
    </div>
  )
}

function ReportRow({ r, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const net = getNet(r)
  const exp = getExpTotal(r)
  const occ = getOcc(r)
  const revpar = getRevpar(r)

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      <Link
        to={r.meeting_id ? `/admin/meetings/${r.meeting_id}` : '#'}
        style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr repeat(4, auto)', gap: 20, alignItems: 'center', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 20px', textDecoration: 'none', color: 'inherit' }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-display)' }}>{fmtMonth(r.report_month)}</div>
        <Stat label="Net Revenue" value={fmt$(net)} />
        <Stat label="Occupancy" value={occ != null ? Math.round(occ) + '%' : '—'} />
        <Stat label="RevPAR" value={fmt$(revpar)} />
        <Stat label="Expenses" value={exp > 0 ? fmt$(exp) : '—'} />
      </Link>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
        {confirming ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => onDelete(r.id)} style={{ padding: '5px 8px', background: '#a33', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', cursor: 'pointer' }}>Del</button>
            <button onClick={() => setConfirming(false)} style={{ padding: '5px 6px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', cursor: 'pointer', color: 'var(--color-muted)' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} title="Delete" style={{ padding: '8px 10px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--color-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{value}</div>
    </div>
  )
}
