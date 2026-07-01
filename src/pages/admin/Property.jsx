import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: '0.95rem', background: '#fff', color: 'var(--color-text)', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6, fontWeight: 500 }
const sectionStyle = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 20 }
const btnPrimary = { padding: '11px 24px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }
const sh2 = { fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.03em', marginBottom: 16, marginTop: 0 }

export default function Property() {
  const [tab, setTab] = useState('details')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em', margin: 0 }}>Property</h1>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {[['details', 'Details'], ['photos', 'Photos']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '8px 22px', background: tab === key ? 'var(--color-primary)' : 'var(--color-card)', color: tab === key ? '#fff' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>{label}</button>
          ))}
        </div>
      </div>
      {tab === 'details' ? <DetailsTab /> : <PhotosTab />}
    </div>
  )
}

function DetailsTab() {
  const [form, setForm] = useState({ property_headline: '', property_description: '', amenities: [], phone: '', email: '', airbnb_url: '', vrbo_url: '', social_instagram: '', social_facebook: '' })
  const [amenityInput, setAmenityInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setForm({ property_headline: data.property_headline || '', property_description: data.property_description || '', amenities: data.amenities || [], phone: data.phone || '', email: data.email || '', airbnb_url: data.airbnb_url || '', vrbo_url: data.vrbo_url || '', social_instagram: data.social_instagram || '', social_facebook: data.social_facebook || '' })
    })
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function addAmenity() {
    if (!amenityInput.trim()) return
    set('amenities', [...form.amenities, amenityInput.trim()])
    setAmenityInput('')
  }

  function removeAmenity(i) { set('amenities', form.amenities.filter((_, idx) => idx !== i)) }

  async function save() {
    setSaving(true)
    await supabase.from('settings').update(form).eq('id', 1)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div style={sectionStyle}>
        <h2 style={sh2}>Property</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="Headline" value={form.property_headline} onChange={v => set('property_headline', v)} />
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, height: 120, resize: 'vertical' }} value={form.property_description} onChange={e => set('property_description', e.target.value)} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Amenities</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {form.amenities.map((a, i) => (
            <span key={i} style={{ padding: '5px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 100, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              {a}
              <button onClick={() => removeAmenity(i)} style={{ color: 'var(--color-muted)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={amenityInput} onChange={e => setAmenityInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAmenity()} placeholder="Add amenity…" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addAmenity} style={btnPrimary}>Add</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Contact</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Phone" value={form.phone} onChange={v => set('phone', v)} />
          <Field label="Email" value={form.email} onChange={v => set('email', v)} />
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Listing URLs</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="Airbnb URL" value={form.airbnb_url} onChange={v => set('airbnb_url', v)} />
          <Field label="VRBO URL" value={form.vrbo_url} onChange={v => set('vrbo_url', v)} />
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sh2}>Social</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="Instagram URL" value={form.social_instagram} onChange={v => set('social_instagram', v)} />
          <Field label="Facebook URL" value={form.social_facebook} onChange={v => set('social_facebook', v)} />
        </div>
      </div>

      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}</button>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function SortablePhoto({ photo, onDelete, onCaption }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div {...attributes} {...listeners} style={{ aspectRatio: '4/3', cursor: 'grab', overflow: 'hidden' }}>
        <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <input value={photo.caption || ''} onChange={e => onCaption(photo.id, e.target.value)} placeholder="Caption…" style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: 8, fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
        <button onClick={() => onDelete(photo)} style={{ fontSize: '0.75rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  )
}

function PhotosTab() {
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    supabase.from('photos').select('*').order('display_order').then(({ data }) => { if (data) setPhotos(data) })
  }, [])

  async function handleUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('photos').upload(path, file)
      if (upErr) continue
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
      const maxOrder = photos.reduce((m, p) => Math.max(m, p.display_order || 0), 0)
      const { data } = await supabase.from('photos').insert([{ url: publicUrl, storage_path: path, display_order: maxOrder + 1, created_at: new Date().toISOString() }]).select().single()
      if (data) setPhotos(p => [...p, data])
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(photo) {
    if (!confirm('Delete this photo?')) return
    if (photo.storage_path) await supabase.storage.from('photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', photo.id)
    setPhotos(p => p.filter(x => x.id !== photo.id))
  }

  function handleCaption(id, value) {
    setPhotos(p => p.map(x => x.id === id ? { ...x, caption: value } : x))
  }

  async function saveOrder() {
    setSaving(true)
    for (let i = 0; i < photos.length; i++) {
      await supabase.from('photos').update({ display_order: i + 1, caption: photos[i].caption }).eq('id', photos[i].id)
    }
    setSaving(false)
  }

  function handleDragEnd({ active, over }) {
    if (active.id !== over?.id) {
      const oldIdx = photos.findIndex(p => p.id === active.id)
      const newIdx = photos.findIndex(p => p.id === over.id)
      setPhotos(arrayMove(photos, oldIdx, newIdx))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: 0 }}>Drag to reorder. First photo is the hero image.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ padding: '9px 18px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : 'Upload Photos'}
            <input type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
          <button onClick={saveOrder} disabled={saving} style={btnPrimary}>
            {saving ? 'Saving…' : 'Save Order & Captions'}
          </button>
        </div>
      </div>
      {!photos.length && !uploading && <p style={{ color: 'var(--color-muted)', padding: 40, textAlign: 'center' }}>No photos yet. Upload some above.</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {photos.map(photo => (
              <SortablePhoto key={photo.id} photo={photo} onDelete={handleDelete} onCaption={handleCaption} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
