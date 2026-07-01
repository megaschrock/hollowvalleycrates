import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STATUSES = ['New', 'Contacted', 'Confirmed', 'Declined']

export default function Inquiries() {
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [editRow, setEditRow] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('inquiries').select('*').order('submitted_at', { ascending: false }).then(({ data }) => {
      if (data) setInquiries(data)
      setLoading(false)
    })
  }, [])

  function openRow(inq) {
    setExpanded(inq.id)
    setEditRow({ status: inq.status, admin_notes: inq.admin_notes || '' })
  }

  async function saveRow(id) {
    setSaving(true)
    const { data } = await supabase.from('inquiries').update(editRow).eq('id', id).select().single()
    if (data) setInquiries(i => i.map(r => r.id === id ? data : r))
    setSaving(false)
    setExpanded(null)
  }

  async function deleteInquiry(inq) {
    if (!confirm(`Delete inquiry from ${inq.first_name} ${inq.last_name}?`)) return
    if (inq.blocked_date_id) {
      await supabase.from('blocked_dates').delete().eq('id', inq.blocked_date_id)
    }
    await supabase.from('inquiries').delete().eq('id', inq.id)
    setInquiries(i => i.filter(r => r.id !== inq.id))
    setExpanded(null)
  }

  const filtered = filter === 'All' ? inquiries : inquiries.filter(i => i.status === filter)
  const counts = { All: inquiries.length }
  STATUSES.forEach(s => { counts[s] = inquiries.filter(i => i.status === s).length })

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 24 }}>Inquiries</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['All', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 16px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', border: '1px solid var(--color-border)', background: filter === s ? 'var(--color-primary)' : 'var(--color-card)', color: filter === s ? '#fff' : 'var(--color-text)' }}>{s}{counts[s] > 0 ? ` (${counts[s]})` : ''}</button>
        ))}
      </div>
      {loading ? <p style={{ color: 'var(--color-muted)' }}>Loading…</p> : (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Name','Email','Check-in','Check-out','Guests','Submitted','Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inq => (
                  <>
                    <tr key={inq.id} onClick={() => expanded === inq.id ? setExpanded(null) : openRow(inq)}
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: expanded === inq.id ? 'rgba(44,74,46,0.05)' : 'transparent' }}>
                      <td style={td}>{inq.first_name} {inq.last_name}</td>
                      <td style={td}>{inq.email}</td>
                      <td style={td}>{inq.checkin || '—'}</td>
                      <td style={td}>{inq.checkout || '—'}</td>
                      <td style={td}>{inq.adults}A {inq.children}C {inq.pets}P</td>
                      <td style={td}>{inq.submitted_at ? new Date(inq.submitted_at).toLocaleDateString() : '—'}</td>
                      <td style={td}><StatusBadge status={inq.status} /></td>
                    </tr>
                    {expanded === inq.id && (
                      <tr key={`${inq.id}-detail`} style={{ background: 'rgba(44,74,46,0.03)', borderBottom: '1px solid var(--color-border)' }}>
                        <td colSpan={7} style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 16 }}>
                            <div>
                              <p style={dl}><b>Phone:</b> {inq.phone || '—'}</p>
                              <p style={dl}><b>Adults:</b> {inq.adults} · <b>Children:</b> {inq.children} · <b>Pets:</b> {inq.pets}</p>
                              <p style={dl}><b>Notes:</b> {inq.notes || '—'}</p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div>
                                <label style={ls}>Status</label>
                                <select style={{ ...is, width: 'auto' }} value={editRow.status} onChange={e => setEditRow(r => ({ ...r, status: e.target.value }))}>
                                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={ls}>Admin Notes</label>
                                <textarea style={{ ...is, height: 80, resize: 'vertical', width: '100%' }} value={editRow.admin_notes} onChange={e => setEditRow(r => ({ ...r, admin_notes: e.target.value }))} />
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => saveRow(inq.id)} disabled={saving} style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}>{saving ? 'Saving…' : 'Save'}</button>
                                <button onClick={() => setExpanded(null)} style={{ padding: '8px 18px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', background: 'none' }}>Cancel</button>
                                <button onClick={() => deleteInquiry(inq)} style={{ padding: '8px 18px', border: '1px solid #c0392b', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', background: 'none', color: '#c0392b' }}>Delete</button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}>No inquiries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = { New: '#2C4A2E', Contacted: '#8B6914', Confirmed: '#1a5c3a', Declined: '#7a2020' }
  return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 500, background: `${colors[status] || '#666'}22`, color: colors[status] || '#666' }}>{status}</span>
}

const td = { padding: '12px 14px', verticalAlign: 'middle' }
const dl = { fontSize: '0.875rem', marginBottom: 6 }
const ls = { display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 5, fontWeight: 500 }
const is = { padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', background: '#fff' }
