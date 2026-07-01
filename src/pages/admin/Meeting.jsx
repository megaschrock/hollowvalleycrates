import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthOf(s) { return new Date(s + 'T12:00:00').getMonth() }
function yearOf(s) { return new Date(s + 'T12:00:00').getFullYear() }
function fmt$(n) { return n != null && !isNaN(n) ? '$' + Math.round(n).toLocaleString() : '—' }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function nightsOf(arr) { return arr.reduce((s, r) => s + (r.nights || 0), 0) }
function revenueOf(arr) { return arr.filter(r => r.net_payout != null).reduce((s, r) => s + r.net_payout, 0) }

const inp = { width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.875rem', background: '#fff', color: 'var(--color-text)', boxSizing: 'border-box' }
const addBtn = { padding: '9px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }
const delBtn = { padding: '4px 9px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }
function smallBtn(color, bg) { return { padding: '4px 12px', background: bg, color, border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' } }

export default function Meeting() {
  const { id } = useParams()

  const [meeting, setMeeting] = useState(null)
  const [updates, setUpdates] = useState([])
  const [objectives, setObjectives] = useState([])
  const [openTodos, setOpenTodos] = useState([])
  const [talkingPoints, setTalkingPoints] = useState([])
  const [meetingTodos, setMeetingTodos] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [flagged, setFlagged] = useState(new Set())

  const [newName, setNewName] = useState('')
  const [newUpdateText, setNewUpdateText] = useState('')
  const [newTP, setNewTP] = useState('')
  const [newTodo, setNewTodo] = useState({ title: '', assigned_to: '', due_date: '' })
  const [tpNotes, setTpNotes] = useState({})
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    async function load() {
      const [
        { data: mtg },
        { data: upds },
        { data: objs },
        { data: tps },
        { data: mTodos },
        { data: res },
        { data: allOpen },
      ] = await Promise.all([
        supabase.from('meetings').select('*').eq('id', id).single(),
        supabase.from('meeting_personal_updates').select('*').eq('meeting_id', id).order('created_at'),
        supabase.from('objectives').select('*').eq('archived', false).order('sort_order').order('created_at', { ascending: false }),
        supabase.from('meeting_talking_points').select('*').eq('meeting_id', id).order('sort_order').order('created_at'),
        supabase.from('meeting_todos').select('*').eq('created_meeting_id', id).order('created_at'),
        supabase.from('reservations').select('start_date,nights,net_payout'),
        supabase.from('meeting_todos').select('*').eq('completed', false).order('created_at'),
      ])
      setMeeting(mtg)
      setUpdates(upds || [])
      setObjectives(objs || [])
      setTalkingPoints(tps || [])
      setMeetingTodos(mTodos || [])
      setReservations(res || [])
      setOpenTodos((allOpen || []).filter(t => t.created_meeting_id !== id))
      setLoading(false)
    }
    load()
  }, [id])

  // ── Metrics ──────────────────────────────────────────────────────────────
  const now = new Date()
  const cm = now.getMonth()
  const cy = now.getFullYear()

  const thisMonth = reservations.filter(r => yearOf(r.start_date) === cy && monthOf(r.start_date) === cm)
  const lyMonth = reservations.filter(r => yearOf(r.start_date) === cy - 1 && monthOf(r.start_date) === cm)
  const ytd = reservations.filter(r => yearOf(r.start_date) === cy && monthOf(r.start_date) <= cm)
  const ytdLY = reservations.filter(r => yearOf(r.start_date) === cy - 1 && monthOf(r.start_date) <= cm)

  const tmNights = nightsOf(thisMonth)
  const lyNights = nightsOf(lyMonth)
  const tmRev = revenueOf(thisMonth)
  const lyRev = revenueOf(lyMonth)
  const tmOcc = Math.round((tmNights / daysInMonth(cy, cm)) * 100)
  const lyOcc = Math.round((lyNights / daysInMonth(cy - 1, cm)) * 100)
  const tmADR = tmNights > 0 ? Math.round(tmRev / tmNights) : null
  const ytdNights = nightsOf(ytd)
  const ytdNightsLY = nightsOf(ytdLY)
  const ytdRev = revenueOf(ytd)
  const ytdRevLY = revenueOf(ytdLY)

  const metrics = [
    { name: 'Nights Sold', value: tmNights, prior: lyNights, fmt: n => String(n), unit: 'nights' },
    { name: 'Cash Flow', value: tmRev, prior: lyRev, fmt: fmt$, unit: 'net payout' },
    { name: 'Occupancy', value: tmOcc, prior: lyOcc, fmt: n => `${n}%`, unit: 'of days' },
    { name: 'Avg Daily Rate', value: tmADR, prior: null, fmt: fmt$, unit: 'per night' },
    { name: 'YTD Nights', value: ytdNights, prior: ytdNightsLY, fmt: n => String(n), unit: 'nights' },
    { name: 'YTD Cash Flow', value: ytdRev, prior: ytdRevLY, fmt: fmt$, unit: 'net payout' },
  ]

  // ── Actions ───────────────────────────────────────────────────────────────
  async function flagToTP(content, sourceType, sourceLabel, key) {
    if (flagged.has(key)) return
    const { data: tp } = await supabase.from('meeting_talking_points').insert({
      meeting_id: id, content, source_type: sourceType, source_label: sourceLabel,
      resolved: false, sort_order: talkingPoints.length,
    }).select().single()
    setTalkingPoints(prev => [...prev, tp])
    setFlagged(prev => new Set([...prev, key]))
  }

  async function addUpdate() {
    if (!newName.trim()) return
    const { data } = await supabase.from('meeting_personal_updates').insert({
      meeting_id: id, person_name: newName.trim(), update_text: newUpdateText.trim(),
    }).select().single()
    setUpdates(prev => [...prev, data])
    setNewName('')
    setNewUpdateText('')
  }

  async function deleteUpdate(uid) {
    await supabase.from('meeting_personal_updates').delete().eq('id', uid)
    setUpdates(prev => prev.filter(u => u.id !== uid))
  }

  async function updateObjStatus(objId, status) {
    await supabase.from('objectives').update({ status }).eq('id', objId)
    setObjectives(prev => prev.map(o => o.id === objId ? { ...o, status } : o))
  }

  async function completeTodo(todoId) {
    await supabase.from('meeting_todos').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', todoId)
    setOpenTodos(prev => prev.filter(t => t.id !== todoId))
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

  async function addTP() {
    if (!newTP.trim()) return
    const { data: tp } = await supabase.from('meeting_talking_points').insert({
      meeting_id: id, content: newTP.trim(), source_type: 'manual', sort_order: talkingPoints.length,
    }).select().single()
    setTalkingPoints(prev => [...prev, tp])
    setNewTP('')
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
    setNewTodo({ title: '', assigned_to: '', due_date: '' })
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

  if (loading) return <div style={{ padding: 32, color: 'var(--color-muted)' }}>Loading meeting…</div>
  if (!meeting) return <div style={{ padding: 32, color: 'var(--color-muted)' }}>Meeting not found.</div>

  const done = meeting.status === 'completed'
  const dateStr = new Date(meeting.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const unresolved = talkingPoints.filter(tp => !tp.resolved).length

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Link to="/admin/meetings" style={{ fontSize: '0.8rem', color: 'var(--color-muted)', textDecoration: 'none' }}>← All Meetings</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', letterSpacing: '0.03em', margin: '6px 0 4px' }}>{dateStr}</h1>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: done ? 'var(--color-muted)' : 'var(--color-primary)' }}>
            {done ? 'Completed' : '● In Progress'}
          </span>
        </div>
        {!done && (
          <button onClick={endMeeting} disabled={ending} style={{ padding: '10px 22px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 500, fontSize: '0.875rem', cursor: ending ? 'default' : 'pointer' }}>
            {ending ? 'Ending…' : 'End Meeting'}
          </button>
        )}
      </div>

      {/* Jump links */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {[['A','Personal Updates','#sec-a'],['B','Monthly Metrics','#sec-b'],['C','Objectives','#sec-c'],['D','Open To-Dos','#sec-d'],['E','Talking Points','#sec-e'],['F','To-Do Review','#sec-f']].map(([letter, label, href]) => (
          <a key={letter} href={href} style={{ padding: '5px 13px', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--color-text)', textDecoration: 'none', fontWeight: 500 }}>
            <strong>{letter}</strong> {label}
          </a>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>

        {/* ── A. Personal Updates ───────────────────────────────── */}
        <div id="sec-a">
          <MeetingSection letter="A" label="Personal Updates" color="#2C4A2E" headerBg="rgba(44,74,46,0.07)">
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>How is everyone doing? Capture a quick check-in for each person.</p>
            {updates.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                {updates.map(u => (
                  <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '11px 14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.person_name}</span>
                      {u.update_text && <p style={{ margin: '3px 0 0', color: 'var(--color-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>{u.update_text}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {!done && (
                        <DiscussBtn
                          on={flagged.has(`upd-${u.id}`)}
                          onClick={() => flagToTP(
                            u.update_text ? `${u.person_name}: "${u.update_text}"` : `${u.person_name}'s update`,
                            'personal_update', u.person_name, `upd-${u.id}`
                          )}
                        />
                      )}
                      {!done && <button onClick={() => deleteUpdate(u.id)} style={delBtn}>×</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!done && (
              <div className="meeting-row-3" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8 }}>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" style={inp} />
                <input value={newUpdateText} onChange={e => setNewUpdateText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addUpdate()} placeholder="How are they doing?" style={inp} />
                <button onClick={addUpdate} style={addBtn}>Add</button>
              </div>
            )}
            {done && updates.length === 0 && <Empty text="No personal updates recorded." />}
          </MeetingSection>
        </div>

        {/* ── B. Monthly Metrics ────────────────────────────────── */}
        <div id="sec-b">
          <MeetingSection letter="B" label={`Monthly Metrics — ${MONTHS[cm]} ${cy}`} color="#1a5276" headerBg="rgba(26,82,118,0.07)">
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
              All figures vs. {MONTHS_SHORT[cm]} {cy - 1}. Flag any metric that needs group discussion.
            </p>
            <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {metrics.map((m, i) => {
                const key = `metric-${i}`
                const diff = m.prior != null ? m.value - m.prior : null
                const pct = m.prior > 0 && diff != null ? Math.round((diff / m.prior) * 100) : null
                const trending = pct != null ? (pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat') : null
                return (
                  <div key={i} style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '13px 14px' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-muted)', marginBottom: 4 }}>{m.name}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--color-text)', lineHeight: 1.1, marginBottom: 3 }}>
                      {m.value != null ? m.fmt(m.value) : '—'}
                    </div>
                    {m.prior != null && (
                      <div style={{ fontSize: '0.72rem', color: trending === 'up' ? '#2C4A2E' : trending === 'down' ? '#a33' : 'var(--color-muted)', marginBottom: 8 }}>
                        {pct != null ? (pct > 0 ? `↑ ${pct}%` : pct < 0 ? `↓ ${Math.abs(pct)}%` : '= 0%') : ''}
                        {' '}vs {MONTHS_SHORT[cm]} {cy - 1}
                        {m.prior != null && <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> ({m.fmt(m.prior)})</span>}
                      </div>
                    )}
                    {!done && (
                      <DiscussBtn on={flagged.has(key)} onClick={() => flagToTP(`${m.name}: ${m.value != null ? m.fmt(m.value) : '—'} (${trending === 'up' ? '↑' : trending === 'down' ? '↓' : '='} vs last year)`, 'metric', m.name, key)} />
                    )}
                  </div>
                )
              })}
            </div>
          </MeetingSection>
        </div>

        {/* ── C. Objectives ─────────────────────────────────────── */}
        <div id="sec-c">
          <MeetingSection letter="C" label="Objectives" color="#6c3483" headerBg="rgba(108,52,131,0.07)">
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>Bi-annual goals — update status and flag any that need discussion.</p>
            {objectives.length === 0
              ? <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.875rem' }}>No active objectives. <Link to="/admin/objectives" style={{ color: 'var(--color-primary)' }}>Add some →</Link></p>
              : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {objectives.map(obj => {
                    const key = `obj-${obj.id}`
                    const s = STATUS_MAP[obj.status] || STATUS_MAP.on_track
                    return (
                      <div key={obj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap', borderLeft: `3px solid ${s.borderColor}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{obj.title}</div>
                          {obj.description && <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: 2 }}>{obj.description}</div>}
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: 3 }}>{obj.period_label}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: s.color, background: s.bg }}>{s.label}</span>
                          {!done && obj.status !== 'on_track' && <button onClick={() => updateObjStatus(obj.id, 'on_track')} style={smallBtn('#2C4A2E', 'rgba(44,74,46,0.1)')}>✓ On Track</button>}
                          {!done && obj.status !== 'off_track' && <button onClick={() => updateObjStatus(obj.id, 'off_track')} style={smallBtn('#a33', 'rgba(170,51,51,0.1)')}>⚠ Off Track</button>}
                          {!done && obj.status !== 'complete' && <button onClick={() => updateObjStatus(obj.id, 'complete')} style={smallBtn('#555', 'rgba(85,85,85,0.1)')}>✓ Complete</button>}
                          {!done && <DiscussBtn on={flagged.has(key)} onClick={() => flagToTP(`Objective off track: ${obj.title}`, 'objective', obj.title, key)} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </MeetingSection>
        </div>

        {/* ── D. Open To-Dos ────────────────────────────────────── */}
        <div id="sec-d">
          <MeetingSection letter="D" label="Open To-Dos" color="#784212" headerBg="rgba(120,66,18,0.07)" badge={openTodos.length > 0 ? `${openTodos.length} open` : null} badgeColor="#784212">
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>Action items from previous meetings that haven't been marked done.</p>
            {openTodos.length === 0
              ? <Empty text="No open to-dos from previous meetings." />
              : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {openTodos.map(t => {
                    const key = `todo-${t.id}`
                    const overdue = t.due_date && new Date(t.due_date + 'T12:00:00') < now
                    const age = t.created_at ? Math.floor((now - new Date(t.created_at)) / (1000 * 60 * 60 * 24)) : null
                    const stale = age != null && age > 30
                    return (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', borderLeft: overdue || stale ? '3px solid #a33' : '3px solid transparent' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{t.title}</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {t.assigned_to && <span>{t.assigned_to}</span>}
                            {t.due_date && (
                              <span style={{ color: overdue ? '#a33' : 'var(--color-muted)' }}>
                                Due {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{overdue ? ' ⚠' : ''}
                              </span>
                            )}
                            {stale && <span style={{ color: '#a33' }}>Open {age}d ⚠</span>}
                          </div>
                        </div>
                        {!done && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => completeTodo(t.id)} style={smallBtn('#2C4A2E', 'rgba(44,74,46,0.1)')}>✓ Done</button>
                            <DiscussBtn on={flagged.has(key)} onClick={() => flagToTP(`To-do still open: ${t.title}`, 'todo', t.title, key)} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }
          </MeetingSection>
        </div>

        {/* ── E. Talking Points ─────────────────────────────────── */}
        <div id="sec-e">
          <MeetingSection letter="E" label="Talking Points" color="#a33" headerBg="rgba(170,51,51,0.07)" badge={unresolved > 0 ? `${unresolved} unresolved` : null} badgeColor="#a33">
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
              Agenda items for this meeting. Flag anything from sections A–D above to bring it here, or add items directly.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {talkingPoints.length === 0 && !done && <Empty text="Nothing flagged yet — use the Discuss buttons above to pull items in, or add one below." />}
              {talkingPoints.length === 0 && done && <Empty text="No talking points were recorded." />}
              {talkingPoints.map(tp => (
                <div key={tp.id} style={{ padding: '13px 15px', background: tp.resolved ? 'rgba(85,85,85,0.04)' : 'var(--color-bg)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${tp.resolved ? 'var(--color-border)' : '#a33'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: tp.resolved ? 0 : 8 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: tp.resolved ? 'var(--color-muted)' : 'var(--color-text)', textDecoration: tp.resolved ? 'line-through' : 'none' }}>{tp.content}</span>
                      {tp.source_type !== 'manual' && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginLeft: 8 }}>
                          from {SOURCE_LABELS[tp.source_type] || tp.source_type}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {!done && !tp.resolved && (
                        <button onClick={() => resolveTP(tp.id)} style={smallBtn('#555', 'rgba(85,85,85,0.08)')}>✓ Resolved</button>
                      )}
                      {!done && (
                        <button onClick={() => deleteTP(tp.id)} style={delBtn}>×</button>
                      )}
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
                      style={{ ...inp, resize: 'vertical', fontSize: '0.85rem' }}
                    />
                  )}
                  {tp.resolved && tp.notes && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>{tp.notes}</p>
                  )}
                </div>
              ))}
            </div>
            {!done && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: talkingPoints.length > 0 ? 12 : 0 }}>
                <input value={newTP} onChange={e => setNewTP(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTP()} placeholder="Add talking point…" style={inp} />
                <button onClick={addTP} style={addBtn}>Add</button>
              </div>
            )}
          </MeetingSection>
        </div>

        {/* ── F. To-Do Review ───────────────────────────────────── */}
        <div id="sec-f">
          <MeetingSection letter="F" label="To-Do Review" color="#1a8a4a" headerBg="rgba(26,138,74,0.07)" badge={meetingTodos.length > 0 ? `${meetingTodos.length} item${meetingTodos.length !== 1 ? 's' : ''}` : null} badgeColor="#1a8a4a">
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>Everything decided in this meeting that needs to get done. Assign and set due dates.</p>
            {meetingTodos.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                {meetingTodos.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{t.title}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                        {t.assigned_to && <span>{t.assigned_to}</span>}
                        {t.due_date && <span>Due {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </div>
                    {!done && <button onClick={() => removeMeetingTodo(t.id)} style={delBtn}>×</button>}
                  </div>
                ))}
              </div>
            )}
            {done && meetingTodos.length === 0 && <Empty text="No action items from this meeting." />}
            {!done && (
              <div className="meeting-row-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
                <input value={newTodo.title} onChange={e => setNewTodo(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addMeetingTodo()} placeholder="What needs to get done?" style={inp} />
                <input value={newTodo.assigned_to} onChange={e => setNewTodo(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Assigned to" style={inp} />
                <input type="date" value={newTodo.due_date} onChange={e => setNewTodo(f => ({ ...f, due_date: e.target.value }))} style={inp} />
                <button onClick={addMeetingTodo} style={addBtn}>Add</button>
              </div>
            )}
          </MeetingSection>
        </div>

      </div>

      <style>{`
        @media (max-width: 640px) {
          .meeting-row-3 { grid-template-columns: 1fr !important; }
          .meeting-row-4 { grid-template-columns: 1fr 1fr !important; }
          .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 400px) {
          .metrics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MeetingSection({ letter, label, color, headerBg, badge, badgeColor, children }) {
  return (
    <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--color-border)', background: headerBg }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 700, flexShrink: 0 }}>{letter}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', letterSpacing: '0.02em', color: 'var(--color-text)' }}>{label}</span>
        {badge && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{badge}</span>}
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </div>
  )
}

function DiscussBtn({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={on}
      title={on ? 'Added to talking points' : 'Flag for group discussion'}
      style={{
        padding: '4px 10px',
        background: on ? 'rgba(170,51,51,0.1)' : 'none',
        color: on ? '#a33' : 'var(--color-muted)',
        border: `1px solid ${on ? 'rgba(170,51,51,0.25)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.73rem',
        cursor: on ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: 500,
      }}
    >
      {on ? '✓ In Discussion' : '⚑ Discuss'}
    </button>
  )
}

function Empty({ text }) {
  return <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.875rem' }}>{text}</p>
}

const STATUS_MAP = {
  on_track: { label: 'On Track', color: '#2C4A2E', bg: 'rgba(44,74,46,0.1)', borderColor: 'rgba(44,74,46,0.3)' },
  off_track: { label: 'Off Track', color: '#a33', bg: 'rgba(170,51,51,0.1)', borderColor: 'rgba(170,51,51,0.4)' },
  complete: { label: 'Complete', color: '#555', bg: 'rgba(85,85,85,0.1)', borderColor: 'rgba(85,85,85,0.2)' },
}

const SOURCE_LABELS = {
  personal_update: 'personal update',
  metric: 'monthly metrics',
  objective: 'objectives',
  todo: 'open to-dos',
}
