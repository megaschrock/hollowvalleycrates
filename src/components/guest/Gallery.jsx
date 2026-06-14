import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function Gallery() {
  const [photos, setPhotos] = useState([])
  const [lightbox, setLightbox] = useState(null)
  const [current, setCurrent] = useState(0)
  const touchStart = useRef(null)
  const touchEnd = useRef(null)

  useEffect(() => {
    supabase.from('photos').select('*').order('display_order').then(({ data }) => {
      if (data) setPhotos(data)
    })
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (lightbox === null) return
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setCurrent(c => (c + 1) % photos.length)
      if (e.key === 'ArrowLeft') setCurrent(c => (c - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, photos.length])

  if (!photos.length) {
    return (
      <section id="gallery" style={{ padding: 'var(--section-pad)', textAlign: 'center', color: 'var(--color-muted)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>Photos coming soon</p>
      </section>
    )
  }

  return (
    <section id="gallery" style={{ padding: 'var(--section-pad)', maxWidth: 'var(--max-width)', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3rem)', marginBottom: 40, textAlign: 'center', letterSpacing: '0.04em' }}>The Property</h2>

      {/* Desktop grid */}
      <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {photos.map((photo, i) => (
          <div key={photo.id} onClick={() => { setLightbox(photo); setCurrent(i) }}
            style={{ cursor: 'pointer', aspectRatio: '4/3', overflow: 'hidden', borderRadius: 'var(--radius-sm)', background: 'var(--color-card)' }}>
            <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'} />
          </div>
        ))}
      </div>

      {/* Mobile carousel */}
      <div className="gallery-carousel" style={{ display: 'none' }}>
        <div
          style={{ display: 'flex', overflowX: 'auto', gap: 12, scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          onTouchStart={e => { touchStart.current = e.targetTouches[0].clientX }}
          onTouchEnd={e => {
            touchEnd.current = e.changedTouches[0].clientX
            if (touchStart.current - touchEnd.current > 50) setCurrent(c => Math.min(c + 1, photos.length - 1))
            if (touchEnd.current - touchStart.current > 50) setCurrent(c => Math.max(c - 1, 0))
          }}
        >
          {photos.map(photo => (
            <div key={photo.id} style={{ flex: '0 0 85vw', scrollSnapAlign: 'start', aspectRatio: '4/3', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--color-card)' }}>
              <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 24, color: '#fff', fontSize: 32, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          <button onClick={e => { e.stopPropagation(); setCurrent(c => (c - 1 + photos.length) % photos.length); setLightbox(photos[(current - 1 + photos.length) % photos.length]) }}
            style={{ position: 'absolute', left: 16, color: '#fff', fontSize: 40, background: 'none', border: 'none', cursor: 'pointer' }}>‹</button>
          <img src={photos[current].url} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
          <button onClick={e => { e.stopPropagation(); setCurrent(c => (c + 1) % photos.length); setLightbox(photos[(current + 1) % photos.length]) }}
            style={{ position: 'absolute', right: 16, color: '#fff', fontSize: 40, background: 'none', border: 'none', cursor: 'pointer' }}>›</button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .gallery-grid { display: none !important; }
          .gallery-carousel { display: block !important; }
        }
      `}</style>
    </section>
  )
}
