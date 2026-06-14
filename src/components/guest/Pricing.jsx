import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Pricing({ settings }) {
  const [baseRates, setBaseRates] = useState([])

  useEffect(() => {
    supabase.from('pricing_base').select('*').order('day_of_week').then(({ data }) => {
      if (data) setBaseRates(data)
    })
  }, [])

  const hasRates = baseRates.some(r => r.rate)
  const fees = [
    { label: 'Cleaning Fee', value: settings?.cleaning_fee ? `$${settings.cleaning_fee}` : null },
    { label: 'Pet Fee', value: settings?.pet_fee ? `$${settings.pet_fee}` : null },
    { label: 'Minimum Nights', value: settings?.min_nights ? `${settings.min_nights} nights` : null },
  ].filter(f => f.value)

  if (!hasRates && !fees.length) return null

  const minRate = baseRates.length ? Math.min(...baseRates.map(r => r.rate || 0).filter(Boolean)) : null
  const maxRate = baseRates.length ? Math.max(...baseRates.map(r => r.rate || 0).filter(Boolean)) : null

  return (
    <section id="pricing" style={{ padding: 'var(--section-pad)' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '0.04em', marginBottom: 8, textAlign: 'center' }}>Pricing</h2>
        {minRate && maxRate && minRate !== maxRate && (
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', marginBottom: 40, fontSize: '0.9rem' }}>
            From <strong style={{ color: 'var(--color-text)' }}>${minRate}</strong> to <strong style={{ color: 'var(--color-text)' }}>${maxRate}</strong> per night depending on the day
          </p>
        )}
        {minRate && minRate === maxRate && (
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', marginBottom: 40, fontSize: '0.9rem' }}>
            <strong style={{ color: 'var(--color-text)' }}>${minRate}</strong> per night
          </p>
        )}

        {/* Day of week rate grid */}
        {hasRates && (
          <div style={{ background: 'var(--color-card)', borderRadius: 'var(--radius-md)', padding: '24px 20px', marginBottom: 24, maxWidth: 700, margin: '0 auto 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {baseRates.map(row => (
                <div key={row.day_of_week} style={{ textAlign: 'center', padding: '12px 4px', borderRadius: 'var(--radius-sm)', background: row.rate === maxRate ? 'var(--color-primary)' : 'transparent' }}>
                  <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: row.rate === maxRate ? 'rgba(255,255,255,0.7)' : 'var(--color-muted)', marginBottom: 6 }}>
                    {DAYS[row.day_of_week]}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: row.rate === maxRate ? '#fff' : 'var(--color-text)' }}>
                    {row.rate ? `$${row.rate}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fees */}
        {fees.length > 0 && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 700, margin: '0 auto' }}>
            {fees.map(fee => (
              <div key={fee.label} style={{ background: 'var(--color-card)', borderRadius: 'var(--radius-md)', padding: '20px 24px', textAlign: 'center', flex: '1 1 140px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--color-primary)', marginBottom: 4 }}>{fee.value}</div>
                <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{fee.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
