import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Hero({ settings }) {
  const [heroPhoto, setHeroPhoto] = useState(null)

  useEffect(() => {
    async function fetchFirstPhoto() {
      const { data } = await supabase
        .from('photos')
        .select('url')
        .order('display_order', { ascending: true })
        .limit(1)
        .single()
      if (data) setHeroPhoto(data.url)
    }
    fetchFirstPhoto()
  }, [])

  const heroStyle = heroPhoto
    ? { backgroundImage: `url(${heroPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'var(--color-primary)' }

  return (
    <section id="hero" style={{ ...heroStyle, position: 'relative', minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      <div style={{ position: 'relative', textAlign: 'center', color: '#fff', maxWidth: '700px' }}>
        <img src="/logo.png" alt="Hollow Valley Crates" style={{ width: 200, height: 200, margin: '0 auto 24px', objectFit: 'contain' }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: 300, letterSpacing: '0.06em', marginBottom: 8 }}>HOLLOW VALLEY CRATES</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 40, opacity: 0.85 }}>Private Retreat · Ohio</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#availability" style={btnStyle('solid')}>Book Now</a>
        </div>
      </div>
      <a href="#gallery" aria-label="Scroll down" style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', color: '#fff', opacity: 0.7, fontSize: 24, animation: 'bounce 2s infinite' }}>↓</a>
      <style>{`@keyframes bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(8px)} }`}</style>
    </section>
  )
}

function btnStyle(variant) {
  const base = {
    display: 'inline-block',
    padding: '14px 28px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 500,
    borderRadius: 'var(--radius-sm)',
    transition: 'all 0.2s',
  }
  if (variant === 'solid') return { ...base, background: 'var(--color-secondary)', color: 'var(--color-text)' }
  return { ...base, border: '1px solid rgba(255,255,255,0.7)', color: '#fff', background: 'rgba(255,255,255,0.08)' }
}
