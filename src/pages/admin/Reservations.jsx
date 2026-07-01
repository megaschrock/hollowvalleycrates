import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const card = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }
const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', boxSizing: 'border-box' }
const SOURCE_COLORS = { airbnb: '#FF5A5F', vrbo: '#1C6CB5', direct: '#2C4A2E', website: '#2C4A2E' }

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function yearOf(dateStr) {
  return new Date(dateStr + 'T12:00:00').getFullYear()
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
    const checkin = parseDate(row['check-in'] || row['arrival'] || row['start date'] || row['checkin'])
    const checkout = parseDate(row['check-out'] || row['departure'] || row['end date'] || row['checkout'])
    if (!checkin) return null
    if (row['status'] && row['status'].toLowerCase() !== 'booked') return null
    return {
      source: 'vrbo',
      start_date: checkin,
      end_date: checkout || checkin,
      guest_name: row['inquirer'] || row['guest name'] || row['guest'] || '',
      email: row['email'] || '',
      phone: row['phone'] || '',
      confirmation_code: row['reservation id'] || row['confirmation'] || '',
      cleaning_fee: parseMoney(row['cleaning fee'] || row['cleaning']),
      pet_fee: parseMoney(row['pet fee'] || row['pet']),
      net_payout: parseMoney(row['owner payout'] || row['net'] || row['payout']),
      nights: parseInt(row['nights stay'] || row['nights'] || '0') || null,
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
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
  const d = new Date(s)
  if (isNaN(d)) return null
  return d.toISOString().slice(0, 10)
}

function parseMoney(s) {
  if (!s) return null
  const n = parseFloat(String(s).replace(/[$,(]/g, '').replace(/\)/g, ''))
  return isNaN(n) ? null : n
}

function parseVrboDepositCsv(text) {
  const lines = text.trim().split('\n')
  const grouped = {}
  for (const line of lines) {
    const cols = splitCsvLine(line)
    const confCode = (cols[8] || '').replace(/"/g, '').trim()
    if (!confCode || !confCode.startsWith('HA-')) continue
    const payout = parseMoney(cols[11])
    if (payout == null) continue
    if (!grouped[confCode]) {
      grouped[confCode] = {
        confirmation_code: confCode,
        guest_name: [cols[9], cols[10]].map(s => s.replace(/"/g, '').trim()).filter(Boolean).join(' '),
        net_payout: 0,
      }
    }
    grouped[confCode].net_payout += payout
  }
  return Object.values(grouped).map(r => ({ ...r, net_payout: Math.round(r.net_payout * 100) / 100 }))
}

const BLANK_FORM = { source: 'website', start_date: '', end_date: '', nights: '', guest_name: '', email: '', phone: '', gross_amount: '', cleaning_fee: '', pet_fee: '', discount: '', host_fee: '', net_payout: '', confirmation_code: '', entered_in_dda: false }

// --- Main component ---
export default function Reservations() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [csvPreview, setCsvPreview] = useState(null)
  const [csvSource, setCsvSource] = useState('airbnb')
  const [importing, setImporting] = useState(false)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [showAddForm, setShowAddForm] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [addForm, setAddForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: res } = await supabase.from('reservations').select('*').order('start_date', { ascending: false })
    setReservations(res || [])
    setLoading(false)
  }

  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result
      const rows = csvSource === 'airbnb' ? parseAirbnbCsv(text)
        : csvSource === 'vrbo-deposits' ? parseVrboDepositCsv(text)
        : parseVrboCsv(text)
      setCsvPreview(rows)
    }
    reader.readAsText(file)
  }

  async function importCsv() {
    if (!csvPreview?.length) return
    setImporting(true)
    if (csvSource === 'vrbo-deposits') {
      for (const row of csvPreview) {
        await supabase.from('reservations').update({ net_payout: row.net_payout }).eq('confirmation_code', row.confirmation_code)
      }
    } else {
      for (const row of csvPreview) {
        await supabase.from('reservations').upsert(row, { onConflict: 'source,start_date', ignoreDuplicates: false })
      }
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

  async function deleteReservation(id) {
    await supabase.from('reservations').delete().eq('id', id)
    setReservations(rs => rs.filter(r => r.id !== id))
  }

  async function addReservation() {
    if (!addForm.start_date) return
    setSaving(true)
    const payload = {
      source: addForm.source || 'website',
      start_date: addForm.start_date,
      end_date: addForm.end_date || addForm.start_date,
      nights: addForm.nights ? parseInt(addForm.nights) : null,
      guest_name: addForm.guest_name || null,
      email: addForm.email || null,
      phone: addForm.phone || null,
      gross_amount: addForm.gross_amount ? parseFloat(addForm.gross_amount) : null,
      cleaning_fee: addForm.cleaning_fee ? parseFloat(addForm.cleaning_fee) : null,
      pet_fee: addForm.pet_fee ? parseFloat(addForm.pet_fee) : null,
      discount: addForm.discount ? parseFloat(addForm.discount) : 0,
      host_fee: addForm.host_fee ? parseFloat(addForm.host_fee) : 0,
      net_payout: addForm.net_payout ? parseFloat(addForm.net_payout) : null,
      confirmation_code: addForm.confirmation_code || null,
      entered_in_dda: addForm.entered_in_dda || false,
    }
    const { data } = await supabase.from('reservations').insert(payload).select().single()
    if (data) setReservations(rs => [data, ...rs])
    setAddForm(BLANK_FORM)
    setShowAddForm(false)
    setSaving(false)
  }

  const years = [...new Set(reservations.map(r => yearOf(r.start_date)))].sort((a,b)=>b-a)
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear())
  const filteredRes = reservations.filter(r => yearOf(r.start_date) === yearFilter)

  if (loading) return <div style={{ color: 'var(--color-muted)', padding: 32 }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', margin: 0 }}>Reservations</h1>
        <button
          onClick={() => setShowAddForm(v => !v)}
          style={{ padding: '9px 20px', background: showAddForm ? 'var(--color-border)' : 'var(--color-primary)', color: showAddForm ? 'var(--color-text)' : '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
        >
          {showAddForm ? 'Cancel' : '+ Add Reservation'}
        </button>
      </div>

      {/* Add Reservation Form */}
      {showAddForm && (
        <div style={{ ...card, marginBottom: 24, background: 'rgba(44,74,46,0.03)', borderColor: 'rgba(44,74,46,0.2)' }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 16 }}>New Reservation</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              Source
              <select value={addForm.source} onChange={e => setAddForm(f => ({ ...f, source: e.target.value }))} style={inputStyle}>
                <option value="website">Website / Direct</option>
                <option value="airbnb">Airbnb</option>
                <option value="vrbo">VRBO</option>
              </select>
            </label>
            {[
              ['Check-in *', 'start_date', 'date'],
              ['Check-out', 'end_date', 'date'],
              ['Nights', 'nights', 'number'],
              ['Guest Name', 'guest_name', 'text'],
              ['Email', 'email', 'email'],
              ['Phone', 'phone', 'text'],
              ['Gross Amount ($)', 'gross_amount', 'number'],
              ['Cleaning Fee ($)', 'cleaning_fee', 'number'],
              ['Pet Fee ($)', 'pet_fee', 'number'],
              ['Discount ($)', 'discount', 'number'],
              ['Host Fee ($)', 'host_fee', 'number'],
              ['Net Payout ($)', 'net_payout', 'number'],
              ['Conf #', 'confirmation_code', 'text'],
            ].map(([label, field, type]) => (
              <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                {label}
                <input
                  type={type}
                  value={addForm[field]}
                  onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))}
                  style={inputStyle}
                  step={type === 'number' ? '0.01' : undefined}
                />
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              Entered in DDA
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                <input type="checkbox" checked={addForm.entered_in_dda} onChange={e => setAddForm(f => ({ ...f, entered_in_dda: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text)' }}>Yes</span>
              </div>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowAddForm(false); setAddForm(BLANK_FORM) }} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--color-muted)' }}>Cancel</button>
            <button onClick={addReservation} disabled={saving || !addForm.start_date} style={{ padding: '8px 20px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 600, cursor: saving || !addForm.start_date ? 'default' : 'pointer', opacity: !addForm.start_date ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save Reservation'}
            </button>
          </div>
        </div>
      )}

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Import CSV</div>
          <button onClick={() => setShowCsvImport(s => !s)} style={{ fontSize: '0.78rem', color: 'var(--color-muted)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer' }}>
            {showCsvImport ? 'Hide ▲' : 'Expand ▼'}
          </button>
        </div>
        {showCsvImport && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={csvSource} onChange={e => { setCsvSource(e.target.value); setCsvPreview(null); if (fileRef.current) fileRef.current.value = '' }} style={{ ...inputStyle, width: 200 }}>
                <option value="airbnb">Airbnb — Reservations</option>
                <option value="vrbo">VRBO — Reservations</option>
                <option value="vrbo-deposits">VRBO — Deposit Report</option>
              </select>
              <a href={
                csvSource === 'airbnb' ? 'https://www.airbnb.com/earnings/512863776/paid' :
                csvSource === 'vrbo-deposits' ? 'https://www.vrbo.com/supply/financial-reporting?tab=bank-deposits' :
                'https://www.vrbo.com/p/calendar/321.3384796.3957924/rail/downloadBookingDetails'
              } target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--color-primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Get this report →
              </a>
              <input ref={fileRef} type="file" accept=".csv" onChange={onFileChange} style={{ fontSize: '0.82rem', color: 'var(--color-text)' }} />
              {csvPreview && <>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{csvPreview.length} rows found</span>
                <button onClick={importCsv} disabled={importing} style={{ padding: '6px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem' }}>
                  {importing ? 'Importing…' : 'Confirm Import'}
                </button>
                <button onClick={() => { setCsvPreview(null); fileRef.current.value = '' }} style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-muted)' }}>Cancel</button>
              </>}
            </div>
            {csvPreview && csvSource === 'vrbo-deposits' && (
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}>{['Conf #','Guest','Net Payout'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 10px', color: 'var(--color-muted)', fontWeight: 500 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {csvPreview.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '4px 10px' }}>{r.confirmation_code}</td>
                        <td style={{ padding: '4px 10px' }}>{r.guest_name}</td>
                        <td style={{ padding: '4px 10px' }}>{r.net_payout != null ? `$${r.net_payout.toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                    {csvPreview.length > 10 && <tr><td colSpan={3} style={{ padding: '4px 10px', color: 'var(--color-muted)' }}>…and {csvPreview.length - 10} more</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {csvPreview && csvSource !== 'vrbo-deposits' && (
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}>{['Source','Check-in','Check-out','Guest','Nights','Cleaning Fee','Pet Fee','Net','Conf#'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 10px', color: 'var(--color-muted)', fontWeight: 500 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {csvPreview.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '4px 10px' }}><SourceBadge source={r.source} /></td>
                        <td style={{ padding: '4px 10px' }}>{fmtDate(r.start_date)}</td>
                        <td style={{ padding: '4px 10px' }}>{fmtDate(r.end_date)}</td>
                        <td style={{ padding: '4px 10px' }}>{r.guest_name}</td>
                        <td style={{ padding: '4px 10px' }}>{r.nights}</td>
                        <td style={{ padding: '4px 10px' }}>{r.cleaning_fee != null ? `$${r.cleaning_fee}` : '—'}</td>
                        <td style={{ padding: '4px 10px' }}>{r.pet_fee != null ? `$${r.pet_fee}` : '—'}</td>
                        <td style={{ padding: '4px 10px' }}>{r.net_payout != null ? `$${r.net_payout}` : '—'}</td>
                        <td style={{ padding: '4px 10px' }}>{r.confirmation_code}</td>
                      </tr>
                    ))}
                    {csvPreview.length > 10 && <tr><td colSpan={9} style={{ padding: '4px 10px', color: 'var(--color-muted)' }}>…and {csvPreview.length - 10} more</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .res-table-wrap { display: block; }
        .res-mobile-list { display: none; }
        @media (max-width: 768px) {
          .res-table-wrap { display: none; }
          .res-mobile-list { display: flex; flex-direction: column; gap: 10px; }
        }
      `}</style>

      {filteredRes.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No reservations for {yearFilter}.</p>
      ) : (
        <>
          <div className="res-table-wrap" style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.82rem', whiteSpace: 'nowrap', width: '100%' }}>
              <thead>
                <tr style={{ background: 'var(--color-card)', borderBottom: '2px solid var(--color-border)' }}>
                  {['Source','Check-in','Check-out','Nights','Guest','Email','Phone','Gross','Cleaning','Pet','Discount','Host Fee','Net Payout','DDA','Conf #',''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-muted)', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRes.map((r, idx) => (
                  <ReservationRow key={r.id} r={r} idx={idx} onUpdate={updateReservation} onDelete={deleteReservation} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="res-mobile-list">
            {filteredRes.map(r => (
              <ReservationCard key={r.id} r={r} onUpdate={updateReservation} onDelete={deleteReservation} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ReservationRow({ r, idx, onUpdate, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(r.id)
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
      <td style={{ padding: '10px 14px' }}><SourceBadge source={r.source} /></td>
      <td style={{ padding: '10px 14px' }}>{fmtDate(r.start_date)}</td>
      <td style={{ padding: '10px 14px' }}>{fmtDate(r.end_date)}</td>
      <td style={{ padding: '10px 14px' }}>{r.nights ?? nightsBetween(r.start_date, r.end_date)}</td>
      <EditCell value={r.guest_name} onSave={v => onUpdate(r.id, 'guest_name', v)} width={140} />
      <EditCell value={r.email} onSave={v => onUpdate(r.id, 'email', v)} width={150} />
      <EditCell value={r.phone} onSave={v => onUpdate(r.id, 'phone', v)} width={110} />
      <EditCell value={r.gross_amount} type="number" onSave={v => onUpdate(r.id, 'gross_amount', v ? parseFloat(v) : null)} width={80} prefix="$" />
      <EditCell value={r.cleaning_fee} type="number" onSave={v => onUpdate(r.id, 'cleaning_fee', v ? parseFloat(v) : null)} width={80} prefix="$" />
      <EditCell value={r.pet_fee} type="number" onSave={v => onUpdate(r.id, 'pet_fee', v ? parseFloat(v) : null)} width={70} prefix="$" />
      <EditCell value={r.discount} type="number" onSave={v => onUpdate(r.id, 'discount', v ? parseFloat(v) : 0)} width={70} prefix="$" />
      <EditCell value={r.host_fee} type="number" onSave={v => onUpdate(r.id, 'host_fee', v ? parseFloat(v) : 0)} width={70} prefix="$" />
      <EditCell value={r.net_payout} type="number" onSave={v => onUpdate(r.id, 'net_payout', v ? parseFloat(v) : null)} width={90} prefix="$" />
      <td style={{ padding: '10px 14px' }}>
        <input type="checkbox" checked={!!r.entered_in_dda} onChange={e => onUpdate(r.id, 'entered_in_dda', e.target.checked)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
      </td>
      <td style={{ padding: '10px 14px', color: 'var(--color-muted)', fontSize: '0.75rem' }}>{r.confirmation_code || '—'}</td>
      <td style={{ padding: '8px 10px' }}>
        {confirming ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleDelete} disabled={deleting} style={{ padding: '4px 10px', background: '#a33', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {deleting ? '…' : 'Delete'}
            </button>
            <button onClick={() => setConfirming(false)} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--color-muted)' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} title="Delete" style={{ padding: '4px 8px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        )}
      </td>
    </tr>
  )
}

function SourceBadge({ source }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, background: (SOURCE_COLORS[source] || '#888') + '22', color: SOURCE_COLORS[source] || 'var(--color-muted)', textTransform: 'capitalize' }}>
      {source}
    </span>
  )
}

function ReservationCard({ r, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const nights = r.nights ?? nightsBetween(r.start_date, r.end_date)

  return (
    <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '12px 14px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <SourceBadge source={r.source} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.guest_name || '—'}</span>
          {r.net_payout != null && <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--color-primary)', flexShrink: 0 }}>${Math.round(r.net_payout).toLocaleString()}</span>}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
          {fmtDate(r.start_date)} → {fmtDate(r.end_date)} · {nights} nights
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', display: 'grid', gap: 10 }}>
          {[
            ['Guest Name', 'guest_name', 'text'],
            ['Email', 'email', 'email'],
            ['Phone', 'phone', 'text'],
            ['Gross ($)', 'gross_amount', 'number'],
            ['Cleaning Fee ($)', 'cleaning_fee', 'number'],
            ['Pet Fee ($)', 'pet_fee', 'number'],
            ['Discount ($)', 'discount', 'number'],
            ['Host Fee ($)', 'host_fee', 'number'],
            ['Net Payout ($)', 'net_payout', 'number'],
            ['Conf #', 'confirmation_code', 'text'],
          ].map(([lbl, field, type]) => (
            <CardEditField key={field} label={lbl} value={r[field]} type={type}
              onSave={v => onUpdate(r.id, field, type === 'number' ? (v !== '' && v != null ? parseFloat(v) : null) : v || null)} />
          ))}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: 'var(--color-text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!r.entered_in_dda} onChange={e => onUpdate(r.id, 'entered_in_dda', e.target.checked)} style={{ width: 16, height: 16 }} />
            Entered in DDA
          </label>
          <div>
            {confirming ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onDelete(r.id)} style={{ padding: '6px 12px', background: '#a33', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer' }}>Confirm Delete</button>
                <button onClick={() => setConfirming(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--color-muted)' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} style={{ padding: '6px 12px', background: 'none', border: '1px solid #c0392b', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', color: '#c0392b' }}>Delete</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CardEditField({ label, value, type, onSave }) {
  const [val, setVal] = useState(value ?? '')
  useEffect(() => { setVal(value ?? '') }, [value])
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.75rem', color: 'var(--color-muted)' }}>
      {label}
      <input
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { if (String(val) !== String(value ?? '')) onSave(val) }}
        style={{ ...inputStyle, padding: '7px 8px', fontSize: '0.82rem' }}
        step={type === 'number' ? '0.01' : undefined}
      />
    </label>
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
