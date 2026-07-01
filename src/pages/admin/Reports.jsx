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
  return MONTHS[dt.getMonth()] + ' ' + dt.getFullYear()
}

export default function Reports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('monthly_reports').select('*').order('report_month', { ascending: false }).then(({ data }) => {
      setReports(data || [])
      setLoading(false)
    })
  }, [])

  async function deleteReport(id) {
    await supabase.from('monthly_reports').delete().eq('id', id)
    setReports(rs => rs.filter(r => r.id !== id))
  }

  if (loading) return <div style={{ color: 'var(--color-muted)', padding: 32 }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', margin: 0 }}>Monthly Reports</h1>
      </div>

      {reports.length === 0 ? (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '40px 32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>No reports yet. Reports are saved during meetings on the Monthly Metrics step.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {reports.map(r => {
            const m = r.metrics || {}
            const overrides = m.overrides || {}
            const net = overrides.netAfterFees ?? m.netAfterFees
            const occ = overrides.occ ?? m.occ
            const revpar = overrides.revpar ?? m.revpar
            const expTotal = Object.values(r.expenses || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
            return (
              <ReportRow key={r.id} r={r} net={net} occ={occ} revpar={revpar} expTotal={expTotal} onDelete={deleteReport} />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReportRow({ r, net, occ, revpar, expTotal, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      <Link
        to={r.meeting_id ? `/admin/meetings/${r.meeting_id}` : '#'}
        style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr repeat(4, auto)', gap: 24, alignItems: 'center', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px 24px', textDecoration: 'none', color: 'inherit' }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', fontFamily: 'var(--font-display)' }}>{fmtMonth(r.report_month)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 2 }}>
            Saved {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <Stat label="Net Revenue" value={fmt$(net)} />
        <Stat label="Occupancy" value={occ != null ? Math.round(occ) + '%' : '—'} />
        <Stat label="RevPAR" value={fmt$(revpar)} />
        <Stat label="Expenses" value={expTotal > 0 ? fmt$(expTotal) : '—'} />
      </Link>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => { window.__printReportId = r.id; window.print() }}
          title="Print report"
          style={{ padding: '8px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--color-muted)' }}
        >🖨</button>
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
      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--color-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{value}</div>
    </div>
  )
}
