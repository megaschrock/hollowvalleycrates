import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const card = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }
const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', boxSizing: 'border-box' }
const label = { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-muted)', marginBottom: 4 }

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtShort(s) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function yearOf(dateStr) {
  return new Date(dateStr + 'T12:00:00').getFullYear()
}

export default function Cleaning() {
  const [reservations, setReservations] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [newCleanerName, setNewCleanerName] = useState('')
  const [showCleaners, setShowCleaners] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: res }, { data: cl }, { data: asgn }] = await Promise.all([
      supabase.from('reservations').select('*').order('start_date', { ascending: true }),
      supabase.from('cleaners').select('*').order('name'),
      supabase.from('cleaning_assignments').select('*'),
    ])
    setReservations(res || [])
    setCleaners(cl || [])
    setAssignments(asgn || [])
    setLoading(false)
  }

  async function updateAssignment(id, field, value) {
    setAssignments(as => as.map(a => a.id === id ? { ...a, [field]: value } : a))
    await supabase.from('cleaning_assignments').update({ [field]: value }).eq('id', id)
  }

  async function ensureAssignment(reservationId, checkoutDate) {
    const existing = assignments.find(a => a.reservation_id === reservationId)
    if (existing) return existing
    const { data } = await supabase.from('cleaning_assignments').insert({
      reservation_id: reservationId,
      scheduled_date: checkoutDate,
    }).select().single()
    if (data) setAssignments(as => [...as, data])
    return data
  }

  async function addCleaner(name) {
    const { data } = await supabase.from('cleaners').insert({ name }).select().single()
    if (data) setCleaners(cs => [...cs, data])
  }

  async function deleteCleaner(id) {
    await supabase.from('cleaners').delete().eq('id', id)
    setCleaners(cs => cs.filter(c => c.id !== id))
  }

  async function updateCleaner(id, field, value) {
    setCleaners(cs => cs.map(c => c.id === id ? { ...c, [field]: value } : c))
    await supabase.from('cleaners').update({ [field]: value }).eq('id', id)
  }

  async function handleField(reservationId, checkoutDate, field, value) {
    const asgn = await ensureAssignment(reservationId, checkoutDate)
    if (asgn) updateAssignment(asgn.id, field, value)
  }

  const years = [...new Set(reservations.map(r => yearOf(r.start_date)))].sort((a, b) => b - a)
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear())
  const filteredRes = reservations.filter(r => yearOf(r.start_date) === yearFilter)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  if (loading) return <div style={{ color: 'var(--color-muted)', padding: 32 }}>Loading…</div>

  const upcoming = filteredRes.filter(r => r.end_date >= today)
  const past = filteredRes.filter(r => r.end_date < today)
  const visible = showPast ? filteredRes : upcoming

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 24 }}>Cleaning</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {years.map(y => (
          <button key={y} onClick={() => setYearFilter(y)} style={{
            padding: '5px 16px', borderRadius: 999, border: '1px solid var(--color-border)',
            background: yearFilter === y ? 'var(--color-primary)' : 'var(--color-card)',
            color: yearFilter === y ? '#fff' : 'var(--color-text)', fontSize: '0.82rem', cursor: 'pointer',
          }}>{y}</button>
        ))}
        <button onClick={() => setShowCleaners(s => !s)} style={{ marginLeft: 'auto', padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-card)', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--color-text)' }}>
          {showCleaners ? 'Hide' : 'Manage'} Cleaners
        </button>
      </div>

      {showCleaners && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>Cleaners</div>
          {cleaners.map(c => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input defaultValue={c.name} onBlur={e => updateCleaner(c.id, 'name', e.target.value)} style={inputStyle} placeholder="Name" />
              <input defaultValue={c.email} onBlur={e => updateCleaner(c.id, 'email', e.target.value)} style={inputStyle} placeholder="Email" />
              <input defaultValue={c.phone} onBlur={e => updateCleaner(c.id, 'phone', e.target.value)} style={inputStyle} placeholder="Phone" />
              <button onClick={() => deleteCleaner(c.id)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '0.82rem' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={newCleanerName} onChange={e => setNewCleanerName(e.target.value)} placeholder="New cleaner name" style={{ ...inputStyle, width: 200 }}
              onKeyDown={e => { if (e.key === 'Enter' && newCleanerName.trim()) { addCleaner(newCleanerName.trim()); setNewCleanerName('') } }} />
            <button onClick={() => { if (newCleanerName.trim()) { addCleaner(newCleanerName.trim()); setNewCleanerName('') } }}
              style={{ padding: '6px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem' }}>Add</button>
          </div>
        </div>
      )}

      {filteredRes.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No reservations for {yearFilter}.</p>
      ) : (
        <>
          {past.length > 0 && (
            <button onClick={() => setShowPast(s => !s)} style={{ marginBottom: 16, padding: '7px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-card)', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--color-text)' }}>
              {showPast ? 'Hide past cleaning schedule' : `Show past cleaning schedule (${past.length})`}
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map(r => {
              const asgn = assignments.find(a => a.reservation_id === r.id)
              const nextCheckin = reservations.find(x => x.start_date > r.end_date)?.start_date
              const cleaningMin = r.end_date
              const cleaningMax = nextCheckin
                ? new Date(new Date(nextCheckin + 'T12:00:00').getTime() - 86400000).toISOString().slice(0, 10)
                : new Date(new Date(r.end_date + 'T12:00:00').getTime() + 14 * 86400000).toISOString().slice(0, 10)
              const guestLabel = r.guest_name || 'Upcoming Guest'

              return (
                <div key={r.id} style={{ ...card, padding: '20px 24px' }}>
                  {/* Card header */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--color-primary)', marginBottom: 2 }}>
                      Cleaning after {guestLabel}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                    </div>
                  </div>

                  {/* Cleaner picker */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={label}>Cleaner</div>
                    <select value={asgn?.cleaner_id || ''} onChange={e => handleField(r.id, r.end_date, 'cleaner_id', e.target.value || null)} style={inputStyle}>
                      <option value="">— Assign cleaner —</option>
                      {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Available window + schedule date */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={label}>Dates available to clean</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--color-text)', marginBottom: 8, fontWeight: 500 }}>
                      {fmtShort(cleaningMin)} – {nextCheckin ? fmtShort(nextCheckin) : fmtShort(cleaningMax)}
                    </div>
                    <div style={{ ...label, marginTop: 0 }}>Schedule date</div>
                    <input type="date" min={cleaningMin} max={cleaningMax}
                      value={asgn?.scheduled_date || r.end_date || ''}
                      onChange={e => handleField(r.id, r.end_date, 'scheduled_date', e.target.value)}
                      style={{ ...inputStyle, maxWidth: 200 }} />
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={label}>Notes</div>
                    <input defaultValue={asgn?.notes || ''} onBlur={e => handleField(r.id, r.end_date, 'notes', e.target.value)} style={inputStyle} placeholder="Notes…" />
                  </div>

                  {/* Pet + Paid row */}
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                      <input type="checkbox" checked={asgn?.has_pet || false}
                        onChange={e => handleField(r.id, r.end_date, 'has_pet', e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: '#c0392b', cursor: 'pointer' }} />
                      Pet
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                      <input type="checkbox" checked={asgn?.paid || false}
                        onChange={e => handleField(r.id, r.end_date, 'paid', e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: '#1a5c3a', cursor: 'pointer' }} />
                      Paid
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
