export default function ContactSection({ settings }) {
  if (!settings) return null
  return (
    <section id="contact" style={{ padding: 'var(--section-pad)', background: 'var(--color-primary)', color: '#fff' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '0.06em', marginBottom: 40 }}>Get in Touch</h2>
        <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
          {settings.phone && (
            <a href={`tel:${settings.phone}`} style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.65 }}>Phone</span>
              {settings.phone}
            </a>
          )}
          {settings.email && (
            <a href={`mailto:${settings.email}`} style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.65 }}>Email</span>
              {settings.email}
            </a>
          )}
        </div>
        {(settings.airbnb_url || settings.vrbo_url) && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 32 }}>
            <p style={{ fontSize: '0.85rem', letterSpacing: '0.06em', opacity: 0.7, marginBottom: 20 }}>
              Prefer to book through a third-party platform?
            </p>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              {settings.airbnb_url && (
                <a href={settings.airbnb_url} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 24px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  View on Airbnb
                </a>
              )}
              {settings.vrbo_url && (
                <a href={settings.vrbo_url} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 24px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  View on VRBO
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
