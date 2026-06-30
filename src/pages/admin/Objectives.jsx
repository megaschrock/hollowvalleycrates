import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_MAP = {
  on_track: { label: 'On Track', color: '#2C4A2E', bg: 'rgba(44,74,46,0.1)' },
  off_track: { label: 'Off Track', color: '#a33', bg: 'rgba(170,51,51,0.1)' },
  complete: { label: 'Complete', color: '#555', bg: 'rgba(85,85,85,0.1)' },
}

const lbl = { display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }
const inp = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', background: '#fff', color: 'var(--color-text)', boxSizing: 'border-box' }
const btnPrimary = { padding: '10px 22px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }

export default function Objectives() {
  const [objectives, setObjectives] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', period_label: currentPeriod() })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('objectives').select('*').eq('archived', false).order('created_at', { ascending: false })
    setObjectives(data || [])
    setLoading(false)
  }

  async function addObjective() {
    if (!form.title.trim()) return
    setSaving(true)
    const { data } = await supabase.from('objectives').insert({ ...form, title: form.title.trim() }).select().single()
    setObjectives(prev => [data, ...prev])
    setForm({ title: '', description: '', period_label: form.period_label })
    setShowAdd(false)
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('objectives').update({ status }).eq('id', id)
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  async function archive(id) {
    await supabase.from('objectives').update({ archived: true }).eq('id', id)
    setObjectives(prev => prev.filter(o => o.id !== id))
  }

  const periods = [...new Set(objectives.map(o => o.period_label))].sort((a, b) => b.localeCompare(a))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', margin: 0 }}>Objectives</h1>
        <button onClick={() => setShowAdd(s => !s)} style={btnPrimary}>{showAdd ? 'Cancel' : '+ Add Objective'}</button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 24, marginBottom: 28 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.02em', margin: '0 0 18px' }}>New Objective</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Period</label>
              <input value={form.period_label} onChange={e => setForm(f => ({ ...f, period_label: e.target.value }))} placeholder="e.g. H1 2026" style={inp} />
            </div>
            <div>
              <label style={lbl}>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What are we focused on?" style={inp} />
            </div>
            <div>
              <label style={lbl}>Description / Key Results (optional)</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Context, key results, or success criteria…" style={{ ...inp, height: 72, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={addObjective} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Add Objective'}</button>
              <button onClick={() => setShowAdd(false)} style={{ padding: '10px 22px', background: 'transparent', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
      ) : objectives.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No objectives yet. Add your first bi-annual goal above.</p>
      ) : (
        periods.map(period => (
          <div key={period} style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.06em', color: 'var(--color-muted)', marginBottom: 12, textTransform: 'uppercase' }}>{period}</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {objectives.filter(o => o.period_label === period).map(obj => (
                <ObjectiveCard key={obj.id} obj={obj} onStatusChange={updateStatus} onArchive={archive} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ObjectiveCard({ obj, onStatusChange, onArchive }) {
  const [confirming, setConfirming] = useState(false)
  const s = STATUS_MAP[obj.status] || STATUS_MAP.on_track
  const others = Object.entries(STATUS_MAP).filter(([k]) => k !== obj.status)

  return (
    <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: obj.description ? 6 : 0, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text)' }}>{obj.title}</span>
            <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: s.color, background: s.bg }}>{s.label}</span>
          </div>
          {obj.description && <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>{obj.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0, alignItems: 'flex-start' }}>
          {others.map(([k, st]) => (
            <button key={k} onClick={() => onStatusChange(obj.id, k)} style={{ padding: '5px 12px', background: st.bg, color: st.color, border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
              → {st.label}
            </button>
          ))}
          {confirming ? (
            <>
              <button onClick={() => onArchive(obj.id)} style={{ padding: '5px 12px', background: '#a33', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>Confirm</button>
              <button onClick={() => setConfirming(false)} style={{ padding: '5px 10px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} style={{ padding: '5px 10px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>Archive</button>
          )}
        </div>
      </div>
    </div>
  )
}

function currentPeriod() {
  const m = new Date().getMonth()
  const y = new Date().getFullYear()
  return `${m < 6 ? 'H1' : 'H2'} ${y}`
}
