import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, Menu,
  X, Mail, MapPin, Phone,
} from 'lucide-react'
import { AuthNav } from './AuthNav'
import { api } from '../services/api'
import { imageUrl } from '../services/media'

const LoginModalHost = lazy(() => import('./AuthComponents').then((module) => ({ default: module.LoginModalHost })))

const currentYear = new Date().getFullYear()

export function Button({ to, href, children, variant = 'dark', className = '', ...props }) {
  const classes = `button button-${variant} ${className}`.trim()
  const content = <>{children}<ArrowUpRight size={16} strokeWidth={1.8} /></>
  if (to) return <Link className={classes} to={to} {...props}>{content}</Link>
  if (href) return <a className={classes} href={href} {...props}>{content}</a>
  return <button className={classes} {...props}>{content}</button>
}

export function SectionHeading({ eyebrow, title, text, light = false, centered = false }) {
  return (
    <div className={`section-heading${light ? ' section-heading-light' : ''}${centered ? ' centered' : ''}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  )
}

export function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function ProgramCard({ item }) {
  return (
    <article className="program-card">
      <Link to={`/programs/${item.slug}`} className="card-image-link" aria-label={`Learn about ${item.title}`}>
        <img src={imageUrl(item.image)} alt="" className="card-image" loading="lazy" />
        <span className={`program-number number-${item.color}`}>{item.number}</span>
      </Link>
      <div className="program-card-body">
        <span className="card-kicker">{item.category}</span>
        <h3><Link to={`/programs/${item.slug}`}>{item.title}</Link></h3>
        <p>{item.description}</p>
        <Link className="text-link" to={`/programs/${item.slug}`}>Explore program <ArrowRight size={15} /></Link>
      </div>
    </article>
  )
}

export function ProjectCard({ item, index = 0 }) {
  return (
    <article className={`project-card project-card-${index % 3}`}>
      <Link to={`/projects/${item.slug}`} className="project-image">
        <img src={imageUrl(item.image)} alt="" loading="lazy" />
        <span className="image-arrow"><ArrowUpRight size={20} /></span>
      </Link>
      <span className="card-kicker">{item.category}</span>
      <h3><Link to={`/projects/${item.slug}`}>{item.title}</Link></h3>
      <p>{item.description}</p>
    </article>
  )
}

export function TeamCard({ person }) {
  const initials = person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <article className="team-card">
      <div className="team-image">{person.image ? <img src={imageUrl(person.image)} alt="" loading="lazy" /> : <span className="team-image-initials" aria-hidden="true">{initials}</span>}</div>
      <h3>{person.name}</h3>
      <p className="team-role">{person.role}</p>
      <p className="team-bio">{person.bio}</p>
      {person.linkedin && <a className="team-link" href={person.linkedin} target="_blank" rel="noreferrer">LinkedIn profile</a>}
    </article>
  )
}

export function NewsCard({ article, featured = false }) {
  return (
    <article className={`news-card${featured ? ' news-card-featured' : ''}`}>
      <Link to={`/news/${article.slug}`} className="news-image">
        <img src={article.image} alt="" loading="lazy" />
        <span className="image-arrow"><ArrowUpRight size={20} /></span>
      </Link>
      <div className="news-card-content">
        <div className="news-meta"><span>{article.category}</span><span>{article.date}</span></div>
        <h3><Link to={`/news/${article.slug}`}>{article.title}</Link></h3>
        <p>{article.excerpt}</p>
        <Link className="text-link" to={`/news/${article.slug}`}>Read story <ArrowRight size={15} /></Link>
      </div>
    </article>
  )
}

export function GalleryGrid({ items, onSelect }) {
  return (
    <div className="gallery-grid gallery-grid-editorial">
      {items.map((item, index) => (
        <button
          key={item.image}
          type="button"
          className={`gallery-tile${index === 0 ? ' gallery-tile-featured' : ''}`}
          onClick={(event) => onSelect(index, event.currentTarget)}
          aria-label={`Open image preview: ${item.title}`}
        >
          <img
            src={item.thumbnail}
            srcSet={item.srcSet}
            sizes={index === 0
              ? '(min-width: 1100px) 50vw, (min-width: 761px) 50vw, 100vw'
              : '(min-width: 1100px) 25vw, (min-width: 761px) 25vw, 50vw'}
            alt={item.alt}
            width={item.width}
            height={item.height}
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            decoding="async"
          />
          <span className="gallery-caption"><strong>{item.title}</strong></span>
          <span className="gallery-open" aria-hidden="true"><ArrowUpRight size={18} /></span>
        </button>
      ))}
    </div>
  )
}

export function TestimonialCard() {
  return (
    <figure className="testimonial-card">
      <span className="sample-label">Sample testimonial · replace with approved quote</span>
      <blockquote>“When young people are listened to and supported, new possibilities open up for everyone.”</blockquote>
      <figcaption><span className="testimonial-avatar">BY</span><span><strong>Community voice</strong><small>Illustrative placeholder</small></span></figcaption>
    </figure>
  )
}

export function PartnerSection() {
  return (
    <div className="partner-strip">
      <p>In good company</p>
      <div className="partner-placeholders" aria-label="Partner placeholders">
        <span>Partner logo</span><span>Partner logo</span><span>Partner logo</span><span>Partner logo</span>
      </div>
      <small>Placeholder names and marks — add approved partners only.</small>
    </div>
  )
}

export function NewsletterForm({ className = '' }) {
  return (
    <div className={`newsletter-form newsletter-unavailable ${className}`.trim()}>
      <p role="status">Newsletter sign-up is not available yet. Contact us for updates.</p>
      <Link to="/contact">Contact us</Link>
      <small>We will not collect your email until newsletter delivery is configured.</small>
    </div>
  )
}

export function LoadingSpinner({ label = 'Loading' }) {
  return <div className="loading-state" role="status"><span className="loading-spinner" /><span>{label}</span></div>
}

export function ContactForm() {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setSent(false)
    setError('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await api.post('/contact-messages', {
        name: form.get('name'),
        email: form.get('email'),
        subject: form.get('subject'),
        message: form.get('message'),
      })
      formElement.reset()
      setSent(true)
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Your message could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="form-row">
        <label>Your name<input name="name" autoComplete="name" placeholder="Name" required /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
      </div>
      <label>What would you like to talk about?
        <select name="subject" defaultValue="" required>
          <option value="" disabled>Select a topic</option>
          <option>Programs</option><option>Volunteering</option><option>Partnership</option><option>Other</option>
        </select>
      </label>
      <label>Your message<textarea name="message" rows="5" placeholder="Write your message..." required /></label>
      <button className="button button-pink" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'} <ArrowUpRight size={16} /></button>
      {sent && <p className="form-success" role="status"><Check size={16} /> Thanks for reaching out. Your message has been received.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const links = [
    ['About', '/about'], ['Programs', '/programs'], ['Projects', '/projects'], ['Events', '/events'],
    ['News', '/news'], ['Gallery', '/gallery'], ['Contact', '/contact'],
  ]
  return (
    <>
      <div className="topline"><span>Making room for possibility.</span><span>Girls · Women · Youth</span></div>
      <header className="site-header">
        <div className="nav-inner">
          <Link className="brand" to="/" aria-label="Bwiza Youth Bridge home" onClick={() => setOpen(false)}>
            <span className="brand-symbol"><span /><span /><span /></span>
            <span className="brand-name">bwiza<span>youth bridge</span></span>
          </Link>
          <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
          <nav className={`main-nav${open ? ' nav-open' : ''}`} aria-label="Main navigation">
            {links.map(([label, path]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}>{label}</NavLink>)}
            <AuthNav onAction={() => setOpen(false)} />
            <Link to="/get-involved" className="nav-cta" onClick={() => setOpen(false)}>Get involved <ArrowUpRight size={15} /></Link>
          </nav>
        </div>
      </header>
      <Suspense fallback={null}><LoginModalHost /></Suspense>
    </>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="brand brand-light" to="/">
            <span className="brand-symbol"><span /><span /><span /></span>
            <span className="brand-name">bwiza<span>youth bridge</span></span>
          </Link>
          <p>Empowering youth through education and leadership.</p>
          <div className="social-links" aria-label="Social profiles">
            <a href="https://www.linkedin.com/in/bwiza-youth-bridge-organization-6b9b2841a/" target="_blank" rel="noreferrer" aria-label="Bwiza Youth Bridge on LinkedIn"><span aria-hidden="true">in</span></a>
          </div>
          <small className="social-placeholder-note">Connect with Bwiza Youth Bridge on LinkedIn</small>
        </div>
        <div className="footer-column"><strong>Explore</strong><Link to="/about">About us</Link><Link to="/programs">Our programs</Link><Link to="/projects">Our projects</Link><Link to="/events">Events</Link><Link to="/team">Our team</Link><Link to="/news">News & blog</Link><Link to="/gallery">Gallery</Link></div>
        <div className="footer-column"><strong>Get involved</strong><Link to="/get-involved">Ways to get involved</Link><Link to="/volunteer">Volunteer</Link><Link to="/partnerships">Partnerships</Link><Link to="/support">Donate / support us</Link><Link to="/contact">Contact us</Link></div>
        <div className="footer-column footer-contact"><strong>Say hello</strong><span><Mail size={15} /> bwizayouthbridge@gmail.com</span><span><Phone size={15} /> +250 798 974 299</span><span><MapPin size={15} /> Kigali, Rwanda · Ntarama, Bugesera, Rwanda</span></div>
      </div>
      <div className="footer-bottom">
        <span>© {currentYear} Bwiza Youth Bridge. All rights reserved.</span>
        <div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><span>Website content is editable placeholder copy.</span></div>
      </div>
    </footer>
  )
}

export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export function SiteLayout() {
  return <><ScrollToTop /><Navbar /><main><Outlet /></main><Footer /></>
}

export function PageHero({ eyebrow = 'Bwiza Youth Bridge', title, description, image, imageAlt = '', compact = false }) {
  return (
    <section className={`page-hero${compact ? ' page-hero-compact' : ''}`}>
      <div className="page-hero-copy">
        <span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}
      </div>
      {image && <div className="page-hero-image"><img src={image} alt={imageAlt} /><span className="image-note">People · possibility · shared futures</span></div>}
      {!compact && <ArrowDown className="page-hero-arrow" size={20} />}
    </section>
  )
}
