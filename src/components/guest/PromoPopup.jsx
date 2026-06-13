import { useEffect, useState } from 'react'

const SESSION_KEY = 'hvc_popup_dismissed'

export default function PromoPopup({ settings, forceOpen = false }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!settings) return
    if (forceOpen) {
      setVisible(true)
      return
    }
    if (settings.popup_enabled && !sessionStorage.getItem(SESSION_KEY)) {
      setVisible(true)
    }
  }, [settings, forceOpen])

  function dismiss() {
    if (!forceOpen) sessionStorage.setItem(SESSION_KEY, '1')
    setVisible(false)
  }

  if (!visible || !settings) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={dismiss}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg)', maxWidth: 460, width: '100%', borderRadius: 'var(--radius-md)', padding: '48px 40px', position: 'relative', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
        <button onClick={dismiss} aria-label="Close" style={{ position: 'absolute', top: 16, right: 20, fontSize: 24, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.04em', marginBottom: 16, color: 'var(--color-primary)' }}>
          {settings.popup_headline || 'Special Offer'}
        </h2>
        <p style={{ lineHeight: 1.8, color: 'var(--color-text)', marginBottom: 32, fontSize: '0.95rem' }}>
          {settings.popup_body || ''}
        </p>
        {settings.popup_cta_link && (
          <a href={settings.popup_cta_link} target="_blank" rel="noopener noreferrer" onClick={dismiss}
            style={{ display: 'inline-block', padding: '14px 32px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
            {settings.popup_cta_label || 'Learn More'}
          </a>
        )}
      </div>
    </div>
  )
}
