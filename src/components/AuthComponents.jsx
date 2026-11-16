import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound, X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { api } from '../services/api'

export function LoginModalHost() {
  const { loginOpen, closeLogin } = useAuth()
  return <AnimatePresence>{loginOpen && <LoginModal key="auth-modal" onClose={closeLogin} />}</AnimatePresence>
}

function LoginModal({ onClose }) {
  const { login, register, getErrorMessage } = useAuth()
  const [mode, setMode] = useState('login')
  const [visiblePassword, setVisiblePassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const initialFocus = useRef(null)
  const dialog = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    initialFocus.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab' && dialog.current) {
        const focusable = [...dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')]
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus?.()
    }
  }, [onClose])

  useEffect(() => {
    initialFocus.current?.focus()
  }, [mode])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const form = new FormData(event.currentTarget)
    try {
      if (mode === 'login') {
        await login({
          email: form.get('email'),
          password: form.get('password'),
          rememberMe: form.get('rememberMe') === 'on',
        })
      } else if (mode === 'register') {
        await register({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        })
      } else {
        await api.post('/auth/forgot-password', { email: form.get('email') })
        setSuccess('If an account matches that email, reset instructions will be sent.')
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  function changeMode(next) {
    setMode(next)
    setError('')
    setSuccess('')
    setVisiblePassword(false)
  }

  const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset your password'

  return (
    <motion.div
      className="auth-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <motion.section
        ref={dialog}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        initial={{ opacity: 0, y: 20, scale: .98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: .98 }}
        transition={{ duration: .24, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <button className="auth-close" type="button" onClick={onClose} aria-label="Close sign in"><X size={20} /></button>
        <div className="auth-brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <span className="eyebrow">Bwiza Youth Bridge</span>
        <h2 id="auth-modal-title">{title}</h2>
        <p className="auth-intro">
          {mode === 'login' ? 'Sign in to stay connected with your applications and opportunities.' :
            mode === 'register' ? 'Join the BYB community and keep your opportunities in one place.' :
              'Enter your email and we’ll send password reset instructions if an account matches.'}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label className="auth-field"><span>Your name</span><span className="auth-input-wrap"><UserRound size={17} /><input ref={initialFocus} name="name" autoComplete="name" minLength="2" maxLength="120" placeholder="Your full name" required /></span></label>
          )}
          <label className="auth-field"><span>Email address</span><span className="auth-input-wrap"><Mail size={17} /><input ref={mode !== 'register' ? initialFocus : null} name="email" type="email" autoComplete="email" maxLength="254" placeholder="you@example.com" required /></span></label>
          {mode !== 'forgot' && (
            <label className="auth-field"><span>Password</span><span className="auth-input-wrap"><LockKeyhole size={17} /><input name="password" type={visiblePassword ? 'text' : 'password'} autoComplete="off" minLength="8" maxLength="72" placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} required /><button className="password-visibility" type="button" onClick={() => setVisiblePassword(!visiblePassword)} aria-label={visiblePassword ? 'Hide password' : 'Show password'}>{visiblePassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          )}
          {mode === 'login' && (
            <div className="auth-options"><label className="remember-option"><input type="checkbox" name="rememberMe" /> Remember me</label><button className="auth-text-button" type="button" onClick={() => changeMode('forgot')}>Forgot password?</button></div>
          )}
          {error && <p className="auth-message auth-error" role="alert">{error}</p>}
          {success && <p className="auth-message auth-success" role="status"><Check size={16} />{success}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="auth-spinner" size={17} /> Please wait…</> : <>{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'} <ArrowUpRight size={17} /></>}</button>
        </form>

        <div className="auth-switch">
          {mode === 'login' && <>New to BYB? <button type="button" onClick={() => changeMode('register')}>Create an account</button></>}
          {mode === 'register' && <>Already have an account? <button type="button" onClick={() => changeMode('login')}>Sign in</button></>}
          {mode === 'forgot' && <button type="button" onClick={() => changeMode('login')}>Back to sign in</button>}
        </div>
        <p className="auth-privacy">Your account is protected with secure, encrypted sign-in.</p>
      </motion.section>
    </motion.div>
  )
}

export function ProfilePage() {
  const { user, updateProfile, getErrorMessage } = useAuth()
  const [name, setName] = useState(user.name)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState('')
  const [passwordError, setPasswordError] = useState('')

  async function saveProfile(event) {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    setError('')
    try {
      await updateProfile({ name })
      setStatus('Profile updated.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    setPasswordBusy(true)
    setPasswordStatus('')
    setPasswordError('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.get('currentPassword'),
        newPassword: form.get('newPassword'),
      })
      formElement.reset()
      setPasswordStatus('Password changed successfully.')
    } catch (requestError) {
      setPasswordError(getErrorMessage(requestError))
    } finally {
      setPasswordBusy(false)
    }
  }

  return <section className="account-page section-wrap">
    <span className="eyebrow">Your account</span><h1>Profile settings</h1>
    <p className="account-email"><Mail size={16} />{user.email}</p>
    <form className="account-form" onSubmit={saveProfile}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="120" required /></label><button className="auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>{status && <p className="auth-message auth-success" role="status"><Check size={16} />{status}</p>}{error && <p className="auth-message auth-error" role="alert">{error}</p>}</form>
    <h2>Change password</h2>
    <form className="account-form" onSubmit={changePassword}><label>Current password<input name="currentPassword" type="password" autoComplete="off" required /></label><label>New password<input name="newPassword" type="password" autoComplete="off" minLength="8" maxLength="72" required /></label><button className="auth-submit" disabled={passwordBusy}>{passwordBusy ? 'Updating…' : 'Update password'}</button>{passwordStatus && <p className="auth-message auth-success" role="status"><Check size={16} />{passwordStatus}</p>}{passwordError && <p className="auth-message auth-error" role="alert">{passwordError}</p>}</form>
  </section>
}

export function ApplicationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function loadApplications() {
    try {
      const response = await api.get('/applications/my')
      setItems(response.data.items)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load applications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetching this protected resource is the page's initial external synchronization.
    // oxlint-disable-next-line react/set-state-in-effect
    loadApplications()
  }, [])

  async function withdraw(id) {
    setBusyId(String(id))
    try {
      await api.patch(`/applications/${id}/withdraw`)
      await loadApplications()
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not withdraw this application.')
    } finally {
      setBusyId('')
    }
  }

  return <section className="account-page section-wrap">
    <span className="eyebrow">Your account</span><h1>My applications</h1><p>Keep track of your submitted applications and their progress.</p>
    {loading && <p role="status">Loading your applications…</p>}
    {error && <p className="auth-message auth-error" role="alert">{error}</p>}
    {!loading && !error && !items.length && <div className="application-empty"><h2>No applications yet</h2><p>When you apply for a BYB program or event, you’ll find it here.</p><Link className="text-link" to="/programs">Explore programs <ArrowUpRight size={16} /></Link></div>}
    <div className="application-list">{items.map((item) => <article className="application-card" key={item.id}><div><span className="card-kicker">{item.program_title ? 'Program' : 'Event'}</span><h2>{item.program_title || item.event_title}</h2><p>Submitted {new Date(item.created_at).toLocaleDateString()}</p></div><div className="application-status"><span>{item.status}</span>{['submitted', 'reviewing'].includes(item.status) && <button type="button" disabled={busyId === String(item.id)} onClick={() => withdraw(item.id)}>{busyId === String(item.id) ? 'Withdrawing…' : 'Withdraw'}</button>}</div></article>)}</div>
  </section>
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      const response = await api.post('/auth/reset-password', { token, newPassword: form.get('password') })
      setMessage(response.data.message)
      formElement.reset()
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not reset your password.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="account-state"><span className="eyebrow">Account security</span><h1>Choose a new password</h1>
    {!token ? <p>This reset link is incomplete. Request a new one from the sign-in window.</p> :
      <form className="account-form" onSubmit={submit}><label>New password<input name="password" type="password" minLength="8" maxLength="72" autoComplete="off" required /></label><button className="auth-submit" disabled={busy}>{busy ? 'Updating…' : 'Reset password'}</button></form>}
    {message && <p className="auth-message auth-success" role="status"><Check size={16} />{message}</p>}
    {error && <p className="auth-message auth-error" role="alert">{error}</p>}
    <Link to="/" className="text-link">Return to the website</Link>
  </section>
}
