import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', background: '#fff', color: 'var(--color-text)' }
const labelStyle = { display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }
const sectionStyle = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 24 }

export default function Content() {
  const [form, setForm] = useState({ property_headline:'', property_description:'', amenities:[], phone:'', email:'', airbnb_url:'', vrbo_url:'', social_instagram:'', social_facebook:'' })
  const [amenityInput, setAmenityInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setForm({ property_headline: data.property_headline||'', property_description: data.property_description||'', amenities: data.amenities||[], phone: data.phone||'', email: data.email||'', airbnb_url: data.airbnb_url||'', vrbo_url: data.vrbo_url||'', social_instagram: data.social_instagram||'', social_facebook: data.social_facebook||'' })
    })
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function addAmenity() {
    if (!amenityInput.trim()) return
    set('amenities', [...form.amenities, amenityInput.trim()])
    setAmenityInput('')
  }

  function removeAmenity(i) { set('amenities', form.amenities.filter((_, idx) => idx !== i)) }

  async function save() {
    setSaving(true)
    await supabase.from('settings').update(form).eq('id', 1)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 32 }}>Content</h1>

      <div style={sectionStyle}>
        <h2 style={sh2}>Property</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="Headline" value={form.property_headline} onChange={v => set('property_headline', v)} />
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, height: 120, resize: 'vertical' }} value={form.property_description} onChange={e => set('property_description', e.target.value)} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Amenities</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {form.amenities.map((a, i) => (
            <span key={i} style={{ padding: '5px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 100, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              {a} <button onClick={() => removeAmenity(i)} style={{ color: 'var(--color-muted)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={amenityInput} onChange={e => setAmenityInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAmenity()} placeholder="Add amenity…" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addAmenity} style={btnPrimary}>Add</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Contact</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Phone" value={form.phone} onChange={v => set('phone', v)} />
          <Field label="Email" value={form.email} onChange={v => set('email', v)} />
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Listing URLs</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="Airbnb URL" value={form.airbnb_url} onChange={v => set('airbnb_url', v)} />
          <Field label="VRBO URL" value={form.vrbo_url} onChange={v => set('vrbo_url', v)} />
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Social</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="Instagram URL" value={form.social_instagram} onChange={v => set('social_instagram', v)} />
          <Field label="Facebook URL" value={form.social_facebook} onChange={v => set('social_facebook', v)} />
        </div>
      </div>

      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}</button>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

const sh2 = { fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.03em', marginBottom: 16 }
const btnPrimary = { padding: '11px 24px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }
