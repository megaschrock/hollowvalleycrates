import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_MAP = {
  on_track: { label: 'On Track', color: '#2C4A2E', bg: 'rgba(44,74,46,0.1)' },
  off_track: { label: 'Off Track', color: '#a33', bg: 'rgba(170,51,51,0.1)' },
  complete: { label: 'Complete', color: '#555', bg: 'rgba(85,85,85,0.1)' },
}

const lbl = { display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }
const inp = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', background: '#fff', color: 'var(--color-text)', boxSizing: 'border-box' }
const btnPrimary = { padding: '10px 22px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }
const btnGhost = { padding: '10px 22px', background: 'transparent', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', cursor: 'pointer' }

export default function ActionItems() {
  // Objectives state
  const [objectives, setObjectives] = useState([])
  const [showAddObj, setShowAddObj] = useState(false)
  const [objForm, setObjForm] = useState({ title: '', description: '', period_label: currentPeriod() })
  const [savingObj, setSavingObj] = useState(false)

  // Todos state
  const [todos, setTodos] = useState([])
  const [showDone, setShowDone] = useState(false)
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [todoForm, setTodoForm] = useState({ title: '', assigned_to: '', due_date: '' })
  const [savingTodo, setSavingTodo] = useState(false)

  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: objs }, { data: tds }] = await Promise.all([
      supabase.from('objectives').select('*').eq('archived', false).order('created_at', { ascending: false }),
      supabase.from('meeting_todos').select('*').order('created_at', { ascending: false }),
    ])
    setObjectives(objs || [])
    setTodos(tds || [])
    setLoading(false)
  }

  // ── Objective actions ──────────────────────────────────────────────────────
  async function addObjective() {
    if (!objForm.title.trim()) return
    setSavingObj(true)
    const { data } = await supabase.from('objectives').insert({ ...objForm, title: objForm.title.trim() }).select().single()
    setObjectives(prev => [data, ...prev])
    setObjForm({ title: '', description: '', period_label: objForm.period_label })
    setShowAddObj(false)
    setSavingObj(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('objectives').update({ status }).eq('id', id)
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  async function archiveObj(id) {
    await supabase.from('objectives').update({ archived: true }).eq('id', id)
    setObjectives(prev => prev.filter(o => o.id !== id))
  }

  // ── Todo actions ───────────────────────────────────────────────────────────
  async function addTodo() {
    if (!todoForm.title.trim()) return
    setSavingTodo(true)
    const { data } = await supabase.from('meeting_todos').insert({
      title: todoForm.title.trim(),
      assigned_to: todoForm.assigned_to.trim(),
      due_date: todoForm.due_date || null,
    }).select().single()
    setTodos(prev => [data, ...prev])
    setTodoForm({ title: '', assigned_to: '', due_date: '' })
    setShowAddTodo(false)
    setSavingTodo(false)
  }

  async function completeTodo(id) {
    await supabase.from('meeting_todos').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: true, completed_at: new Date().toISOString() } : t))
  }

  async function reopenTodo(id) {
    await supabase.from('meeting_todos').update({ completed: false, completed_at: null }).eq('id', id)
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: false, completed_at: null } : t))
  }

  async function deleteTodo(id) {
    await supabase.from('meeting_todos').delete().eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  const periods = [...new Set(objectives.map(o => o.period_label))].sort((a, b) => b.localeCompare(a))
  const openTodos = todos.filter(t => !t.completed)
  const doneTodos = todos.filter(t => t.completed)
  const now = new Date()

  if (loading) return <p style={{ color: 'var(--color-muted)' }}>Loading…</p>

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', marginBottom: 36 }}>Action Items</h1>

      {/* ── Objectives ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.03em', margin: 0 }}>Objectives</h2>
          <button onClick={() => setShowAddObj(s => !s)} style={btnPrimary}>{showAddObj ? 'Cancel' : '+ Add Objective'}</button>
        </div>

        {showAddObj && (
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={lbl}>Period</label>
                <input value={objForm.period_label} onChange={e => setObjForm(f => ({ ...f, period_label: e.target.value }))} placeholder="e.g. H1 2026" style={inp} />
              </div>
              <div>
                <label style={lbl}>Title</label>
                <input value={objForm.title} onChange={e => setObjForm(f => ({ ...f, title: e.target.value }))} placeholder="What are we focused on?" style={inp} />
              </div>
              <div>
                <label style={lbl}>Description / Key Results (optional)</label>
                <textarea value={objForm.description} onChange={e => setObjForm(f => ({ ...f, description: e.target.value }))} placeholder="Context, key results, or success criteria…" style={{ ...inp, height: 72, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={addObjective} disabled={savingObj} style={btnPrimary}>{savingObj ? 'Saving…' : 'Add Objective'}</button>
                <button onClick={() => setShowAddObj(false)} style={btnGhost}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {objectives.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>No objectives yet. Add your first bi-annual goal above.</p>
        ) : (
          periods.map(period => (
            <div key={period} style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', letterSpacing: '0.08em', color: 'var(--color-muted)', marginBottom: 10, textTransform: 'uppercase' }}>{period}</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {objectives.filter(o => o.period_label === period).map(obj => (
                  <ObjectiveCard key={obj.id} obj={obj} onStatusChange={updateStatus} onArchive={archiveObj} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── To-Dos ──────────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.03em', margin: 0 }}>
            To-Dos
            {openTodos.length > 0 && <span style={{ marginLeft: 10, fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-muted)', fontFamily: 'var(--font-body)' }}>{openTodos.length} open</span>}
          </h2>
          <div style={{ display: 'flex', gap: 10 }}>
            {doneTodos.length > 0 && (
              <button onClick={() => setShowDone(s => !s)} style={btnGhost}>{showDone ? 'Hide Completed' : `Show Completed (${doneTodos.length})`}</button>
            )}
            <button onClick={() => setShowAddTodo(s => !s)} style={btnPrimary}>{showAddTodo ? 'Cancel' : '+ Add To-Do'}</button>
          </div>
        </div>

        {showAddTodo && (
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 24, marginBottom: 20 }}>
            <div className="todo-add-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Task</label>
                <input value={todoForm.title} onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="What needs to get done?" style={inp} />
              </div>
              <div>
                <label style={lbl}>Assigned To</label>
                <input value={todoForm.assigned_to} onChange={e => setTodoForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Name" style={inp} />
              </div>
              <div>
                <label style={lbl}>Due Date</label>
                <input type="date" value={todoForm.due_date} onChange={e => setTodoForm(f => ({ ...f, due_date: e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={addTodo} disabled={savingTodo} style={btnPrimary}>{savingTodo ? 'Saving…' : 'Add To-Do'}</button>
              <button onClick={() => setShowAddTodo(false)} style={btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {openTodos.length === 0 && !showDone ? (
          <p style={{ color: 'var(--color-muted)' }}>No open to-dos. Nice.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {openTodos.map(t => (
              <TodoRow key={t.id} t={t} now={now} onComplete={completeTodo} onDelete={deleteTodo} />
            ))}
            {showDone && doneTodos.length > 0 && (
              <>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', padding: '12px 0 4px', fontWeight: 600 }}>Completed</div>
                {doneTodos.map(t => (
                  <TodoRow key={t.id} t={t} now={now} onReopen={reopenTodo} onDelete={deleteTodo} done />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .todo-add-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function ObjectiveCard({ obj, onStatusChange, onArchive }) {
  const [confirming, setConfirming] = useState(false)
  const s = STATUS_MAP[obj.status] || STATUS_MAP.on_track
  const others = Object.entries(STATUS_MAP).filter(([k]) => k !== obj.status)

  return (
    <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: obj.description ? 5 : 0, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text)' }}>{obj.title}</span>
            <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: s.color, background: s.bg }}>{s.label}</span>
          </div>
          {obj.description && <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>{obj.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {others.map(([k, st]) => (
            <button key={k} onClick={() => onStatusChange(obj.id, k)} style={{ padding: '5px 12px', background: st.bg, color: st.color, border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
              → {st.label}
            </button>
          ))}
          {confirming ? (
            <>
              <button onClick={() => onArchive(obj.id)} style={{ padding: '5px 12px', background: '#a33', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>Confirm</button>
              <button onClick={() => setConfirming(false)} style={{ padding: '5px 10px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} style={{ padding: '5px 10px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>Archive</button>
          )}
        </div>
      </div>
    </div>
  )
}

function TodoRow({ t, now, onComplete, onReopen, onDelete, done }) {
  const [confirming, setConfirming] = useState(false)
  const overdue = !done && t.due_date && new Date(t.due_date + 'T12:00:00') < now

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', opacity: done ? 0.6 : 1 }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 500, fontSize: '0.9rem', textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--color-muted)' : 'var(--color-text)' }}>{t.title}</span>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {t.assigned_to && <span>{t.assigned_to}</span>}
          {t.due_date && (
            <span style={{ color: overdue ? '#a33' : 'var(--color-muted)' }}>
              Due {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{overdue ? ' ⚠' : ''}
            </span>
          )}
          {done && t.completed_at && (
            <span>Done {new Date(t.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {!done && <button onClick={() => onComplete(t.id)} style={{ padding: '5px 12px', background: 'rgba(44,74,46,0.1)', color: '#2C4A2E', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>✓ Done</button>}
        {done && <button onClick={() => onReopen(t.id)} style={{ padding: '5px 12px', background: 'rgba(85,85,85,0.08)', color: 'var(--color-muted)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>Reopen</button>}
        {confirming ? (
          <>
            <button onClick={() => onDelete(t.id)} style={{ padding: '5px 10px', background: '#a33', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
            <button onClick={() => setConfirming(false)} style={{ padding: '5px 8px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>×</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} style={{ padding: '5px 8px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>×</button>
        )}
      </div>
    </div>
  )
}

function currentPeriod() {
  const m = new Date().getMonth()
  const y = new Date().getFullYear()
  return `${m < 6 ? 'H1' : 'H2'} ${y}`
}
