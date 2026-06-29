import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const card = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }
const label = { fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 4, display: 'block' }
const input = { width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', boxSizing: 'border-box' }
const SOURCE_COLORS = { airbnb: '#FF5A5F', vrbo: '#1C6CB5', direct: '#2C4A2E' }

// --- CSV parsers ---
function parseAirbnbCsv(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, i) => row[h] = (cols[i] || '').replace(/"/g, '').trim())
    const checkin = parseDate(row['start date'] || row['check-in'] || row['checkin'])
    const checkout = parseDate(row['end date'] || row['check-out'] || row['checkout'])
    if (!checkin) return null
    return {
      source: 'airbnb',
      start_date: checkin,
      end_date: checkout || checkin,
      guest_name: row['guest'] || row['guest name'] || '',
      confirmation_code: row['confirmation code'] || row['reservation code'] || '',
      gross_amount: parseFloat(row['amount'] || row['total'] || row['gross earnings'] || '0') || null,
      host_fee: parseFloat(row['host fee'] || row['service fee'] || '0') || null,
      net_payout: parseFloat(row['net'] || row['payout'] || row['you earn'] || '0') || null,
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
      gross_amount: parseFloat(row['rental amount'] || row['gross'] || row['total'] || '0') || null,
      host_fee: parseFloat(row['pm commission'] || row['host fee'] || '0') || null,
      net_payout: parseFloat(row['owner payout'] || row['net'] || '0') || null,
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

  // CSV handling
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

  // Inline edit reservation
  async function updateReservation(id, field, value) {
    setReservations(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
    await supabase.from('reservations').update({ [field]: value }).eq('id', id)
  }

  // Cleaning
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

  // Cleaners management
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
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 24 }}>Reservations</h1>

      {/* Tabs */}
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
          reservations={filteredRes}
          years={years}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          csvSource={csvSource}
          setCsvSource={setCsvSource}
          csvPreview={csvPreview}
          setCsvPreview={setCsvPreview}
          fileRef={fileRef}
          onFileChange={onFileChange}
          importCsv={importCsv}
          importing={importing}
          updateReservation={updateReservation}
        />
      )}

      {tab === 'cleaning' && (
        <CleaningTab
          reservations={filteredRes}
          years={years}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          cleaners={cleaners}
          assignments={assignments}
          updateAssignment={updateAssignment}
          ensureAssignment={ensureAssignment}
          addCleaner={addCleaner}
          deleteCleaner={deleteCleaner}
          updateCleaner={updateCleaner}
        />
      )}
    </div>
  )
}

// --- Reservations Tab ---
function ReservationsTab({ reservations, years, yearFilter, setYearFilter, csvSource, setCsvSource, csvPreview, setCsvPreview, fileRef, onFileChange, importCsv, importing, updateReservation }) {
  return (
    <>
      {/* Year filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {years.map(y => (
          <button key={y} onClick={() => setYearFilter(y)} style={{
            padding: '5px 16px', borderRadius: 999, border: '1px solid var(--color-border)',
            background: yearFilter === y ? 'var(--color-primary)' : 'var(--color-card)',
            color: yearFilter === y ? '#fff' : 'var(--color-text)',
            fontSize: '0.82rem', cursor: 'pointer',
          }}>{y}</button>
        ))}
      </div>

      {/* CSV Import */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>Import CSV</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={csvSource} onChange={e => setCsvSource(e.target.value)} style={{ ...input, width: 120 }}>
            <option value="airbnb">Airbnb</option>
            <option value="vrbo">VRBO</option>
          </select>
          <input ref={fileRef} type="file" accept=".csv" onChange={onFileChange} style={{ fontSize: '0.82rem', color: 'var(--color-text)' }} />
          {csvPreview && (
            <>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{csvPreview.length} rows found</span>
              <button onClick={importCsv} disabled={importing} style={{ padding: '6px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem' }}>
                {importing ? 'Importing…' : 'Confirm Import'}
              </button>
              <button onClick={() => { setCsvPreview(null); fileRef.current.value = '' }} style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-muted)' }}>Cancel</button>
            </>
          )}
        </div>
        {csvPreview && (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Source','Check-in','Check-out','Guest','Nights','Gross','Fee','Net','Conf#'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '4px 8px' }}><SourceBadge source={r.source} /></td>
                    <td style={{ padding: '4px 8px' }}>{r.start_date}</td>
                    <td style={{ padding: '4px 8px' }}>{r.end_date}</td>
                    <td style={{ padding: '4px 8px' }}>{r.guest_name}</td>
                    <td style={{ padding: '4px 8px' }}>{r.nights}</td>
                    <td style={{ padding: '4px 8px' }}>{r.gross_amount ? `$${r.gross_amount}` : '—'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.host_fee ? `$${r.host_fee}` : '—'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.net_payout ? `$${r.net_payout}` : '—'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.confirmation_code}</td>
                  </tr>
                ))}
                {csvPreview.length > 10 && <tr><td colSpan={9} style={{ padding: '4px 8px', color: 'var(--color-muted)' }}>…and {csvPreview.length - 10} more</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reservations table */}
      {reservations.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No reservations for {yearFilter}. iCal sync will add rows automatically, or import a CSV above.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Source','Check-in','Check-out','Nights','Guest Name','Email','Phone','Adults','Children','Pets','Gross','Net','Conf#','Notes'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--color-muted)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 10px' }}><SourceBadge source={r.source} /></td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.start_date}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.end_date}</td>
                  <td style={{ padding: '8px 10px' }}>{r.nights ?? nightsBetween(r.start_date, r.end_date)}</td>
                  <EditCell value={r.guest_name} onSave={v => updateReservation(r.id, 'guest_name', v)} />
                  <EditCell value={r.email} onSave={v => updateReservation(r.id, 'email', v)} />
                  <EditCell value={r.phone} onSave={v => updateReservation(r.id, 'phone', v)} />
                  <EditCell value={r.adults} type="number" width={50} onSave={v => updateReservation(r.id, 'adults', v ? parseInt(v) : null)} />
                  <EditCell value={r.children} type="number" width={50} onSave={v => updateReservation(r.id, 'children', v ? parseInt(v) : null)} />
                  <EditCell value={r.pets} type="number" width={50} onSave={v => updateReservation(r.id, 'pets', v ? parseInt(v) : null)} />
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.gross_amount ? `$${Number(r.gross_amount).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.net_payout ? `$${Number(r.net_payout).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--color-muted)' }}>{r.confirmation_code || '—'}</td>
                  <EditCell value={r.notes} onSave={v => updateReservation(r.id, 'notes', v)} wide />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// --- Cleaning Tab ---
function CleaningTab({ reservations, years, yearFilter, setYearFilter, cleaners, assignments, updateAssignment, ensureAssignment, addCleaner, deleteCleaner, updateCleaner }) {
  const [newCleanerName, setNewCleanerName] = useState('')
  const [showCleaners, setShowCleaners] = useState(false)

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
      {/* Year filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {years.map(y => (
          <button key={y} onClick={() => setYearFilter(y)} style={{
            padding: '5px 16px', borderRadius: 999, border: '1px solid var(--color-border)',
            background: yearFilter === y ? 'var(--color-primary)' : 'var(--color-card)',
            color: yearFilter === y ? '#fff' : 'var(--color-text)',
            fontSize: '0.82rem', cursor: 'pointer',
          }}>{y}</button>
        ))}
        <button onClick={() => setShowCleaners(s => !s)} style={{ marginLeft: 'auto', padding: '5px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-card)', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--color-text)' }}>
          {showCleaners ? 'Hide' : 'Manage'} Cleaners
        </button>
      </div>

      {/* Cleaners management */}
      {showCleaners && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>Cleaners</div>
          {cleaners.map(c => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input defaultValue={c.name} onBlur={e => updateCleaner(c.id, 'name', e.target.value)} style={input} placeholder="Name" />
              <input defaultValue={c.email} onBlur={e => updateCleaner(c.id, 'email', e.target.value)} style={input} placeholder="Email" />
              <input defaultValue={c.phone} onBlur={e => updateCleaner(c.id, 'phone', e.target.value)} style={input} placeholder="Phone" />
              <button onClick={() => deleteCleaner(c.id)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '0.82rem' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={newCleanerName} onChange={e => setNewCleanerName(e.target.value)} placeholder="New cleaner name" style={{ ...input, width: 200 }} onKeyDown={e => { if (e.key === 'Enter' && newCleanerName.trim()) { addCleaner(newCleanerName.trim()); setNewCleanerName('') } }} />
            <button onClick={() => { if (newCleanerName.trim()) { addCleaner(newCleanerName.trim()); setNewCleanerName('') } }} style={{ padding: '6px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem' }}>Add</button>
          </div>
        </div>
      )}

      {/* Cleaning table */}
      {reservations.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No reservations for {yearFilter}.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Source','Guest','Check-in','Check-out','Cleaner','Scheduled Date','Notes','Done','Paid'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--color-muted)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => {
                const asgn = assignments.find(a => a.reservation_id === r.id)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 10px' }}><SourceBadge source={r.source} /></td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.guest_name || '—'}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.start_date}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.end_date}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <select
                        value={asgn?.cleaner_id || ''}
                        onChange={e => handleCleanerChange(r.id, r.end_date, e.target.value)}
                        style={{ ...input, width: 140 }}
                      >
                        <option value="">— Assign —</option>
                        {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="date"
                        value={asgn?.scheduled_date || r.end_date || ''}
                        onChange={e => handleFieldChange(r.id, r.end_date, 'scheduled_date', e.target.value)}
                        style={{ ...input, width: 130 }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        defaultValue={asgn?.notes || ''}
                        onBlur={e => handleFieldChange(r.id, r.end_date, 'notes', e.target.value)}
                        style={{ ...input, width: 160 }}
                        placeholder="Notes…"
                      />
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={asgn?.done || false}
                        onChange={e => handleFieldChange(r.id, r.end_date, 'done', e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={asgn?.paid || false}
                        onChange={e => handleFieldChange(r.id, r.end_date, 'paid', e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1a5c3a' }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// --- Shared helpers ---
function SourceBadge({ source }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, background: SOURCE_COLORS[source] + '22', color: SOURCE_COLORS[source] || 'var(--color-muted)', textTransform: 'capitalize' }}>
      {source}
    </span>
  )
}

function EditCell({ value, onSave, type = 'text', width, wide }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  useEffect(() => { setVal(value ?? '') }, [value])

  function save() {
    setEditing(false)
    if (String(val) !== String(value ?? '')) onSave(val)
  }

  return (
    <td style={{ padding: '8px 10px' }}>
      {editing ? (
        <input
          autoFocus
          type={type}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false) } }}
          style={{ ...input, width: width || (wide ? 200 : 120) }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{ display: 'block', minWidth: width || (wide ? 200 : 100), minHeight: 20, cursor: 'text', color: val ? 'var(--color-text)' : 'var(--color-muted)', fontStyle: val ? 'normal' : 'italic', fontSize: '0.82rem' }}
        >
          {val || 'click to edit'}
        </span>
      )}
    </td>
  )
}

function nightsBetween(start, end) {
  if (!start || !end) return '—'
  return Math.round((new Date(end) - new Date(start)) / 86400000)
}
