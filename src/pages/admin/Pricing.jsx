import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS = [
  { key: 'sun', label: 'Sunday', col: 0 },
  { key: 'mon', label: 'Monday', col: 1 },
  { key: 'tue', label: 'Tuesday', col: 2 },
  { key: 'wed', label: 'Wednesday', col: 3 },
  { key: 'thu', label: 'Thursday', col: 4 },
  { key: 'fri', label: 'Friday', col: 5 },
  { key: 'sat', label: 'Saturday', col: 6 },
]

const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.9rem',
  background: '#fff', color: 'var(--color-text)', textAlign: 'center',
}
const labelStyle = {
  display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500,
}
const sectionStyle = {
  background: 'var(--color-card)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 24,
}
const btnPrimary = {
  padding: '10px 22px', background: 'var(--color-primary)', color: '#fff',
  borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500,
  cursor: 'pointer', border: 'none',
}

function DayRateGrid({ rates, onChange }) {
  return (
    <>
      <style>{`
        .day-rate-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
        @media (max-width: 600px) {
          .day-rate-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
      <div className="day-rate-grid">
        {DAYS.map(d => (
          <div key={d.key}>
            <label style={{ ...labelStyle, textAlign: 'center' }}>{d.label.slice(0, 3)}</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', fontSize: '0.85rem' }}>$</span>
              <input
                type="number"
                min="0"
                style={{ ...inputStyle, paddingLeft: 18, fontSize: '0.85rem' }}
                value={rates[d.key] ?? ''}
                onChange={e => onChange({ ...rates, [d.key]: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function Pricing() {
  const [baseRates, setBaseRates] = useState({ sun: '', mon: '', tue: '', wed: '', thu: '', fri: '', sat: '' })
  const [overrides, setOverrides] = useState([])
  const [newOverride, setNewOverride] = useState({ label: '', start_date: '', end_date: '', repeat_yearly: false, sun: '', mon: '', tue: '', wed: '', thu: '', fri: '', sat: '' })
  const [savingBase, setSavingBase] = useState(false)
  const [savedBase, setSavedBase] = useState(false)
  const [addingOverride, setAddingOverride] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: base }, { data: ovr }] = await Promise.all([
      supabase.from('pricing_base').select('*').order('day_of_week'),
      supabase.from('pricing_overrides').select('*').order('start_date'),
    ])
    if (base) {
      const r = {}
      base.forEach(row => { r[DAYS[row.day_of_week].key] = row.rate ?? '' })
      setBaseRates(r)
    }
    if (ovr) setOverrides(ovr)
  }

  async function saveBaseRates() {
    setSavingBase(true)
    for (const d of DAYS) {
      await supabase.from('pricing_base')
        .update({ rate: Number(baseRates[d.key]) || 0 })
        .eq('day_of_week', d.col)
    }
    setSavingBase(false); setSavedBase(true)
    setTimeout(() => setSavedBase(false), 2000)
  }

  async function addOverride() {
    if (!newOverride.start_date || !newOverride.end_date || !newOverride.label) return
    setAddingOverride(true)
    const { data } = await supabase.from('pricing_overrides').insert([{
      label: newOverride.label,
      start_date: newOverride.start_date,
      end_date: newOverride.end_date,
      repeat_yearly: newOverride.repeat_yearly || false,
      sun: Number(newOverride.sun) || null,
      mon: Number(newOverride.mon) || null,
      tue: Number(newOverride.tue) || null,
      wed: Number(newOverride.wed) || null,
      thu: Number(newOverride.thu) || null,
      fri: Number(newOverride.fri) || null,
      sat: Number(newOverride.sat) || null,
      created_at: new Date().toISOString(),
    }]).select().single()
    if (data) {
      setOverrides(o => [...o, data])
      setNewOverride({ label: '', start_date: '', end_date: '', repeat_yearly: false, sun: '', mon: '', tue: '', wed: '', thu: '', fri: '', sat: '' })
      setShowAddForm(false)
    }
    setAddingOverride(false)
  }

  async function deleteOverride(id) {
    await supabase.from('pricing_overrides').delete().eq('id', id)
    setOverrides(o => o.filter(x => x.id !== id))
  }

  async function updateOverrideRates(id, rates, repeatYearly) {
    const updates = { repeat_yearly: repeatYearly }
    DAYS.forEach(d => { updates[d.key] = Number(rates[d.key]) || null })
    await supabase.from('pricing_overrides').update(updates).eq('id', id)
    setOverrides(o => o.map(x => x.id === id ? { ...x, ...updates } : x))
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 8 }}>Standard Rates</h1>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginBottom: 32 }}>
        Set base rates by day of week. Add date range overrides for holidays or slow periods — override rates take priority over base rates for those dates.
      </p>

      {/* Base rates */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: 6 }}>Base Rates</h2>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginBottom: 20 }}>Default nightly rate per day of week.</p>
        <DayRateGrid rates={baseRates} onChange={setBaseRates} />
        <button onClick={saveBaseRates} disabled={savingBase} style={{ ...btnPrimary, marginTop: 20 }}>
          {savingBase ? 'Saving…' : savedBase ? 'Saved ✓' : 'Save Base Rates'}
        </button>
      </div>

      {/* Overrides */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: 4 }}>Date Range Overrides</h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>Holiday weekends, slow periods, or any date range that needs custom rates.</p>
          </div>
          <button onClick={() => setShowAddForm(f => !f)} style={{ ...btnPrimary, background: 'var(--color-secondary)', color: 'var(--color-text)' }}>
            {showAddForm ? 'Cancel' : '+ Add Override'}
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 20, marginBottom: 24 }}>
            <style>{`.override-header-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
              @media (max-width: 700px) { .override-header-grid { grid-template-columns: 1fr; } }`}</style>
            <div className="override-header-grid">
              <div>
                <label style={labelStyle}>Label (e.g. "Memorial Day")</label>
                <input style={{ ...inputStyle, textAlign: 'left' }} value={newOverride.label} onChange={e => setNewOverride(o => ({ ...o, label: e.target.value }))} placeholder="Holiday name…" />
              </div>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" style={{ ...inputStyle, width: 'auto' }} value={newOverride.start_date} onChange={e => setNewOverride(o => ({ ...o, start_date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input type="date" style={{ ...inputStyle, width: 'auto' }} value={newOverride.end_date} onChange={e => setNewOverride(o => ({ ...o, end_date: e.target.value }))} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}>
              <input type="checkbox" checked={newOverride.repeat_yearly} onChange={e => setNewOverride(o => ({ ...o, repeat_yearly: e.target.checked }))} style={{ width: 15, height: 15, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>Repeat every year</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>(same month/day range, auto-applies in future years)</span>
            </label>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: 12 }}>Set rates for each day within this range. Leave blank to fall back to base rate for that day.</p>
            <DayRateGrid rates={newOverride} onChange={r => setNewOverride(o => ({ ...o, ...r }))} />
            <button onClick={addOverride} disabled={addingOverride} style={{ ...btnPrimary, marginTop: 16 }}>
              {addingOverride ? 'Saving…' : 'Save Override'}
            </button>
          </div>
        )}

        {/* Override list */}
        {overrides.length === 0 && !showAddForm && (
          <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '24px 0', fontSize: '0.875rem' }}>No overrides yet.</p>
        )}
        {overrides.map(ovr => (
          <OverrideRow key={ovr.id} ovr={ovr} onDelete={() => deleteOverride(ovr.id)} onSave={rates => updateOverrideRates(ovr.id, rates)} />
        ))}
        <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 16 }}>
          Tip: You can also adjust pricing for a specific date range directly from the <a href="/admin/bookings" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Calendar</a> tab.
        </p>
      </div>
    </div>
  )
}

function OverrideRow({ ovr, onDelete, onSave }) {
  const [expanded, setExpanded] = useState(false)
  const [rates, setRates] = useState({ sun: ovr.sun ?? '', mon: ovr.mon ?? '', tue: ovr.tue ?? '', wed: ovr.wed ?? '', thu: ovr.thu ?? '', fri: ovr.fri ?? '', sat: ovr.sat ?? '' })
  const [repeatYearly, setRepeatYearly] = useState(ovr.repeat_yearly || false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(rates, repeatYearly)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', background: expanded ? 'rgba(44,74,46,0.04)' : '#fff' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{ovr.label}</span>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{ovr.start_date} → {ovr.end_date}</span>
          {ovr.repeat_yearly && <span style={{ fontSize: '0.7rem', background: 'rgba(44,74,46,0.1)', color: 'var(--color-primary)', padding: '2px 7px', borderRadius: 100, fontWeight: 500 }}>Repeats yearly</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ fontSize: '0.75rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
          <span style={{ color: 'var(--color-muted)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)', background: '#fff' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: 12 }}>Leave blank to use base rate for that day.</p>
          <DayRateGrid rates={rates} onChange={setRates} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}>
            <input type="checkbox" checked={repeatYearly} onChange={e => setRepeatYearly(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>Repeat every year</span>
          </label>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, marginTop: 14, fontSize: '0.8rem', padding: '8px 18px' }}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Rates'}
          </button>
        </div>
      )}
    </div>
  )
}
