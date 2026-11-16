import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '../services/api'
import { imageUrl } from '../services/media'
import './AdminPage.css'

const collections = [
  ['programs', 'Programs'],
  ['projects', 'Projects'],
  ['events', 'Events'],
  ['team', 'Team members'],
  ['users', 'Users & permissions'],
  ['site-content', 'Website content'],
]

const emptyRecords = {
  programs: { title: '', slug: '', category: '', summary: '', image: '', points: [], status: 'draft' },
  projects: { title: '', slug: '', category: '', summary: '', image: '', status: 'draft' },
  events: { title: '', slug: '', category: '', summary: '', starts_at: '', ends_at: '', location: '', image: '', status: 'draft' },
  team: { name: '', role: '', bio: '', image: '', status: 'draft', sort_order: 0 },
}

function messageFrom(error) {
  return error.response?.data?.error?.message || 'The request could not be completed. Please try again.'
}

function recordLabel(item, collection) {
  return collection === 'team' ? item.name : item.title
}

export default function AdminPage() {
  const [collection, setCollection] = useState('programs')
  const [items, setItems] = useState([])
  const [content, setContent] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyRecords.programs)
  const [contentKey, setContentKey] = useState('')
  const [contentValue, setContentValue] = useState('{\n  \n}')
  const [contentEditing, setContentEditing] = useState(false)
  const isWebsiteContent = collection === 'site-content'
  const isUserManagement = collection === 'users'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (collection === 'site-content') {
        const response = await api.get('/admin/site-content')
        setContent(response.data.items)
      } else {
        const response = await api.get(`/admin/${collection}`)
        setItems(response.data.items)
      }
    } catch (requestError) {
      setError(messageFrom(requestError))
    } finally {
      setLoading(false)
    }
  }, [collection])

  useEffect(() => {
    // Load the selected server-backed collection when the administrator changes tabs.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  const title = useMemo(() => collections.find(([key]) => key === collection)?.[1], [collection])

  function startCreate() {
    setEditing(null)
    setForm({ ...emptyRecords[collection] })
    setNotice('')
    setError('')
  }

  function startEdit(item) {
    setEditing(item.id)
    setError('')
    setNotice('')
    if (collection === 'team') {
      setForm({ ...emptyRecords.team, ...item })
    } else {
      setForm({
        ...emptyRecords[collection],
        ...item,
        summary: item.summary || item.description || '',
        points: Array.isArray(item.details) ? item.details : Array.isArray(item.points) ? item.points : [],
        starts_at: item.starts_at ? new Date(item.starts_at).toISOString().slice(0, 16) : '',
        ends_at: item.ends_at ? new Date(item.ends_at).toISOString().slice(0, 16) : '',
      })
    }
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: name === 'sort_order' ? Number(value) : value }))
  }

  async function submitRecord(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const payload = { ...form }
    if (collection === 'programs') {
      payload.points = typeof form.points === 'string'
        ? form.points.split('\n').map((point) => point.trim()).filter(Boolean)
        : form.points
    }
    try {
      if (editing) await api.patch(`/admin/${collection}/${editing}`, payload)
      else await api.post(`/admin/${collection}`, payload)
      setNotice(editing ? 'Changes saved.' : 'Record created.')
      setEditing(null)
      setForm({ ...emptyRecords[collection] })
      await load()
    } catch (requestError) {
      setError(messageFrom(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function removeRecord(item) {
    if (!window.confirm(`Permanently delete "${recordLabel(item, collection)}"?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.delete(`/admin/${collection}/${item.id}`)
      setNotice('Record deleted.')
      if (editing === item.id) setEditing(null)
      await load()
    } catch (requestError) {
      setError(messageFrom(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = new FormData()
      body.append('image', file)
      const response = await api.post('/admin/uploads', body)
      setForm((current) => ({ ...current, image: response.data.url }))
      setNotice('Image uploaded. Save the record to publish its image.')
    } catch (requestError) {
      setError(messageFrom(requestError))
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  async function saveWebsiteContent(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    let value
    try {
      value = JSON.parse(contentValue)
    } catch {
      setBusy(false)
      setError('Content must be valid JSON.')
      return
    }
    try {
      if (contentEditing) await api.patch(`/admin/site-content/${encodeURIComponent(contentKey)}`, { value })
      else await api.post('/admin/site-content', { key: contentKey, value })
      setContentEditing(false)
      setContentKey('')
      setContentValue('{\n  \n}')
      setNotice(contentEditing ? 'Website content saved.' : 'Website content created.')
      await load()
    } catch (requestError) {
      setError(messageFrom(requestError))
    } finally {
      setBusy(false)
    }
  }

  function editWebsiteContent(item) {
    setContentEditing(true)
    setContentKey(item.key)
    setContentValue(JSON.stringify(item.value, null, 2))
    setError('')
    setNotice('')
  }

  async function removeWebsiteContent(key) {
    if (!window.confirm(`Permanently delete website content "${key}"?`)) return
    setBusy(true)
    setError('')
    try {
      await api.delete(`/admin/site-content/${encodeURIComponent(key)}`)
      setNotice('Website content deleted.')
      await load()
    } catch (requestError) {
      setError(messageFrom(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function updateUserRole(userId, role) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.patch(`/admin/users/${userId}/role`, { role })
      setNotice(`Role updated to ${role}.`)
      await load()
    } catch (requestError) {
      setError(messageFrom(requestError))
    } finally {
      setBusy(false)
    }
  }

  function renderImageFields() {
    return <div className="admin-image-field">
      <label>Image URL<input name="image" value={form.image || ''} onChange={updateField} maxLength="2048" placeholder="/api/v1/uploads/…" /></label>
      <label className="admin-upload-button"><ImagePlus size={17} /> Upload image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={busy} /></label>
      {form.image && <img className="admin-image-preview" src={imageUrl(form.image)} alt="Selected upload preview" />}
      <small>JPEG, PNG or WebP; maximum 5 MB.</small>
    </div>
  }

  function renderRecordFields() {
    const isTeam = collection === 'team'
    return <>
      {isTeam ? <>
        <label>Name<input name="name" value={form.name} onChange={updateField} required minLength="2" maxLength="255" /></label>
        <label>Role<input name="role" value={form.role || ''} onChange={updateField} maxLength="100" /></label>
        <label>Biography<textarea name="bio" value={form.bio || ''} onChange={updateField} maxLength="5000" rows="4" /></label>
        <label>Display order<input name="sort_order" type="number" min="0" max="100000" value={form.sort_order} onChange={updateField} /></label>
      </> : <>
        <label>Title<input name="title" value={form.title} onChange={updateField} required minLength="2" maxLength="200" /></label>
        <label>Slug<input name="slug" value={form.slug || ''} onChange={updateField} maxLength="160" placeholder="Generated from title if empty" /></label>
        <label>Category<input name="category" value={form.category || ''} onChange={updateField} maxLength="100" /></label>
        <label>Description<textarea name="summary" value={form.summary} onChange={updateField} required minLength="2" maxLength="12000" rows="4" /></label>
        {collection === 'programs' && <label>Program details (one per line)<textarea name="points" value={Array.isArray(form.points) ? form.points.join('\n') : form.points || ''} onChange={updateField} rows="4" /></label>}
        {collection === 'events' && <>
          <label>Starts at<input name="starts_at" type="datetime-local" value={form.starts_at || ''} onChange={updateField} required /></label>
          <label>Ends at<input name="ends_at" type="datetime-local" value={form.ends_at || ''} onChange={updateField} /></label>
          <label>Location<input name="location" value={form.location || ''} onChange={updateField} maxLength="255" /></label>
        </>}
      </>}
      {renderImageFields()}
      <label>Status<select name="status" value={form.status} onChange={updateField}><option value="draft">Draft</option><option value="published">Published</option>{collection === 'events' && <option value="cancelled">Cancelled</option>}<option value="archived">Archived</option></select></label>
    </>
  }

  return <section className="admin-page section-wrap">
    <header className="admin-page-heading"><div><span className="eyebrow">Bwiza Youth Bridge</span><h1>Website administration</h1><p>Manage published content and images. Changes are saved to the server database.</p></div></header>
    <nav className="admin-tabs" aria-label="Content collections">{collections.map(([key, label]) => <button key={key} type="button" className={collection === key ? 'active' : ''} onClick={() => { setCollection(key); setEditing(null); setNotice(''); setError('') }}>{label}</button>)}</nav>
    {error && <p className="auth-message auth-error" role="alert">{error}</p>}
    {notice && <p className="auth-message auth-success" role="status"><Check size={16} />{notice}</p>}
    {loading ? <p role="status">Loading {title?.toLowerCase()}…</p> : isWebsiteContent ? <>
      <div className="admin-content-layout">
        <section className="admin-record-list"><div className="admin-section-heading"><h2>Website content</h2><button className="button button-dark" type="button" onClick={() => { setContentEditing(false); setContentKey(''); setContentValue('{\n  \n}') }}><Plus size={16} /> New content</button></div>
          {!content.length && !error && <p>No website content records yet. Create a key such as <code>home</code> to connect a section of the public website.</p>}
          {content.map((item) => <article className="admin-record" key={item.key}><div><strong>{item.key}</strong><small>Updated {new Date(item.updated_at).toLocaleString()}</small></div><div className="admin-record-actions"><button type="button" onClick={() => editWebsiteContent(item)} aria-label={`Edit ${item.key}`}><Pencil size={16} /></button><button type="button" onClick={() => removeWebsiteContent(item.key)} disabled={busy} aria-label={`Delete ${item.key}`}><Trash2 size={16} /></button></div></article>)}
        </section>
        <form className="admin-editor" onSubmit={saveWebsiteContent}><div className="admin-section-heading"><h2>{contentEditing ? 'Edit content' : 'Create content'}</h2><button type="button" aria-label="Clear editor" onClick={() => { setContentEditing(false); setContentKey(''); setContentValue('{\n  \n}') }}><X size={18} /></button></div>
          <label>Content key<input value={contentKey} onChange={(event) => setContentKey(event.target.value)} disabled={contentEditing} maxLength="100" pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,99}" required /></label>
          <label>Value (JSON)<textarea value={contentValue} onChange={(event) => setContentValue(event.target.value)} rows="14" required /></label>
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : contentEditing ? 'Save content' : 'Create content'}</button>
        </form>
      </div>
    </> : isUserManagement ? <>
      <div className="admin-content-layout">
        <section className="admin-record-list"><div className="admin-section-heading"><h2>Users & permissions</h2><small>Every account must be signed in before they can access the admin area.</small></div>
          {!items.length && !error && <p>No registered users have been found yet.</p>}
          {items.map((item) => {
            const roles = String(item.roles || '').split(',').filter(Boolean)
            const currentRole = roles.includes('admin') ? 'admin' : 'member'
            return <article className="admin-record" key={item.id}><div><strong>{item.name}</strong><small>{item.email}</small></div><div className="admin-record-actions"><label className="admin-role-picker">
              <span>Role</span>
              <select value={currentRole} disabled={busy} onChange={(event) => updateUserRole(item.id, event.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label></div></article>
          })}
        </section>
      </div>
    </> : <>
      <div className="admin-content-layout">
        <section className="admin-record-list"><div className="admin-section-heading"><h2>{title}</h2><button className="button button-dark" type="button" onClick={startCreate}><Plus size={16} /> Add {collection === 'team' ? 'member' : collection.slice(0, -1)}</button></div>
          {!items.length && !error && <p>No {title?.toLowerCase()} records are stored yet. Add one to publish it on the website.</p>}
          {items.map((item) => <article className="admin-record" key={item.id}><div><strong>{recordLabel(item, collection)}</strong><small>{item.status} · {item.slug || item.role || 'No slug'}</small></div><div className="admin-record-actions"><button type="button" onClick={() => startEdit(item)} aria-label={`Edit ${recordLabel(item, collection)}`}><Pencil size={16} /></button><button type="button" onClick={() => removeRecord(item)} disabled={busy} aria-label={`Delete ${recordLabel(item, collection)}`}><Trash2 size={16} /></button></div></article>)}
        </section>
        <form className="admin-editor" onSubmit={submitRecord}><div className="admin-section-heading"><h2>{editing ? 'Edit record' : 'Create record'}</h2><button type="button" aria-label="Clear editor" onClick={startCreate}><X size={18} /></button></div>
          {renderRecordFields()}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create record'}</button>
        </form>
      </div>
    </>}
  </section>
}
