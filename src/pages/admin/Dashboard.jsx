import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, newCount: 0, popupEnabled: false, lastRefresh: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: total }, { data: newInqs }, { data: settings }] = await Promise.all([
        supabase.from('inquiries').select('id', { count: 'exact', head: true }),
        supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'New'),
        supabase.from('settings').select('popup_enabled,last_ical_refresh').eq('id', 1).single(),
      ])
      setStats({
        total: total || 0,
        newCount: newInqs?.length || 0,
        popupEnabled: settings?.popup_enabled || false,
        lastRefresh: settings?.last_ical_refresh,
      })
      setLoading(false)
    }
    load()
  }, [])

  async function togglePopup() {
    const next = !stats.popupEnabled
    await supabase.from('settings').update({ popup_enabled: next }).eq('id', 1)
    setStats(s => ({ ...s, popupEnabled: next }))
  }

  return (
    <div>
      <h1 style={h1}>Dashboard</h1>
      {loading ? <p style={{ color: 'var(--color-muted)' }}>Loading…</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard label="Total Inquiries" value={stats.total} link="/admin/inquiries" />
            <StatCard label="New Inquiries" value={stats.newCount} link="/admin/inquiries" accent />
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8 }}>Giveaway Popup</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: stats.popupEnabled ? 'var(--color-primary)' : 'var(--color-muted)' }}>{stats.popupEnabled ? 'On' : 'Off'}</span>
                <button onClick={togglePopup} style={{ padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', background: 'none', cursor: 'pointer' }}>Toggle</button>
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8 }}>Last iCal Sync</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'Never'}</div>
            </div>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: 16, letterSpacing: '0.03em' }}>Quick Links</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[['Content','/admin/content'],['Pricing','/admin/pricing'],['Calendar','/admin/calendar'],['Inquiries','/admin/inquiries'],['Photos','/admin/photos'],['Giveaway','/admin/giveaway']].map(([label, to]) => (
              <Link key={to} to={to} style={{ padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--color-text)', background: 'var(--color-card)', textDecoration: 'none' }}>{label}</Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, link, accent }) {
  return (
    <Link to={link} style={{ ...cardStyle, textDecoration: 'none', display: 'block' }}>
      <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: accent ? 'var(--color-primary)' : 'var(--color-text)' }}>{value}</div>
    </Link>
  )
}

const cardStyle = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }
const h1 = { fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 32 }
