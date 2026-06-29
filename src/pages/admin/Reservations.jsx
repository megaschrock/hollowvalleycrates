import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const card = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }
const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', boxSizing: 'border-box' }
const SOURCE_COLORS = { airbnb: '#FF5A5F', vrbo: '#1C6CB5', direct: '#2C4A2E' }

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function nightsBetween(start, end) {
  if (!start || !end) return '—'
  return Math.round((new Date(end) - new Date(start)) / 86400000)
}

// --- CSV parsers ---
function parseAirbnbCsv(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, i) => row[h] = (cols[i] || '').replace(/"/g, '').trim())
    // Only process Reservation rows, skip Payout and other types
    if (row['type'] !== 'Reservation') return null
    const checkin = parseDate(row['start date'])
    const checkout = parseDate(row['end date'])
    if (!checkin) return null
    return {
      source: 'airbnb',
      start_date: checkin,
      end_date: checkout || checkin,
      guest_name: row['guest'] || '',
      confirmation_code: row['confirmation code'] || '',
      cleaning_fee: parseMoney(row['cleaning fee']),
      pet_fee: parseMoney(row['pet fee']),
      net_payout: parseMoney(row['amount']),
      nights: parseInt(row['nights'] || '0') || null,
    }
  }).filter(Boolean)
}

function parseVrboCsv(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, i) => row[h] = (cols[i] || '').replace(/"/g, '').trim())
    const checkin = parseDate(row['arrival'] || row['check-in'] || row['start date'] || row['checkin'])
    const checkout = parseDate(row['departure'] || row['check-out'] || row['end date'] || row['checkout'])
    if (!checkin) return null
    return {
      source: 'vrbo',
      start_date: checkin,
      end_date: checkout || checkin,
      guest_name: row['guest name'] || row['guest'] || '',
      confirmation_code: row['reservation id'] || row['confirmation'] || '',
      cleaning_fee: parseMoney(row['cleaning fee'] || row['cleaning']),
      pet_fee: parseMoney(row['pet fee'] || row['pet']),
      net_payout: parseMoney(row['owner payout'] || row['net'] || row['payout']),
      nights: parseInt(row['nights'] || '0') || null,
    }
  }).filter(Boolean)
}

function splitCsvLine(line) {
  const result = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') inQ = !inQ
    else if (ch === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += ch
  }
  result.push(cur)
  return result
}

function parseDate(s) {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d)) return null
  return d.toISOString().slice(0, 10)
}

function parseMoney(s) {
  if (!s) return null
  const n = parseFloat(String(s).replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

// --- Main component ---
export default function Reservations() {
  const [tab, setTab] = useState('reservations')
  const [reservations, setReservations] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [csvPreview, setCsvPreview] = useState(null)
  const [csvSource, setCsvSource] = useState('airbnb')
  const [importing, setImporting] = useState(false)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: res }, { data: cl }, { data: asgn }] = await Promise.all([
      supabase.from('reservations').select('*').order('start_date', { ascending: false }),
      supabase.from('cleaners').select('*').order('name'),
      supabase.from('cleaning_assignments').select('*'),
    ])
    setReservations(res || [])
    setCleaners(cl || [])
    setAssignments(asgn || [])
    setLoading(false)
  }

  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result
      const rows = csvSource === 'airbnb' ? parseAirbnbCsv(text) : parseVrboCsv(text)
      setCsvPreview(rows)
    }
    reader.readAsText(file)
  }

  async function importCsv() {
    if (!csvPreview?.length) return
    setImporting(true)
    for (const row of csvPreview) {
      await supabase.from('reservations').upsert(row, { onConflict: 'source,start_date', ignoreDuplicates: false })
    }
    setCsvPreview(null)
    fileRef.current.value = ''
    await load()
    setImporting(false)
  }

  async function updateReservation(id, field, value) {
    setReservations(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
    await supabase.from('reservations').update({ [field]: value }).eq('id', id)
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

  const years = [...new Set(reservations.map(r => new Date(r.start_date).getFullYear()))].sort((a,b)=>b-a)
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear())
  const filteredRes = reservations.filter(r => new Date(r.start_date).getFullYear() === yearFilter)

  if (loading) return <div style={{ color: 'var(--color-muted)', padding: 32 }}>Loading…</div>

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 24 }}>Reservations</h1>

      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--color-border)' }}>
        {['reservations', 'cleaning'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 24px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500,
            color: tab === t ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -1,
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'reservations' && (
        <ReservationsTab
          reservations={filteredRes} years={years} yearFilter={yearFilter} setYearFilter={setYearFilter}
          csvSource={csvSource} setCsvSource={setCsvSource} csvPreview={csvPreview} setCsvPreview={setCsvPreview}
          fileRef={fileRef} onFileChange={onFileChange} importCsv={importCsv} importing={importing}
          updateReservation={updateReservation}
        />
      )}

      {tab === 'cleaning' && (
        <CleaningTab
          reservations={filteredRes} years={years} yearFilter={yearFilter} setYearFilter={setYearFilter}
          cleaners={cleaners} assignments={assignments} updateAssignment={updateAssignment}
          ensureAssignment={ensureAssignment} addCleaner={addCleaner} deleteCleaner={deleteCleaner}
          updateCleaner={updateCleaner}
        />
      )}
    </div>
  )
}

// --- Reservations Tab (desktop-first, wide table) ---
function ReservationsTab({ reservations, years, yearFilter, setYearFilter, csvSource, setCsvSource, csvPreview, setCsvPreview, fileRef, onFileChange, importCsv, importing, updateReservation }) {
  const COLS = ['Source','Check-in','Check-out','Nights','Guest Name','Email','Phone','Gross','Cleaning Fee','Pet Fee','Net (Paid Out)','Conf #']
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {years.map(y => (
          <button key={y} onClick={() => setYearFilter(y)} style={{
            padding: '5px 16px', borderRadius: 999, border: '1px solid var(--color-border)',
            background: yearFilter === y ? 'var(--color-primary)' : 'var(--color-card)',
            color: yearFilter === y ? '#fff' : 'var(--color-text)', fontSize: '0.82rem', cursor: 'pointer',
          }}>{y}</button>
        ))}
      </div>

      {/* CSV Import */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>Import CSV</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={csvSource} onChange={e => setCsvSource(e.target.value)} style={{ ...inputStyle, width: 120 }}>
            <option value="airbnb">Airbnb</option>
            <option value="vrbo">VRBO</option>
          </select>
          <input ref={fileRef} type="file" accept=".csv" onChange={onFileChange} style={{ fontSize: '0.82rem', color: 'var(--color-text)' }} />
          {csvPreview && <>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{csvPreview.length} rows found</span>
            <button onClick={importCsv} disabled={importing} style={{ padding: '6px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem' }}>
              {importing ? 'Importing…' : 'Confirm Import'}
            </button>
            <button onClick={() => { setCsvPreview(null); fileRef.current.value = '' }} style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-muted)' }}>Cancel</button>
          </>}
        </div>
        {csvPreview && (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Source','Check-in','Check-out','Guest','Nights','Gross','Cleaning Fee','Pet Fee','Net','Conf#'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 10px', color: 'var(--color-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '4px 10px' }}><SourceBadge source={r.source} /></td>
                    <td style={{ padding: '4px 10px' }}>{fmtDate(r.start_date)}</td>
                    <td style={{ padding: '4px 10px' }}>{fmtDate(r.end_date)}</td>
                    <td style={{ padding: '4px 10px' }}>{r.guest_name}</td>
                    <td style={{ padding: '4px 10px' }}>{r.nights}</td>
                    <td style={{ padding: '4px 10px' }}>{r.gross_amount != null ? `$${r.gross_amount}` : '—'}</td>
                    <td style={{ padding: '4px 10px' }}>{r.cleaning_fee != null ? `$${r.cleaning_fee}` : '—'}</td>
                    <td style={{ padding: '4px 10px' }}>{r.pet_fee != null ? `$${r.pet_fee}` : '—'}</td>
                    <td style={{ padding: '4px 10px' }}>{r.net_payout != null ? `$${r.net_payout}` : '—'}</td>
                    <td style={{ padding: '4px 10px' }}>{r.confirmation_code}</td>
                  </tr>
                ))}
                {csvPreview.length > 10 && <tr><td colSpan={10} style={{ padding: '4px 10px', color: 'var(--color-muted)' }}>…and {csvPreview.length - 10} more</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reservations.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No reservations for {yearFilter}. iCal sync adds rows automatically, or import a CSV above.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.82rem', whiteSpace: 'nowrap', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-card)', borderBottom: '2px solid var(--color-border)' }}>
                {COLS.map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-muted)', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                  <td style={{ padding: '10px 14px' }}><SourceBadge source={r.source} /></td>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(r.start_date)}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtDate(r.end_date)}</td>
                  <td style={{ padding: '10px 14px' }}>{r.nights ?? nightsBetween(r.start_date, r.end_date)}</td>
                  <EditCell value={r.guest_name} onSave={v => updateReservation(r.id, 'guest_name', v)} width={150} />
                  <EditCell value={r.email} onSave={v => updateReservation(r.id, 'email', v)} width={160} />
                  <EditCell value={r.phone} onSave={v => updateReservation(r.id, 'phone', v)} width={120} />
                  <EditCell value={r.gross_amount} type="number" onSave={v => updateReservation(r.id, 'gross_amount', v ? parseFloat(v) : null)} width={90} prefix="$" />
                  <td style={{ padding: '10px 14px', color: 'var(--color-text)' }}>{r.cleaning_fee != null ? `$${Number(r.cleaning_fee).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text)' }}>{r.pet_fee != null ? `$${Number(r.pet_fee).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text)' }}>{r.net_payout != null ? `$${Number(r.net_payout).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-muted)', fontSize: '0.75rem' }}>{r.confirmation_code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// --- Cleaning Tab (card-based, mobile-friendly) ---
function CleaningTab({ reservations, years, yearFilter, setYearFilter, cleaners, assignments, updateAssignment, ensureAssignment, addCleaner, deleteCleaner, updateCleaner }) {
  const [newCleanerName, setNewCleanerName] = useState('')
  const [showCleaners, setShowCleaners] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  async function handleCleanerChange(reservationId, checkoutDate, cleanerId) {
    const asgn = await ensureAssignment(reservationId, checkoutDate)
    if (asgn) updateAssignment(asgn.id, 'cleaner_id', cleanerId || null)
  }

  async function handleFieldChange(reservationId, checkoutDate, field, value) {
    const asgn = await ensureAssignment(reservationId, checkoutDate)
    if (asgn) updateAssignment(asgn.id, field, value)
  }

  return (
    <>
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

      {reservations.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No reservations for {yearFilter}.</p>
      ) : (() => {
        const upcoming = reservations.filter(r => r.end_date >= today)
        const past = reservations.filter(r => r.end_date < today)
        const visible = showPast ? reservations : upcoming
        return (
        <>
          {past.length > 0 && (
            <button onClick={() => setShowPast(s => !s)} style={{ marginBottom: 16, padding: '7px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-card)', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--color-text)' }}>
              {showPast ? 'Hide past cleaning schedule' : `Show past cleaning schedule (${past.length})`}
            </button>
          )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(r => {
            const asgn = assignments.find(a => a.reservation_id === r.id)
            const nextCheckin = reservations
              .filter(x => x.start_date > r.end_date)
              .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]?.start_date
            const cleaningMin = r.end_date
            const cleaningMax = nextCheckin
              ? new Date(new Date(nextCheckin).getTime() - 86400000).toISOString().slice(0, 10)
              : new Date(new Date(r.end_date).getTime() + 14 * 86400000).toISOString().slice(0, 10)
            return (
              <div key={r.id} style={{ ...card, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <SourceBadge source={r.source} />
                    <span style={{ marginLeft: 10, fontWeight: 500, fontSize: '0.9rem', color: 'var(--color-text)' }}>{r.guest_name || 'Guest'}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                    {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-muted)', marginBottom: 4 }}>Cleaner</div>
                    <select value={asgn?.cleaner_id || ''} onChange={e => handleCleanerChange(r.id, r.end_date, e.target.value)} style={inputStyle}>
                      <option value="">— Assign —</option>
                      {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-muted)', marginBottom: 4 }}>
                      Scheduled Date
                      <span style={{ marginLeft: 6, textTransform: 'none', letterSpacing: 0, fontSize: '0.68rem' }}>
                        ({fmtDate(cleaningMin)} – {fmtDate(cleaningMax)})
                      </span>
                    </div>
                    <input type="date" min={cleaningMin} max={cleaningMax}
                      value={asgn?.scheduled_date || r.end_date || ''}
                      onChange={e => handleFieldChange(r.id, r.end_date, 'scheduled_date', e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-muted)', marginBottom: 4 }}>Notes</div>
                    <input defaultValue={asgn?.notes || ''} onBlur={e => handleFieldChange(r.id, r.end_date, 'notes', e.target.value)} style={inputStyle} placeholder="Notes…" />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                  <input type="checkbox" checked={asgn?.paid || false} onChange={e => handleFieldChange(r.id, r.end_date, 'paid', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#1a5c3a', cursor: 'pointer' }} />
                  Paid
                </label>
              </div>
            )
          })}
        </div>
        </>
        )
      })()}
    </>
  )
}

// --- Shared helpers ---
function SourceBadge({ source }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, background: (SOURCE_COLORS[source] || '#888') + '22', color: SOURCE_COLORS[source] || 'var(--color-muted)', textTransform: 'capitalize' }}>
      {source}
    </span>
  )
}

function EditCell({ value, onSave, type = 'text', width = 130, prefix }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  useEffect(() => { setVal(value ?? '') }, [value])

  function save() {
    setEditing(false)
    if (String(val) !== String(value ?? '')) onSave(val)
  }

  const displayVal = prefix && val !== '' && val != null ? `${prefix}${Number(val).toFixed(2)}` : val

  return (
    <td style={{ padding: '10px 14px' }}>
      {editing ? (
        <input autoFocus type={type} value={val} onChange={e => setVal(e.target.value)} onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false) } }}
          style={{ ...inputStyle, width }} />
      ) : (
        <span onClick={() => setEditing(true)} style={{ display: 'block', minWidth: width, minHeight: 20, cursor: 'text', color: val !== '' && val != null ? 'var(--color-text)' : 'var(--color-muted)', fontStyle: val !== '' && val != null ? 'normal' : 'italic', fontSize: '0.82rem' }}>
          {val !== '' && val != null ? displayVal : 'click to edit'}
        </span>
      )}
    </td>
  )
}
