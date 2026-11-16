import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, LockKeyhole } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { api } from '../services/api'

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

export function AuthNav({ onAction = () => {} }) {
  const { user, loading, logout, openLogin, getErrorMessage } = useAuth()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [adminAccess, setAdminAccess] = useState(null)
  const isAdmin = Boolean(user && adminAccess?.userId === user.id && adminAccess.isAdmin)
  const menu = useRef(null)
  const location = useLocation()

  useEffect(() => {
    // Close the account menu when navigating through app links or browser history.
    // oxlint-disable-next-line react/set-state-in-effect
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    let active = true
    if (!user) {
      return () => { active = false }
    }
    api.get('/admin/access').then((response) => {
      if (active) setAdminAccess({ userId: user.id, isAdmin: response.data.isAdmin === true })
    }).catch(() => {
      if (active) setAdminAccess({ userId: user.id, isAdmin: false })
    })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    function closeOutside(event) {
      if (menu.current && !menu.current.contains(event.target)) setOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  async function signOut() {
    setError('')
    try {
      await logout()
      setOpen(false)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  if (loading) return null
  if (!user) return <button className="nav-login" type="button" onClick={() => { openLogin(); onAction() }}><LockKeyhole size={15} /> Sign in</button>

  return (
    <div className="account-menu" ref={menu}>
      <button className="account-trigger" type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span className="account-initials">{initials(user.name)}</span>}
        <span className="account-trigger-name">{user.name}</span><ChevronDown size={15} />
      </button>
      {open && <div className="account-dropdown" role="menu">
        <div className="account-identity"><strong>{user.name}</strong><span>{user.email}</span></div>
        <Link role="menuitem" to="/profile" onClick={() => { setOpen(false); onAction() }}>Profile</Link>
        <Link role="menuitem" to="/my-applications" onClick={() => { setOpen(false); onAction() }}>My Applications</Link>
        {isAdmin && <Link role="menuitem" to="/admin" onClick={() => { setOpen(false); onAction() }}>Website admin</Link>}
        <button role="menuitem" type="button" onClick={() => { signOut(); onAction() }}>Log out <ArrowUpRight size={15} /></button>
        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
      </div>}
    </div>
  )
}
