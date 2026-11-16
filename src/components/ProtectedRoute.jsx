import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { api } from '../services/api'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading, openLogin } = useAuth()
  const [adminCheck, setAdminCheck] = useState(requireAdmin ? null : true)

  useEffect(() => {
    if (!requireAdmin || !user) {
      setAdminCheck(requireAdmin ? false : true)
      return
    }

    let active = true
    api.get('/admin/access').then((response) => {
      if (active) setAdminCheck(response.data.isAdmin === true)
    }).catch(() => {
      if (active) setAdminCheck(false)
    })

    return () => { active = false }
  }, [requireAdmin, user])

  if (loading) return <section className="account-state"><LoaderCircle className="auth-spinner" /><p>Checking your account…</p></section>
  if (!user) return <section className="account-state"><span className="eyebrow">Member account</span><h1>Sign in to continue</h1><p>This area is available to signed-in BYB members.</p><button className="auth-submit" type="button" onClick={openLogin}>Sign in <ArrowUpRight size={17} /></button></section>
  if (requireAdmin && adminCheck === null) {
    return <section className="account-state"><LoaderCircle className="auth-spinner" /><p>Checking admin access…</p></section>
  }
  if (requireAdmin && adminCheck === false) {
    return <section className="account-state"><span className="eyebrow">Administrator access</span><h1>Admin permissions required</h1><p>Your account is signed in, but it does not have administrator access.</p></section>
  }
  return children
}
