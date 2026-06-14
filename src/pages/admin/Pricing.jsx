import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', background: '#fff', color: 'var(--color-text)' }
const labelStyle = { display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }

export default function Pricing() {
  const [form, setForm] = useState({ nightly_rate:'', cleaning_fee:'', pet_fee:'', min_nights:'' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('nightly_rate,cleaning_fee,pet_fee,min_nights').eq('id', 1).single().then(({ data }) => {
      if (data) setForm({ nightly_rate: data.nightly_rate||'', cleaning_fee: data.cleaning_fee||'', pet_fee: data.pet_fee||'', min_nights: data.min_nights||'' })
    })
  }, [])

  async function save() {
    setSaving(true)
    await supabase.from('settings').update(form).eq('id', 1)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 32 }}>Pricing</h1>
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '24px', maxWidth: 480, display: 'grid', gap: 16 }}>
        {[['nightly_rate','Nightly Rate ($)'],['cleaning_fee','Cleaning Fee ($)'],['pet_fee','Pet Fee ($)'],['min_nights','Minimum Nights']].map(([k, label]) => (
          <div key={k}>
            <label style={labelStyle}>{label}</label>
            <input style={inputStyle} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
          </div>
        ))}
        <button onClick={save} disabled={saving} style={{ padding: '11px 24px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none', marginTop: 8 }}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
