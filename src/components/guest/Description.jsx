export default function Description({ settings }) {
  if (!settings) return null
  const amenities = Array.isArray(settings.amenities) ? settings.amenities : []

  return (
    <section id="description" style={{ padding: 'var(--section-pad)', background: 'var(--color-card)' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '0.04em', marginBottom: 24 }}>
          {settings.property_headline || 'A Modern Retreat'}
        </h2>
        <p style={{ maxWidth: 700, lineHeight: 1.8, color: 'var(--color-text)', marginBottom: 56, fontSize: '1.05rem' }}>
          {settings.property_description || 'Nestled in the Ohio countryside, Hollow Valley Crates offers a serene escape with modern comforts and architectural beauty.'}
        </p>
        {amenities.length > 0 && (
          <>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', letterSpacing: '0.04em', marginBottom: 24 }}>Amenities</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px 24px' }}>
              {amenities.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.95rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
