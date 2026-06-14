export default function Footer({ settings }) {
  const year = new Date().getFullYear()
  return (
    <footer style={{ background: 'var(--color-text)', color: 'rgba(255,255,255,0.6)', padding: '40px 24px', textAlign: 'center' }}>
      <img src="/logo.png" alt="Hollow Valley Crates" style={{ width: 120, height: 120, margin: '0 auto 16px', objectFit: 'contain', opacity: 0.7 }} />
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>HOLLOW VALLEY CRATES</p>
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        {[['#hero','Home'],['#gallery','Gallery'],['#description','Property'],['#pricing','Pricing'],['#availability','Availability'],['#inquiry','Book'],['#contact','Contact']].map(([href, label]) => (
          <a key={href} href={href} style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', transition: 'color 0.2s' }}
            onMouseOver={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>{label}</a>
        ))}
      </div>
      {(settings?.social_instagram || settings?.social_facebook) && (
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
          {settings.social_instagram && (
            <a href={settings.social_instagram} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', letterSpacing: '0.08em' }}>Instagram</a>
          )}
          {settings.social_facebook && (
            <a href={settings.social_facebook} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', letterSpacing: '0.08em' }}>Facebook</a>
          )}
        </div>
      )}
      <p style={{ fontSize: '0.75rem' }}>© {year} Hollow Valley Crates. All rights reserved.</p>
    </footer>
  )
}
