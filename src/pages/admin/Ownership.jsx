import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../../hooks/useSettings'

const card = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '32px' }
const lbl = { display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 600, marginBottom: 8 }
const inp = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', background: '#fff', color: 'var(--color-text)', boxSizing: 'border-box' }
const btnPrimary = { padding: '10px 24px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }
const btnSecondary = { padding: '10px 24px', background: 'transparent', color: 'var(--color-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: '1px solid var(--color-border)' }

export default function Ownership() {
  const { settings, loading, updateSettings } = useSettings()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [valueInput, setValueInput] = useState('')

  function startEdit() {
    setForm({
      mission: settings?.mission || '',
      vision: settings?.vision || '',
      company_values: settings?.company_values || [],
    })
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    try {
      await updateSettings(form)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function addValue() {
    if (!valueInput.trim()) return
    setForm(f => ({ ...f, company_values: [...(f.company_values || []), valueInput.trim()] }))
    setValueInput('')
  }

  function removeValue(i) {
    setForm(f => ({ ...f, company_values: f.company_values.filter((_, idx) => idx !== i) }))
  }

  if (loading) return <div style={{ color: 'var(--color-muted)' }}>Loading…</div>

  const mission = settings?.mission || ''
  const vision = settings?.vision || ''
  const values = settings?.company_values || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', margin: 0 }}>Ownership OS</h1>
        {!editing && <button onClick={startEdit} style={btnSecondary}>Edit Settings</button>}
      </div>

      {editing && form ? (
        <div style={{ display: 'grid', gap: 20, marginBottom: 32 }}>
          <div style={card}>
            <label style={lbl}>Mission</label>
            <textarea
              value={form.mission}
              onChange={e => setForm(f => ({ ...f, mission: e.target.value }))}
              placeholder="What we do and why it matters…"
              style={{ ...inp, height: 88, resize: 'vertical' }}
            />
          </div>
          <div style={card}>
            <label style={lbl}>Vision</label>
            <textarea
              value={form.vision}
              onChange={e => setForm(f => ({ ...f, vision: e.target.value }))}
              placeholder="What we're building toward…"
              style={{ ...inp, height: 88, resize: 'vertical' }}
            />
          </div>
          <div style={card}>
            <label style={lbl}>Values</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {(form.company_values || []).map((v, i) => (
                <span key={i} style={{ padding: '6px 14px', background: 'rgba(44,74,46,0.1)', color: 'var(--color-primary)', borderRadius: 100, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                  {v}
                  <button onClick={() => removeValue(i)} style={{ color: 'var(--color-muted)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={valueInput}
                onChange={e => setValueInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addValue())}
                placeholder="Add a value…"
                style={{ ...inp, flex: 1 }}
              />
              <button onClick={addValue} style={btnPrimary}>Add</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Save Changes'}</button>
            <button onClick={() => setEditing(false)} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20, marginBottom: 32 }}>
          {/* Mission — most prominent */}
          <div style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-md)', padding: '32px' }}>
            <p style={{ ...lbl, color: 'rgba(255,255,255,0.55)' }}>Mission</p>
            {mission
              ? <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: '#fff', lineHeight: 1.5, margin: 0 }}>{mission}</p>
              : <p style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', margin: 0 }}>No mission set yet — click <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Edit Settings</strong> to add one.</p>
            }
          </div>

          {/* Vision */}
          <div style={{ ...card, background: '#EDE8DC' }}>
            <p style={lbl}>Vision</p>
            {vision
              ? <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--color-text)', lineHeight: 1.5, margin: 0 }}>{vision}</p>
              : <p style={{ color: 'var(--color-muted)', fontStyle: 'italic', margin: 0 }}>No vision set yet.</p>
            }
          </div>

          {/* Values */}
          <div style={card}>
            <p style={lbl}>Values</p>
            {values.length > 0
              ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {values.map((v, i) => (
                    <span key={i} style={{ padding: '8px 20px', background: 'rgba(44,74,46,0.09)', color: 'var(--color-primary)', borderRadius: 100, fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.02em' }}>{v}</span>
                  ))}
                </div>
              )
              : <p style={{ color: 'var(--color-muted)', fontStyle: 'italic', margin: 0 }}>No values set yet.</p>
            }
          </div>
        </div>
      )}

      {/* Quick links — below MVV */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 28 }}>
        <p style={{ ...lbl, marginBottom: 16 }}>Tools</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Link to="/admin/meetings" style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)', padding: '20px 24px', textDecoration: 'none', display: 'block' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: 6 }}>▶</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.02em' }}>Meetings</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 2 }}>Start or review sessions</div>
          </Link>
          <Link to="/admin/objectives" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', padding: '20px 24px', textDecoration: 'none', display: 'block' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: 6 }}>◎</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.02em' }}>Objectives & To-Dos</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: 2 }}>Bi-annual goals & action items</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
