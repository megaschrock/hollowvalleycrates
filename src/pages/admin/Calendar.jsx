import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', background: '#fff', color: 'var(--color-text)' }
const labelStyle = { display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }
const sectionStyle = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 24 }
const btnPrimary = { padding: '10px 20px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }

const FEED_URL = `${window.location.origin}/.netlify/functions/calendar-feed`

export default function Calendar() {
  const [icalUrls, setIcalUrls] = useState({ airbnb_ical_url:'', vrbo_ical_url:'' })
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [blockRows, setBlockRows] = useState([])
  const [newBlock, setNewBlock] = useState({ start_date:'', end_date:'', reason:'' })
  const [copied, setCopied] = useState(false)
  const [savingUrls, setSavingUrls] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: s }, { data: blocks }] = await Promise.all([
      supabase.from('settings').select('airbnb_ical_url,vrbo_ical_url,last_ical_refresh').eq('id', 1).single(),
      supabase.from('blocked_dates').select('*').order('start_date')
    ])
    if (s) { setIcalUrls({ airbnb_ical_url: s.airbnb_ical_url||'', vrbo_ical_url: s.vrbo_ical_url||'' }); setLastRefresh(s.last_ical_refresh) }
    if (blocks) setBlockRows(blocks)
  }

  async function saveUrls() {
    setSavingUrls(true)
    await supabase.from('settings').update(icalUrls).eq('id', 1)
    setSavingUrls(false)
  }

  async function refreshNow() {
    setRefreshing(true)
    try {
      await fetch('/.netlify/functions/refresh-ical', { method: 'POST' })
      await loadData()
    } catch {}
    setRefreshing(false)
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

  function copyFeed() {
    navigator.clipboard.writeText(FEED_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 32 }}>Calendar</h1>

      <div style={sectionStyle}>
        <h2 style={sh2}>iCal Import (Airbnb & VRBO)</h2>
        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Airbnb iCal URL</label>
            <input style={inputStyle} value={icalUrls.airbnb_ical_url} onChange={e => setIcalUrls(u => ({ ...u, airbnb_ical_url: e.target.value }))} placeholder="https://www.airbnb.com/calendar/ical/..." />
          </div>
          <div>
            <label style={labelStyle}>VRBO iCal URL</label>
            <input style={inputStyle} value={icalUrls.vrbo_ical_url} onChange={e => setIcalUrls(u => ({ ...u, vrbo_ical_url: e.target.value }))} placeholder="https://www.vrbo.com/icalendar/..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={saveUrls} disabled={savingUrls} style={btnPrimary}>{savingUrls ? 'Saving…' : 'Save URLs'}</button>
          <button onClick={refreshNow} disabled={refreshing} style={{ ...btnPrimary, background: 'var(--color-secondary)', color: 'var(--color-text)' }}>{refreshing ? 'Refreshing…' : 'Refresh Now'}</button>
          {lastRefresh && <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Last sync: {new Date(lastRefresh).toLocaleString('en-US', { timeZone: 'America/New_York' })}</span>}
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Outbound iCal Feed</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: 12 }}>Paste this URL into Airbnb and VRBO as an imported calendar to block your manually-blocked dates.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input readOnly style={{ ...inputStyle, flex: 1, background: 'var(--color-bg)' }} value={FEED_URL} />
          <button onClick={copyFeed} style={{ ...btnPrimary, whiteSpace: 'nowrap' }}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Manual Blocked Dates</h2>
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
            {!blockRows.length && <tr><td colSpan={4} style={{ padding: '16px 12px', color: 'var(--color-muted)', textAlign: 'center' }}>No blocked dates</td></tr>}
          </tbody>
        </table>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>Add Blocked Range</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
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

const sh2 = { fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.03em', marginBottom: 16 }
