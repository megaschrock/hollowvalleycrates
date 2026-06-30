import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Meetings() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('meetings').select('*').order('meeting_date', { ascending: false }).then(({ data, error }) => {
      if (error) setError('Could not load meetings. Make sure you have run the Phase 5 schema SQL in Supabase.')
      setMeetings(data || [])
      setLoading(false)
    })
  }, [])

  async function startMeeting() {
    setStarting(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase.from('meetings').insert({ meeting_date: today, status: 'in_progress' }).select().single()
      if (error) throw error
      navigate(`/admin/meetings/${data.id}`)
    } catch (err) {
      setError('Could not start meeting. Make sure you have run the Phase 5 schema SQL in Supabase. (' + err.message + ')')
      setStarting(false)
    }
  }

  function fmtDate(d) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const inProgress = meetings.filter(m => m.status === 'in_progress')
  const completed = meetings.filter(m => m.status === 'completed')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', margin: 0 }}>Meetings</h1>
        <button onClick={startMeeting} disabled={starting} style={{ padding: '10px 24px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: starting ? 'default' : 'pointer' }}>
          {starting ? 'Starting…' : '▶ Start Meeting'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(170,51,51,0.08)', border: '1px solid rgba(170,51,51,0.25)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 24, color: '#a33', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
      ) : meetings.length === 0 ? (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '40px 32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-muted)', margin: '0 0 16px' }}>No meetings yet.</p>
          <button onClick={startMeeting} style={{ padding: '12px 28px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}>Start Your First Meeting</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {inProgress.length > 0 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.06em', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 12 }}>In Progress</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {inProgress.map(m => <MeetingRow key={m.id} m={m} fmtDate={fmtDate} fmtTime={fmtTime} />)}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.06em', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Past Meetings</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {completed.map(m => <MeetingRow key={m.id} m={m} fmtDate={fmtDate} fmtTime={fmtTime} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MeetingRow({ m, fmtDate, fmtTime }) {
  const inProg = m.status === 'in_progress'
  return (
    <Link to={`/admin/meetings/${m.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: 'var(--color-card)', border: `1px solid ${inProg ? 'rgba(44,74,46,0.3)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', padding: '18px 24px', textDecoration: 'none', color: 'inherit' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 3 }}>{fmtDate(m.meeting_date)}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{fmtTime(m.created_at)}</div>
      </div>
      <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, ...(inProg ? { background: 'rgba(44,74,46,0.12)', color: 'var(--color-primary)' } : { background: 'rgba(85,85,85,0.07)', color: 'var(--color-muted)' }) }}>
        {inProg ? '● In Progress' : 'Completed'}
      </span>
    </Link>
  )
}
