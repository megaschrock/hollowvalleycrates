export default function Pricing({ settings }) {
  if (!settings) return null

  const items = [
    { label: 'Per Night', value: settings.nightly_rate ? `$${settings.nightly_rate}` : null },
    { label: 'Cleaning Fee', value: settings.cleaning_fee ? `$${settings.cleaning_fee}` : null },
    { label: 'Pet Fee', value: settings.pet_fee ? `$${settings.pet_fee}` : null },
    { label: 'Minimum Nights', value: settings.min_nights ? `${settings.min_nights} nights` : null },
  ].filter(i => i.value)

  if (!items.length) return null

  return (
    <section id="pricing" style={{ padding: 'var(--section-pad)' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '0.04em', marginBottom: 40, textAlign: 'center' }}>Pricing</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, maxWidth: 800, margin: '0 auto' }}>
          {items.map(item => (
            <div key={item.label} style={{ background: 'var(--color-card)', borderRadius: 'var(--radius-md)', padding: '32px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--color-primary)', marginBottom: 8 }}>{item.value}</div>
              <div style={{ fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
