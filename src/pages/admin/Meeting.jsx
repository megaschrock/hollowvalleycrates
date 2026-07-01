import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import MeetingMetrics from './MeetingMetrics'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STEPS = [
  { letter: 'A', label: 'Personal Updates' },
  { letter: 'B', label: 'Monthly Metrics' },
  { letter: 'C', label: 'Objectives' },
  { letter: 'D', label: 'Open To-Dos' },
  { letter: 'E', label: 'Talking Points' },
  { letter: 'F', label: 'To-Do Review' },
]

function monthOf(s) { return new Date(s + 'T12:00:00').getMonth() }
function yearOf(s) { return new Date(s + 'T12:00:00').getFullYear() }
function fmt$(n) { return n != null && !isNaN(n) ? '$' + Math.round(n).toLocaleString() : '—' }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function nightsOf(arr) { return arr.reduce((s, r) => s + (r.nights || 0), 0) }
function revenueOf(arr) { return arr.filter(r => r.net_payout != null).reduce((s, r) => s + r.net_payout, 0) }
function oneMonthOut(meetingDate) {
  const d = new Date(meetingDate + 'T12:00:00')
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

const inp = { width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', background: '#fff', color: 'var(--color-text)', boxSizing: 'border-box' }
const addBtn = { padding: '9px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }
const delBtn = { padding: '4px 9px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }
function smallBtn(color, bg) { return { padding: '5px 12px', background: bg, color, border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' } }

export default function Meeting() {
  const { id } = useParams()

  const [meeting, setMeeting] = useState(null)
  const [step, setStep] = useState(0)
  const [objectives, setObjectives] = useState([])
  const [openTodos, setOpenTodos] = useState([])
  const [talkingPoints, setTalkingPoints] = useState([])
  const [meetingTodos, setMeetingTodos] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)

  // Quick "add talking point" input used on steps A–D
  const [quickTP, setQuickTP] = useState('')

  // Talking points step: note-taking per TP
  const [tpNotes, setTpNotes] = useState({})

  // To-do form on the talking points step
  const [newTodo, setNewTodo] = useState({ title: '', assigned_to: '', due_date: '' })

  const [ending, setEnding] = useState(false)

  useEffect(() => {
    async function load() {
      const [
        { data: mtg },
        { data: objs },
        { data: tps },
        { data: mTodos },
        { data: res },
        { data: allOpen },
      ] = await Promise.all([
        supabase.from('meetings').select('*').eq('id', id).single(),
        supabase.from('objectives').select('*').eq('archived', false).order('sort_order').order('created_at', { ascending: false }),
        supabase.from('meeting_talking_points').select('*').eq('meeting_id', id).order('sort_order').order('created_at'),
        supabase.from('meeting_todos').select('*').eq('created_meeting_id', id).order('created_at'),
        supabase.from('reservations').select('*'),
        supabase.from('meeting_todos').select('*').eq('completed', false).order('created_at'),
      ])
      setMeeting(mtg)
      setObjectives(objs || [])
      setTalkingPoints(tps || [])
      setMeetingTodos(mTodos || [])
      setReservations(res || [])
      setOpenTodos((allOpen || []).filter(t => t.created_meeting_id !== id))
      if (mtg?.meeting_date) {
        setNewTodo({ title: '', assigned_to: '', due_date: oneMonthOut(mtg.meeting_date) })
      }
      setLoading(false)
    }
    load()
  }, [id])

  // ── Metrics ──────────────────────────────────────────────────────────────
  const now = new Date()
  const cm = now.getMonth()
  const cy = now.getFullYear()

  const thisMonth = reservations.filter(r => yearOf(r.start_date) === cy && monthOf(r.start_date) === cm)
  const lyMonth   = reservations.filter(r => yearOf(r.start_date) === cy - 1 && monthOf(r.start_date) === cm)
  const ytd       = reservations.filter(r => yearOf(r.start_date) === cy && monthOf(r.start_date) <= cm)
  const ytdLY     = reservations.filter(r => yearOf(r.start_date) === cy - 1 && monthOf(r.start_date) <= cm)

  const tmNights  = nightsOf(thisMonth)
  const lyNights  = nightsOf(lyMonth)
  const tmRev     = revenueOf(thisMonth)
  const lyRev     = revenueOf(lyMonth)
  const tmOcc     = Math.round((tmNights / daysInMonth(cy, cm)) * 100)
  const lyOcc     = Math.round((lyNights / daysInMonth(cy - 1, cm)) * 100)
  const tmADR     = tmNights > 0 ? Math.round(tmRev / tmNights) : null
  const ytdNights = nightsOf(ytd)
  const ytdNightsLY = nightsOf(ytdLY)
  const ytdRev    = revenueOf(ytd)
  const ytdRevLY  = revenueOf(ytdLY)

  const metrics = [
    { name: 'Nights Sold',    value: tmNights,  prior: lyNights,    fmt: n => String(n) },
    { name: 'Cash Flow',      value: tmRev,     prior: lyRev,       fmt: fmt$ },
    { name: 'Occupancy',      value: tmOcc,     prior: lyOcc,       fmt: n => `${n}%` },
    { name: 'Avg Daily Rate', value: tmADR,     prior: null,        fmt: fmt$ },
    { name: 'YTD Nights',     value: ytdNights, prior: ytdNightsLY, fmt: n => String(n) },
    { name: 'YTD Cash Flow',  value: ytdRev,    prior: ytdRevLY,    fmt: fmt$ },
  ]

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function addQuickTP(sourceLabel) {
    if (!quickTP.trim()) return
    const { data: tp } = await supabase.from('meeting_talking_points').insert({
      meeting_id: id,
      content: quickTP.trim(),
      source_type: 'flagged',
      source_label: sourceLabel,
      resolved: false,
      sort_order: talkingPoints.length,
    }).select().single()
    setTalkingPoints(prev => [...prev, tp])
    setQuickTP('')
  }

  async function addManualTP(text) {
    if (!text.trim()) return
    const { data: tp } = await supabase.from('meeting_talking_points').insert({
      meeting_id: id,
      content: text.trim(),
      source_type: 'manual',
      sort_order: talkingPoints.length,
    }).select().single()
    setTalkingPoints(prev => [...prev, tp])
  }

  async function saveTPNotes(tpId) {
    const notes = tpNotes[tpId] ?? talkingPoints.find(t => t.id === tpId)?.notes ?? ''
    await supabase.from('meeting_talking_points').update({ notes }).eq('id', tpId)
    setTalkingPoints(prev => prev.map(tp => tp.id === tpId ? { ...tp, notes } : tp))
  }

  async function resolveTP(tpId) {
    await supabase.from('meeting_talking_points').update({ resolved: true }).eq('id', tpId)
    setTalkingPoints(prev => prev.map(tp => tp.id === tpId ? { ...tp, resolved: true } : tp))
  }

  async function deleteTP(tpId) {
    await supabase.from('meeting_talking_points').delete().eq('id', tpId)
    setTalkingPoints(prev => prev.filter(tp => tp.id !== tpId))
  }

  async function updateObjStatus(objId, status) {
    await supabase.from('objectives').update({ status }).eq('id', objId)
    setObjectives(prev => prev.map(o => o.id === objId ? { ...o, status } : o))
  }

  async function completeTodo(todoId) {
    await supabase.from('meeting_todos').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', todoId)
    setOpenTodos(prev => prev.filter(t => t.id !== todoId))
  }

  async function addMeetingTodo() {
    if (!newTodo.title.trim()) return
    const { data: td } = await supabase.from('meeting_todos').insert({
      title: newTodo.title.trim(),
      assigned_to: newTodo.assigned_to.trim(),
      due_date: newTodo.due_date || null,
      created_meeting_id: id,
    }).select().single()
    setMeetingTodos(prev => [...prev, td])
    setNewTodo({ title: '', assigned_to: '', due_date: oneMonthOut(meeting.meeting_date) })
  }

  async function removeMeetingTodo(todoId) {
    await supabase.from('meeting_todos').delete().eq('id', todoId)
    setMeetingTodos(prev => prev.filter(t => t.id !== todoId))
  }

  async function endMeeting() {
    setEnding(true)
    await supabase.from('meetings').update({ status: 'completed' }).eq('id', id)
    setMeeting(prev => ({ ...prev, status: 'completed' }))
    setEnding(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 32, color: 'var(--color-muted)' }}>Loading meeting…</div>
  if (!meeting) return <div style={{ padding: 32, color: 'var(--color-muted)' }}>Meeting not found.</div>

  const done = meeting.status === 'completed'
  const dateStr = new Date(meeting.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <Link to="/admin/meetings" style={{ fontSize: '0.8rem', color: 'var(--color-muted)', textDecoration: 'none' }}>← All Meetings</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', letterSpacing: '0.03em', margin: '6px 0 4px' }}>{dateStr}</h1>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: done ? 'var(--color-muted)' : 'var(--color-primary)' }}>
          {done ? 'Completed' : '● In Progress'}
        </span>
      </div>

      {/* ── Step progress ── */}
      <StepProgress steps={STEPS} current={step} />

      {/* ── Step content ── */}
      <div style={{ minHeight: 320 }}>

        {/* A — Personal Updates */}
        {step === 0 && (
          <div>
            <div style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-md)', padding: '40px 36px', marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👋</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: '#fff', margin: '0 0 10px', letterSpacing: '0.02em' }}>How is everyone doing?</h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>
                Take a few minutes for everyone to share a personal update before diving into business.
              </p>
            </div>
            {!done && (
              <QuickAddTP
                value={quickTP}
                onChange={setQuickTP}
                onAdd={() => addQuickTP('Personal Updates')}
                placeholder="Something came up worth discussing as a group…"
              />
            )}
            {done && talkingPoints.filter(tp => tp.source_label === 'Personal Updates').length > 0 && (
              <FlaggedList points={talkingPoints.filter(tp => tp.source_label === 'Personal Updates')} />
            )}
          </div>
        )}

        {/* B — Monthly Metrics */}
        {step === 1 && (
          <div>
            <MeetingMetrics
              meetingId={id}
              meetingDate={meeting.meeting_date}
              reservations={reservations}
              done={done}
            />
            {!done && (
              <div style={{ marginTop: 20 }}>
                <QuickAddTP
                  value={quickTP}
                  onChange={setQuickTP}
                  onAdd={() => addQuickTP('Monthly Metrics')}
                  placeholder="Flag a metric for group discussion…"
                />
              </div>
            )}
          </div>
        )}

        {/* C — Objectives */}
        {step === 2 && (
          <div>
            <SectionHeader letter="C" label="Objectives" color="#6c3483" />
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 16 }}>
              Bi-annual goals — review status and update as needed.
            </p>
            {objectives.length === 0
              ? <p style={{ color: 'var(--color-muted)' }}>No active objectives. <Link to="/admin/objectives" style={{ color: 'var(--color-primary)' }}>Add some →</Link></p>
              : (
                <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
                  {objectives.map(obj => {
                    const s = STATUS_MAP[obj.status] || STATUS_MAP.on_track
                    return (
                      <div key={obj.id} style={{ padding: '13px 16px', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${s.borderColor}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{obj.title}</div>
                            {obj.description && <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: 2 }}>{obj.description}</div>}
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: 3 }}>{obj.period_label}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: s.color, background: s.bg }}>{s.label}</span>
                            {!done && obj.status !== 'on_track'  && <button onClick={() => updateObjStatus(obj.id, 'on_track')}  style={smallBtn('#2C4A2E', 'rgba(44,74,46,0.1)')}>✓ On Track</button>}
                            {!done && obj.status !== 'off_track' && <button onClick={() => updateObjStatus(obj.id, 'off_track')} style={smallBtn('#a33', 'rgba(170,51,51,0.1)')}>⚠ Off Track</button>}
                            {!done && obj.status !== 'complete'  && <button onClick={() => updateObjStatus(obj.id, 'complete')}  style={smallBtn('#555', 'rgba(85,85,85,0.1)')}>✓ Complete</button>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
            {!done && (
              <QuickAddTP
                value={quickTP}
                onChange={setQuickTP}
                onAdd={() => addQuickTP('Objectives')}
                placeholder="Flag an objective for group discussion…"
              />
            )}
          </div>
        )}

        {/* D — Open To-Dos */}
        {step === 3 && (
          <div>
            <SectionHeader letter="D" label="Open To-Dos" color="#784212" />
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 16 }}>
              Action items from previous meetings that haven't been marked done.
            </p>
            {openTodos.length === 0
              ? <p style={{ color: 'var(--color-muted)', marginBottom: 24 }}>No open to-dos from previous meetings.</p>
              : (
                <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
                  {openTodos.map(t => {
                    const overdue = t.due_date && new Date(t.due_date + 'T12:00:00') < now
                    const age = t.created_at ? Math.floor((now - new Date(t.created_at)) / (1000 * 60 * 60 * 24)) : null
                    const stale = age != null && age > 30
                    return (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${overdue || stale ? '#a33' : 'transparent'}` }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{t.title}</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {t.assigned_to && <span>{t.assigned_to}</span>}
                            {t.due_date && <span style={{ color: overdue ? '#a33' : 'inherit' }}>Due {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{overdue ? ' ⚠' : ''}</span>}
                            {stale && <span style={{ color: '#a33' }}>Open {age}d ⚠</span>}
                          </div>
                        </div>
                        {!done && <button onClick={() => completeTodo(t.id)} style={smallBtn('#2C4A2E', 'rgba(44,74,46,0.1)')}>✓ Done</button>}
                      </div>
                    )
                  })}
                </div>
              )
            }
            {!done && (
              <QuickAddTP
                value={quickTP}
                onChange={setQuickTP}
                onAdd={() => addQuickTP('Open To-Dos')}
                placeholder="Flag a to-do for group discussion…"
              />
            )}
          </div>
        )}

        {/* E — Talking Points */}
        {step === 4 && (
          <div>
            <SectionHeader letter="E" label="Talking Points" color="#a33" />
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 16 }}>
              Work through each item. Resolve as you go, and add to-dos for anything that needs follow-up.
            </p>

            {/* Talking points list */}
            <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
              {talkingPoints.length === 0 && (
                <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                  Nothing flagged yet — add items below or flag them from sections A–D.
                </p>
              )}
              {talkingPoints.map(tp => (
                <div key={tp.id} style={{ padding: '13px 15px', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${tp.resolved ? 'var(--color-border)' : '#a33'}`, opacity: tp.resolved ? 0.65 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', textDecoration: tp.resolved ? 'line-through' : 'none', color: tp.resolved ? 'var(--color-muted)' : 'var(--color-text)' }}>{tp.content}</span>
                      {tp.source_label && tp.source_type !== 'manual' && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginLeft: 8 }}>from {tp.source_label}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {!done && !tp.resolved && (
                        <button onClick={() => resolveTP(tp.id)} style={smallBtn('#555', 'rgba(85,85,85,0.08)')}>✓ Resolved</button>
                      )}
                      {!done && <button onClick={() => deleteTP(tp.id)} style={delBtn}>×</button>}
                    </div>
                  </div>
                  {!tp.resolved && (
                    <textarea
                      value={tpNotes[tp.id] !== undefined ? tpNotes[tp.id] : (tp.notes || '')}
                      onChange={e => setTpNotes(prev => ({ ...prev, [tp.id]: e.target.value }))}
                      onBlur={() => saveTPNotes(tp.id)}
                      placeholder="Discussion notes…"
                      rows={2}
                      disabled={done}
                      style={{ ...inp, marginTop: 10, resize: 'vertical', fontSize: '0.85rem' }}
                    />
                  )}
                  {tp.resolved && tp.notes && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>{tp.notes}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Add talking point */}
            {!done && (
              <AddTPInline onAdd={addManualTP} />
            )}

            {/* Add to-do */}
            {!done && (
              <div style={{ marginTop: 28, background: 'rgba(26,138,74,0.05)', border: '1px solid rgba(26,138,74,0.2)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1a8a4a', fontWeight: 700, margin: '0 0 12px' }}>Add To-Do</p>
                <div className="todo-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
                  <input
                    value={newTodo.title}
                    onChange={e => setNewTodo(f => ({ ...f, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addMeetingTodo()}
                    placeholder="What needs to get done?"
                    style={inp}
                  />
                  <input
                    value={newTodo.assigned_to}
                    onChange={e => setNewTodo(f => ({ ...f, assigned_to: e.target.value }))}
                    placeholder="Assigned to"
                    style={inp}
                  />
                  <input
                    type="date"
                    value={newTodo.due_date}
                    onChange={e => setNewTodo(f => ({ ...f, due_date: e.target.value }))}
                    style={inp}
                  />
                  <button onClick={addMeetingTodo} style={{ ...addBtn, background: '#1a8a4a' }}>Add</button>
                </div>
                {meetingTodos.length > 0 && (
                  <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#1a8a4a' }}>
                    {meetingTodos.length} to-do{meetingTodos.length !== 1 ? 's' : ''} added this meeting
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* F — To-Do Review */}
        {step === 5 && (
          <div>
            <SectionHeader letter="F" label="To-Do Review" color="#1a8a4a" />
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 20 }}>
              Everything decided in this meeting that needs to get done.
            </p>
            {meetingTodos.length === 0
              ? <p style={{ color: 'var(--color-muted)' }}>{done ? 'No action items were recorded.' : 'No to-dos yet — add them on the Talking Points step.'}</p>
              : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {meetingTodos.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 3 }}>{t.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {t.assigned_to && <span>👤 {t.assigned_to}</span>}
                          {t.due_date && <span>📅 Due {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>}
                        </div>
                      </div>
                      {!done && <button onClick={() => removeMeetingTodo(t.id)} style={delBtn}>×</button>}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

      </div>

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={() => { setStep(s => s - 1); setQuickTP('') }}
          disabled={step === 0}
          style={{ padding: '11px 24px', background: 'none', color: step === 0 ? 'var(--color-border)' : 'var(--color-text)', border: `1px solid ${step === 0 ? 'var(--color-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: step === 0 ? 'default' : 'pointer' }}
        >
          ← Back
        </button>

        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
          {step + 1} / {STEPS.length}
        </span>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => { setStep(s => s + 1); setQuickTP('') }}
            style={{ padding: '11px 28px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
          >
            Next →
          </button>
        ) : (
          !done
            ? <button onClick={endMeeting} disabled={ending} style={{ padding: '11px 28px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 600, cursor: ending ? 'default' : 'pointer' }}>
                {ending ? 'Ending…' : 'End Meeting ✓'}
              </button>
            : <div style={{ width: 120 }} />
        )}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .todo-row { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 380px) {
          .metrics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StepProgress({ steps, current }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: i === current ? 'var(--color-primary)' : i < current ? 'rgba(44,74,46,0.12)' : 'transparent',
              border: `2px solid ${i === current ? 'var(--color-primary)' : i < current ? 'rgba(44,74,46,0.3)' : 'var(--color-border)'}`,
              color: i === current ? '#fff' : i < current ? 'var(--color-primary)' : 'var(--color-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 700,
              transition: 'all 0.2s',
            }}>
              {i < current ? '✓' : s.letter}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < current ? 'rgba(44,74,46,0.25)' : 'var(--color-border)', margin: '0 4px', transition: 'background 0.2s' }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--color-muted)' }}>Step {current + 1} of {steps.length} — </span>
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{steps[current].label}</span>
      </div>
    </div>
  )
}

function SectionHeader({ letter, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>{letter}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', letterSpacing: '0.02em' }}>{label}</span>
    </div>
  )
}

function QuickAddTP({ value, onChange, onAdd, placeholder }) {
  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20, marginTop: 8 }}>
      <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a33', fontWeight: 700, margin: '0 0 10px' }}>Flag for Discussion</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder={placeholder}
          style={inp}
        />
        <button onClick={onAdd} disabled={!value.trim()} style={{ ...addBtn, background: '#a33', opacity: value.trim() ? 1 : 0.4 }}>Add</button>
      </div>
    </div>
  )
}

function AddTPInline({ onAdd }) {
  const [text, setText] = useState('')
  function submit() {
    onAdd(text)
    setText('')
  }
  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, marginTop: 4 }}>
      <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', fontWeight: 700, margin: '0 0 8px' }}>Add Talking Point</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Add an agenda item…" style={inp} />
        <button onClick={submit} disabled={!text.trim()} style={{ ...addBtn, opacity: text.trim() ? 1 : 0.4 }}>Add</button>
      </div>
    </div>
  )
}

function FlaggedList({ points }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {points.map(tp => (
        <div key={tp.id} style={{ padding: '9px 14px', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{tp.content}</div>
      ))}
    </div>
  )
}

const STATUS_MAP = {
  on_track: { label: 'On Track', color: '#2C4A2E', bg: 'rgba(44,74,46,0.1)', borderColor: 'rgba(44,74,46,0.35)' },
  off_track: { label: 'Off Track', color: '#a33', bg: 'rgba(170,51,51,0.1)', borderColor: 'rgba(170,51,51,0.4)' },
  complete:  { label: 'Complete',  color: '#555', bg: 'rgba(85,85,85,0.1)',  borderColor: 'rgba(85,85,85,0.25)' },
}
