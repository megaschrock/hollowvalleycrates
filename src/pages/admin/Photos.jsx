import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortablePhoto({ photo, onDelete, onCaption }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div {...attributes} {...listeners} style={{ aspectRatio: '4/3', cursor: 'grab', overflow: 'hidden' }}>
        <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <input value={photo.caption || ''} onChange={e => onCaption(photo.id, e.target.value)} placeholder="Caption…" style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: 8, fontFamily: 'var(--font-body)' }} />
        <button onClick={() => onDelete(photo)} style={{ fontSize: '0.75rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  )
}

export default function Photos() {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.03em' }}>Photos</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ padding: '10px 20px', background: 'var(--color-secondary)', color: 'var(--color-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : 'Upload Photos'}
            <input type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
          <button onClick={saveOrder} disabled={saving} style={{ padding: '10px 20px', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }}>
            {saving ? 'Saving…' : 'Save Order & Captions'}
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginBottom: 24 }}>Drag photos to reorder. First photo is used as the hero image.</p>
      {!photos.length && !uploading && <p style={{ color: 'var(--color-muted)', padding: 32, textAlign: 'center' }}>No photos yet. Upload some above.</p>}
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
