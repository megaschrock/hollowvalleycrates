import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem',
  background: 'var(--color-white)', color: 'var(--color-text)', outline: 'none',
}

export default function InquiryForm() {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', checkin:'', checkout:'', adults:1, children:0, pets:0, notes:'' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.from('inquiries').insert([{
        ...form,
        adults: Number(form.adults),
        children: Number(form.children),
        pets: Number(form.pets),
        submitted_at: new Date().toISOString(),
      }])
      if (error) throw error
      setSubmitted(true)
    } catch (err) {
      setError('Something went wrong. Please try again or contact us directly.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <section id="inquiry" style={{ padding: 'var(--section-pad)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>✓</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 16, letterSpacing: '0.04em' }}>Inquiry Received</h2>
          <p style={{ color: 'var(--color-muted)', lineHeight: 1.8 }}>Thank you for reaching out. We'll review your request and get back to you within 24 hours.</p>
        </div>
      </section>
    )
  }

  return (
    <section id="inquiry" style={{ padding: 'var(--section-pad)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '0.04em', marginBottom: 8 }}>Book Privately</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 36, fontSize: '0.95rem' }}>Skip the platform fees. Book direct and we'll be in touch to confirm and arrange payment.</p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input required style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input required style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email *</label>
              <input required type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Check-in Date *</label>
              <input required type="date" style={inputStyle} value={form.checkin} onChange={e => set('checkin', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Check-out Date *</label>
              <input required type="date" style={inputStyle} value={form.checkout} onChange={e => set('checkout', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[['adults','Adults',1],['children','Children',0],['pets','Pets',0]].map(([field, label, min]) => (
              <div key={field}>
                <label style={labelStyle}>{label}</label>
                <input type="number" min={min} style={inputStyle} value={form[field]} onChange={e => set(field, e.target.value)} />
              </div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>Additional Notes</label>
            <textarea style={{ ...inputStyle, height: 100, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          {error && <p style={{ color: '#c0392b', fontSize: '0.9rem' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            padding: '15px 32px', background: 'var(--color-primary)', color: '#fff',
            borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', letterSpacing: '0.12em',
            textTransform: 'uppercase', fontWeight: 500, opacity: loading ? 0.7 : 1, marginTop: 8
          }}>
            {loading ? 'Sending…' : 'Send Inquiry'}
          </button>
        </form>
      </div>
    </section>
  )
}

const labelStyle = { display: 'block', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }
