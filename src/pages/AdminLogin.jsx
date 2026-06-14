import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      navigate('/admin/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/logo.png" alt="" style={{ width: 56, height: 56, margin: '0 auto 16px', objectFit: 'contain' }} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '0.04em' }}>Admin Access</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: 6 }}>Hollow Valley Crates</p>
        </div>
        <form onSubmit={handleSubmit} style={{ background: 'var(--color-card)', padding: '32px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} autoComplete="email" />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} autoComplete="current-password" />
          </div>
          {error && <p style={{ color: '#c0392b', fontSize: '0.875rem' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ padding: '13px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 500, fontSize: '0.9rem', letterSpacing: '0.06em', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }
const inputStyle = { width: '100%', padding: '11px 13px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', background: 'var(--color-white)', color: 'var(--color-text)' }
