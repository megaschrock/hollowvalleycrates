import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/pricing', label: 'Pricing' },
  { to: '/admin/calendar', label: 'Calendar' },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/inquiries', label: 'Inquiries' },
  { to: '/admin/photos', label: 'Photos' },
  { to: '/admin/giveaway', label: 'Giveaway' },
  { to: '/admin/stats', label: 'Stats' },
]

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  async function logout() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const linkStyle = ({ isActive }) => ({
    display: 'block', padding: '10px 16px', borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500,
    color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
    background: isActive ? 'rgba(44,74,46,0.08)' : 'transparent',
    textDecoration: 'none', transition: 'background 0.15s',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100svh', background: 'var(--color-bg)' }}>
      {/* Sidebar — desktop */}
      <aside className="admin-sidebar" style={{ width: 220, background: 'var(--color-card)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: 4, flexShrink: 0 }}>
        <div style={{ marginBottom: 24, paddingLeft: 16 }}>
          <img src="/logo.png" alt="" style={{ width: 36, height: 36, objectFit: 'contain', marginBottom: 8 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', letterSpacing: '0.05em', color: 'var(--color-primary)' }}>HVC Admin</div>
        </div>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} style={linkStyle}>{item.label}</NavLink>
        ))}
        <div style={{ marginTop: 'auto' }}>
          <NavLink to="/" style={{ display: 'block', padding: '10px 16px', fontSize: '0.875rem', color: 'var(--color-muted)', textDecoration: 'none' }}>← View Site</NavLink>
          <button onClick={logout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: '0.875rem', color: 'var(--color-muted)', background: 'none', cursor: 'pointer' }}>Sign Out</button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="admin-mobile-header" style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'var(--color-card)', borderBottom: '1px solid var(--color-border)', padding: '12px 16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.04em', color: 'var(--color-primary)' }}>HVC Admin</span>
        <button onClick={() => setMenuOpen(m => !m)} style={{ fontSize: 22, color: 'var(--color-text)', lineHeight: 1 }}>☰</button>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setMenuOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, background: 'var(--color-card)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: 'var(--shadow-lg)' }}>
            <button onClick={() => setMenuOpen(false)} style={{ alignSelf: 'flex-end', fontSize: 22, marginBottom: 16, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} style={linkStyle} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>
            ))}
            <div style={{ marginTop: 'auto' }}>
              <button onClick={logout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: '0.875rem', color: 'var(--color-muted)', background: 'none', cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      <main className="admin-main" style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        <Outlet />
      </main>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-mobile-header { display: flex !important; }
          .admin-main { padding: 80px 16px 24px !important; }
        }
      `}</style>
    </div>
  )
}
