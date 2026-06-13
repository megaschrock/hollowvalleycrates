import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import PromoPopup from '../../components/guest/PromoPopup'

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', background: '#fff', color: 'var(--color-text)' }
const labelStyle = { display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }

const GIVEAWAY_URL = 'https://hollowvalleycrates.com/giveaway'

export default function AdminGiveaway() {
  const [form, setForm] = useState({ popup_enabled: false, popup_headline:'', popup_body:'', popup_cta_label:'', popup_cta_link:'' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('popup_enabled,popup_headline,popup_body,popup_cta_label,popup_cta_link').eq('id', 1).single().then(({ data }) => {
      if (data) setForm({ popup_enabled: data.popup_enabled||false, popup_headline: data.popup_headline||'', popup_body: data.popup_body||'', popup_cta_label: data.popup_cta_label||'', popup_cta_link: data.popup_cta_link||'' })
    })
  }, [])

  async function save() {
    setSaving(true)
    await supabase.from('settings').update(form).eq('id', 1)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function copyLink() {
    navigator.clipboard.writeText(GIVEAWAY_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 32 }}>Giveaway</h1>

      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>Popup Status</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: 4 }}>When enabled, the popup shows on the main page for first-time visitors.</p>
          </div>
          <button onClick={() => setForm(f => ({ ...f, popup_enabled: !f.popup_enabled }))} style={{ padding: '10px 24px', borderRadius: 100, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', border: 'none', background: form.popup_enabled ? 'var(--color-primary)' : 'var(--color-border)', color: form.popup_enabled ? '#fff' : 'var(--color-text)' }}>
            {form.popup_enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {[['popup_headline','Headline'],['popup_cta_label','CTA Button Label'],['popup_cta_link','CTA Link URL']].map(([k, label]) => (
            <div key={k}>
              <label style={labelStyle}>{label}</label>
              <input style={inputStyle} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={labelStyle}>Body Text</label>
            <textarea style={{ ...inputStyle, height: 100, resize: 'vertical' }} value={form.popup_body} onChange={e => setForm(f => ({ ...f, popup_body: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 20px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}</button>
          <button onClick={() => setPreview(true)} style={{ padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', cursor: 'pointer', background: 'none' }}>Preview Popup</button>
        </div>
      </div>

      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: 8 }}>Giveaway Link</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: 12 }}>Share this link — the popup always opens on arrival, regardless of the toggle above.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input readOnly value={GIVEAWAY_URL} style={{ ...inputStyle, flex: 1, background: 'var(--color-bg)' }} />
          <button onClick={copyLink} style={{ padding: '10px 18px', background: 'var(--color-secondary)', color: 'var(--color-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>

      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>
          <PromoPopup settings={form} forceOpen={true} />
          <button onClick={() => setPreview(false)} style={{ position: 'fixed', bottom: 24, right: 24, padding: '10px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', zIndex: 4000, boxShadow: 'var(--shadow-md)' }}>Close Preview</button>
        </div>
      )}
    </div>
  )
}
