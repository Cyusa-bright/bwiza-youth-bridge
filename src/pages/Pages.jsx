import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, Check, ChevronLeft, ChevronRight, HeartHandshake, Lightbulb, Mail, Phone, Search, X } from 'lucide-react'
import {
  Button, ContactForm, GalleryGrid, NewsCard, NewsletterForm, PageHero,
  ProjectCard, Reveal, SectionHeading, TeamCard,
} from '../components/SiteComponents'
import { articles, galleryItems, galleryPreviewItems, photos, programs, projects, team } from '../data/content'
import { api } from '../services/api'
import { imageUrl } from '../services/media'

const homeContentDefaults = {
  heroTitle: 'Uniting Communities Through Service.',
  heroDescription: 'Bringing together young people from all backgrounds to create positive change in our neighborhoods and beyond.',
}

function usePublishedItems(resource, existingItems, mergeDefaults = false) {
  const [items, setItems] = useState(existingItems)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.get(`/${resource}`).then((response) => {
      if (!active) return
      const records = response.data.items.map((item) => {
        let points = item.details
        if (typeof points === 'string') {
          try { points = JSON.parse(points) } catch { points = [] }
        }
        return {
          ...item,
          description: item.description || item.summary || '',
          image: item.image || '',
          points: Array.isArray(item.points) ? item.points : Array.isArray(points) ? points : [],
        }
      })
      if (mergeDefaults) {
        const defaultsByName = new Map(existingItems.map((item) => [item.name.toLocaleLowerCase(), item]))
        const liveNames = new Set(records.map((item) => item.name?.toLocaleLowerCase()).filter(Boolean))
        const mergedRecords = records.map((item) => {
          const defaultItem = defaultsByName.get(item.name?.toLocaleLowerCase())
          return defaultItem ? { ...defaultItem, ...item, linkedin: item.linkedin || defaultItem.linkedin } : item
        })
        mergedRecords.push(...existingItems.filter((item) => !liveNames.has(item.name.toLocaleLowerCase())))
        setItems(mergedRecords)
      } else {
        setItems(records.length ? records : existingItems)
      }
      setError('')
    }).catch(() => {
      if (active) setError(`Live ${resource} content could not be loaded. Existing website content is shown where available.`)
    })
    return () => { active = false }
  }, [resource, existingItems, mergeDefaults])
  return { items, error }
}

function useSiteContent(key, fallback) {
  const [value, setValue] = useState(fallback)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.get('/site-content').then((response) => {
      const entry = response.data.items.find((item) => item.key === key)
      if (active && entry?.value && typeof entry.value === 'object' && !Array.isArray(entry.value)) {
        setValue(Object.fromEntries(
          Object.entries(fallback).map(([field, defaultValue]) => [
            field,
            typeof entry.value[field] === typeof defaultValue ? entry.value[field] : defaultValue,
          ]),
        ))
      }
      if (active) setError('')
    }).catch(() => {
      if (active) setError('Website content could not be loaded from the server.')
    })
    return () => { active = false }
  }, [key, fallback])
  return { value, error }
}

function ContentLoadNotice({ error }) {
  return error ? <p className="auth-message auth-error" role="status">{error}</p> : null
}

function CTASection() {
  return (
    <section className="cta-section">
      <div className="cta-orbit cta-orbit-one" /><div className="cta-orbit cta-orbit-two" />
      <div className="cta-inner">
        <span className="eyebrow eyebrow-light">The future is something we build together</span>
        <h2>There’s a place for you<br />in this story.</h2>
        <p>Bring your time, ideas, partnership, or voice. Small steps can open up big possibilities.</p>
        <div className="cta-actions"><Button to="/get-involved" variant="yellow">Find your way in</Button><Button to="/contact" variant="outline-light">Start a conversation</Button></div>
      </div>
    </section>
  )
}

function NewsletterBand() {
  return (
    <section className="newsletter-band">
      <div><span className="eyebrow">A note from our community</span><h2>Good things grow<br />when we stay connected.</h2><p>Newsletter sign-up is not available yet. Contact us for updates.</p></div>
      <NewsletterForm className="newsletter-light" />
    </section>
  )
}

function ProgramOverviewGrid({ items }) {
  return (
    <div className="home-program-grid">
      {items.map((program, i) => <Reveal key={program.title} delay={i * 0.1}>
        <article className="home-program-card">
          <img src={imageUrl(program.image)} alt={program.alt || ''} loading="lazy" />
          <div className="home-program-card-body">
            <span className="card-kicker">{program.category}</span>
            <h3><Link to={`/programs/${program.slug}`}>{program.title}</Link></h3>
            <p>{program.description}</p>
            <ul>{program.points.map((point) => <li key={point}>{point}</li>)}</ul>
          </div>
        </article>
      </Reveal>)}
    </div>
  )
}

export function Home() {
  const { items: livePrograms, error: programsError } = usePublishedItems('programs', programs)
  const { items: liveProjects, error: projectsError } = usePublishedItems('projects', projects)
  const { value: homeContent, error: homeContentError } = useSiteContent('home', homeContentDefaults)
  return (
    <div className="home-page">
      <section className="home-hero">
        <ContentLoadNotice error={homeContentError} />
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> Bwiza Youth Bridge</span>
          <h1>{homeContent.heroTitle}</h1>
          <p>{homeContent.heroDescription}</p>
          <div className="hero-actions"><Button to="/programs" variant="pink">Explore our programs</Button><Button to="/get-involved" variant="outline">Get involved</Button></div>
          <Link to="/contact" className="hero-contact-link">Have a question? Contact us <ArrowRight size={15} /></Link>
          <div className="hero-note"><span className="note-line" /><span>Hope grows when opportunity is shared.</span></div>
        </div>
        <div className="hero-art">
          <div className="hero-photo"><img src={photos.hero} alt="Young people gathered together in a bright community space" /></div>
          <div className="hero-sticker"><span>Ideas</span><span>meet</span><strong>opportunity</strong><ArrowDownRight size={24} /></div>
          <div className="hero-caption"><span className="caption-dot" /> A future with room for everyone</div>
          <span className="hero-art-shape" />
        </div>
        <div className="hero-bottom"><span>Learning · empowerment · community</span><span className="hero-scroll">Scroll to explore <ArrowRight size={14} /></span></div>
      </section>

      <section className="intro-section section-wrap">
        <Reveal className="intro-image-wrap"><img src={photos.community} alt="Community members sharing a moment together" /><span className="image-label">Stronger, together.</span></Reveal>
        <Reveal className="intro-copy" delay={0.12}>
          <span className="eyebrow">Who We Are · Founded in 2021</span>
          <h2>Building pathways for young people in Rwanda.</h2>
          <p className="large-copy">Bwiza Youth Bridge is a youth-led organization dedicated to supporting youth and adolescents in Rwanda through education, mentorship, skills development, and community development.</p>
          <p>We believe every young person has the potential to lead and create positive change. Through our programs, we nurture confident, socially responsible young leaders who can contribute meaningfully to their communities and society.</p>
          <Button to="/about" variant="outline">Our story</Button>
          <div className="mission-vision"><div><span>Our mission</span><p>Provide access to educational programs, mentorship, skill-building workshops, and community development projects.</p></div><div><span>Our vision</span><p>Confident, socially responsible young leaders driving positive change in their communities.</p></div></div>
        </Reveal>
      </section>

      <section className="programs-section section-wrap">
        <ContentLoadNotice error={programsError} />
        <Reveal className="section-topline"><SectionHeading eyebrow="Where we focus" title="Our Programs" text="We bring young people together to build confidence, skills, wellbeing, and positive change in their communities." /></Reveal>
        <ProgramOverviewGrid items={livePrograms} />
      </section>

      <section className="impact-section">
        <div className="impact-inner section-wrap">
          <Reveal><span className="eyebrow eyebrow-light">The change we’re here for</span><h2>Impact begins with<br />a chance to begin.</h2><p>We’re building a thoughtful approach to learning and community-led change. Verified impact figures will be shared here when available.</p><Button to="/about" variant="outline-light">Our approach</Button></Reveal>
          <Reveal className="impact-priorities" delay={0.15}>
            {[['Learning', 'Opening pathways to education, practical skills, and personal growth.'], ['Leadership', 'Making room for girls, women, and young people to shape decisions.'], ['Community', 'Building connections around locally shaped priorities and opportunity.']].map(([title, description]) => <div className="impact-priority" key={title}><span>{title}</span><p>{description}</p></div>)}
            <small>Verified impact information will be shared when available.</small>
          </Reveal>
        </div>
      </section>

      <section className="projects-section section-wrap">
        <ContentLoadNotice error={projectsError} />
        <Reveal className="section-topline"><SectionHeading eyebrow="From ideas to action" title="Projects with people at the heart." text="A glimpse of the kinds of community-led initiatives we hope to build and share." /><Button to="/projects" variant="outline">Explore projects</Button></Reveal>
        <div className="project-grid">{liveProjects.map((project, i) => <Reveal key={project.slug} delay={i * 0.1}><ProjectCard item={project} index={i} /></Reveal>)}</div>
      </section>

      <section className="approach-section">
        <div className="approach-photo"><img src={photos.hands} alt="Hands coming together in a gesture of support" loading="lazy" /><span>Listen first. Grow together.</span></div>
        <div className="approach-copy"><Reveal><span className="eyebrow">How we work</span><h2>Change is strongest when it starts with people.</h2><p>We listen, build trust, and create pathways that are shaped by the people who know their communities best.</p>
          <div className="approach-steps"><div><span>01</span><div><strong>Listen with care</strong><p>Start with lived experience, local knowledge, and shared priorities.</p></div></div><div><span>02</span><div><strong>Learn together</strong><p>Make room for curiosity, practical skills, and new confidence.</p></div></div><div><span>03</span><div><strong>Move forward together</strong><p>Connect people with opportunities to contribute and grow.</p></div></div></div>
          <Button to="/about" variant="text">More about our approach <ArrowRight size={16} /></Button>
        </Reveal></div>
      </section>

      <section className="news-section section-wrap">
        <Reveal className="section-topline"><SectionHeading eyebrow="Notes from the journey" title="Stories that bring us closer." text="Updates, ideas, and reflections from our community." /><Button to="/news" variant="outline">All stories</Button></Reveal>
        <div className="news-grid">{articles.map((article, i) => <Reveal key={article.slug} delay={i * 0.09}><NewsCard article={article} /></Reveal>)}</div>
      </section>

      <section className="gallery-preview section-wrap">
        <Reveal className="gallery-preview-head"><div><span className="eyebrow">A window into our world</span><h2>People. Moments.<br /><em>Possibilities.</em></h2></div><Button to="/gallery" variant="outline">Visit the gallery</Button></Reveal>
        <div className="home-photo-mosaic">
          {galleryPreviewItems.map((item, index) => <Link className={`home-photo-tile home-photo-tile-${index + 1}`} to="/gallery" key={item.title} aria-label={`Explore the gallery: ${item.title}`}>
            <img src={item.image} alt={item.title} loading="lazy" />
            <span>{item.title}<ArrowRight size={16} /></span>
          </Link>)}
        </div>
      </section>

      <section className="home-involvement section-wrap">
        <Reveal className="home-involvement-heading"><span className="eyebrow">Be part of what comes next</span><h2>There are many ways to help opportunity grow.</h2><p>Bring your time, ideas, or support. We’ll start with a conversation about what is useful to the community.</p></Reveal>
        <div className="home-involvement-grid">
          {[['01', 'Volunteer', 'Share your time and skills with care.', '/volunteer'], ['02', 'Partner with us', 'Explore shared goals and collaboration.', '/partnerships'], ['03', 'Support BYB', 'Ask about appropriate ways to support our work.', '/support']].map(([number, title, copy, path]) => <Link className="home-involvement-card" to={path} key={title}><span>{number}</span><h3>{title}</h3><p>{copy}</p><strong>Learn more <ArrowRight size={16} /></strong></Link>)}
        </div>
      </section>
      <CTASection />
      <NewsletterBand />
    </div>
  )
}

export function About() {
  const values = [
    ['Dignity', 'Every person deserves to be seen, heard, and respected.'],
    ['Inclusion', 'Belonging is built when different voices have room.'],
    ['Opportunity', 'Potential grows when pathways are open and accessible.'],
    ['Community', 'Trust, connection, and shared action make change last.'],
    ['Learning', 'We stay curious, reflective, and open to better ways.'],
    ['Hope', 'We hold space for a more positive future and work toward it.'],
  ]
  const objectives = [
    'Encourage education, personal development, and lifelong learning.',
    'Support leadership and meaningful participation for young people.',
    'Advance empowerment and opportunity for women and girls.',
    'Create connections that strengthen community-led action.',
    'Promote inclusion, wellbeing, and positive social change.',
  ]
  const approach = [
    ['Listen with care', 'Start with lived experience, local knowledge, and shared priorities.'],
    ['Learn together', 'Make room for curiosity, practical skills, and new confidence.'],
    ['Move forward together', 'Connect people with opportunities to contribute and grow.'],
  ]
  return (
    <>
      <PageHero eyebrow="About Bwiza Youth Bridge" title={<>A bridge to a future<br />with room for <em>everyone.</em></>} description="Bwiza Youth Bridge is a youth-centered organization based in Rwanda, focused on mentorship, skills development, entrepreneurship, and community building." image={photos.community} imageAlt="Community members sharing a moment together" />
      <section className="about-story-panel section-wrap">
        <Reveal className="about-story-visual">
          <img src={photos.group} alt="Young people gathered together in their community" loading="lazy" />
          <span>Learning, connection, and possibility.</span>
        </Reveal>
        <Reveal className="about-story-copy" delay={0.1}>
          <span className="eyebrow">About Us</span>
          <h2>Unlocking the potential of young people across Rwanda.</h2>
          <p>Bwiza Youth Bridge is a youth-centered organization based in Rwanda, focused on mentorship, skills development, entrepreneurship, and community building. We work with young people across Rwanda to unlock their potential and create pathways to a brighter future.</p>
          <h3>Our Story</h3>
          <p>Founded with a passion for youth empowerment, Bwiza Youth Bridge began as a small group of volunteers and has grown into a recognized youth organization trusted by communities and partners across the country.</p>
          <p>Our journey has been defined by hundreds of success stories—from young entrepreneurs launching their first businesses to youth gaining employable skills through our training programs. Each story fuels our commitment to building bridges between young people and their dreams.</p>
          <div className="about-background-note"><strong>Founded in 2021</strong><p>We are committed to creating real opportunities for young people in Rwanda.</p></div>
          <Button to="/programs" variant="outline">Explore our programs</Button>
        </Reveal>
      </section>
      <section className="about-mission-section">
        <div className="about-mission-inner section-wrap">
          <article><span>Our mission</span><h2>Make room for growth.</h2><p>Support youth and adolescents in Rwanda through educational programs, mentorship, skill-building workshops, and community development projects.</p></article>
          <article><span>Our vision</span><h2>A future with possibility.</h2><p>Communities where all people can participate, realize their potential, and thrive.</p></article>
        </div>
      </section>
      <section className="about-values-section section-wrap">
        <SectionHeading eyebrow="What guides us" title="Our values are how we show up." text="These principles shape how we listen, learn, and work alongside communities." />
        <div className="about-values-grid">{values.map(([title, text], i) => <Reveal className="about-value-card" key={title} delay={i * 0.05}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></Reveal>)}</div>
      </section>
      <section className="about-objectives-section section-wrap">
        <div><span className="eyebrow">Our objectives</span><h2>From good intention to shared progress.</h2></div>
        <ul className="about-objective-list">{objectives.map((objective) => <li key={objective}><Check size={18} />{objective}</li>)}</ul>
      </section>
      <section className="about-approach-section">
        <div className="about-approach-image"><img src={photos.hands} alt="Hands coming together in a gesture of support" loading="lazy" /></div>
        <div className="about-approach-copy">
          <span className="eyebrow">Our approach</span>
          <h2>Change is strongest when it starts with people.</h2>
          <p>We listen, build trust, and create pathways shaped by the people who know their communities best.</p>
          <ol>{approach.map(([title, description], i) => <li key={title}><span>0{i + 1}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>
          <Button to="/get-involved" variant="pink">Be part of the work</Button>
        </div>
      </section>
      <CTASection />
    </>
  )
}

export function Programs() {
  const [filter, setFilter] = useState('All')
  const { items, error } = usePublishedItems('programs', programs)
  const filters = ['All', ...new Set(items.map((program) => program.category).filter(Boolean))]
  const visible = filter === 'All' ? items : items.filter((program) => program.category === filter)
  return <><PageHero eyebrow="Our programs" title={<>Creating space<br />to learn, lead, and <em>thrive.</em></>} description="Explore Bwiza Youth Bridge’s programs for girls, youth, wellbeing, and community advocacy." image={photos.learning} /><section className="listing-section section-wrap"><ContentLoadNotice error={error} /><div className="filter-row"><span>Explore by focus</span><div>{filters.map((item) => <button key={item} className={filter === item ? 'filter-chip active' : 'filter-chip'} onClick={() => setFilter(item)}>{item}</button>)}</div></div><p className="listing-intro">Our programs connect young people with mentorship, learning, wellbeing, and opportunities to lead positive change in their communities.</p><ProgramOverviewGrid items={visible} /></section><CTASection /></>
}

function DetailPage({ item, kind }) {
  if (!item) return <NotFound />
  const isProgram = kind === 'program'
  return <><PageHero compact eyebrow={`${isProgram ? 'Program' : 'Project'} · ${item.category}`} title={item.title} description={item.description} image={imageUrl(item.image)} /><section className="detail-content section-wrap"><div className="detail-main"><span className="eyebrow">An invitation to grow</span>{isProgram ? <><h3>What this program includes</h3><ul className="check-list">{(item.points || []).map((point) => <li key={point}><Check /> {point}</li>)}</ul></> : <><h2>{item.description}</h2><p>This project is presented as an editable concept. Update the description, dates, locations, and outcomes when verified information is available.</p><h3>Project at a glance</h3><ul className="check-list"><li><Check /> Community-informed design</li><li><Check /> Opportunities for participation</li><li><Check /> Shared learning and reflection</li></ul></>}<div className="detail-note">Details on activities, locations, and participation are placeholders until confirmed by Bwiza Youth Bridge.</div><Button to={isProgram ? '/programs' : '/projects'} variant="outline">Back to {isProgram ? 'programs' : 'projects'}</Button></div><aside className="detail-aside"><img src={imageUrl(item.image)} alt="" /><span>People, purpose, possibility.</span><h3>Interested in learning more?</h3><p>Start a conversation with us about this area of work.</p><Button to="/contact" variant="dark">Contact us</Button></aside></section><CTASection /></>
}

export function ProgramDetails() {
  const { slug } = useParams()
  const { items } = usePublishedItems('programs', programs)
  return <DetailPage item={items.find((program) => program.slug === slug)} kind="program" />
}

export function Projects() {
  const { items, error } = usePublishedItems('projects', projects)
  return <><PageHero eyebrow="Our projects" title={<>Community ideas,<br />made possible <em>together.</em></>} description="Explore project concepts rooted in learning, empowerment, and community connection." image={photos.workshop} /><section className="listing-section section-wrap"><ContentLoadNotice error={error} /><SectionHeading eyebrow="Ideas in motion" title="A starting point for shared action." text="These project pages are placeholders for verified initiatives. Add approved updates, details, and outcomes as they become available." /><div className="project-grid project-grid-list">{items.map((item, i) => <ProjectCard key={item.slug} item={item} index={i} />)}</div></section><CTASection /></>
}

export function ProjectDetails() {
  const { slug } = useParams()
  const { items } = usePublishedItems('projects', projects)
  return <DetailPage item={items.find((project) => project.slug === slug)} kind="project" />
}

export function Team() {
  const { items, error } = usePublishedItems('team', team, true)
  return <><PageHero eyebrow="Our team" title={<>Good work begins<br />with <em>good people.</em></>} description="Meet the people leading Bwiza Youth Bridge and its communications." image={photos.group} /><section className="team-page-section section-wrap"><ContentLoadNotice error={error} /><SectionHeading eyebrow="The people behind the work" title="Meet our team." text="Learn more about Bwiza Youth Bridge's founder and marketing director." /><div className="team-grid team-grid-large">{items.map((person, i) => <TeamCard key={person.id || `${person.role}-${i}`} person={person} />)}</div></section><CTASection /></>
}

export function Events() {
  const { items, error } = usePublishedItems('events', [])
  return <><PageHero eyebrow="Events" title={<>Gather, learn,<br />and grow <em>together.</em></>} description="Find upcoming opportunities to connect with Bwiza Youth Bridge." image={photos.community} /><section className="listing-section section-wrap"><ContentLoadNotice error={error} /><SectionHeading eyebrow="What’s happening" title="Upcoming events" text="Events published by Bwiza Youth Bridge appear here." />{items.length ? <div className="project-grid project-grid-list">{items.map((item) => <article className="project-card" key={item.id}><img className="card-image" src={imageUrl(item.image)} alt="" /><span className="card-kicker">{item.category}</span><h3>{item.title}</h3><p>{item.description}</p><p>{item.date ? new Date(item.date).toLocaleString() : ''}{item.location ? ` · ${item.location}` : ''}</p></article>)}</div> : !error && <p>No events are currently published.</p>}</section><CTASection /></>
}

export function News() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const categoriesList = ['All', ...new Set(articles.map((article) => article.category))]
  const filtered = useMemo(() => articles.filter((article) => (category === 'All' || article.category === category) && `${article.title} ${article.excerpt} ${article.category}`.toLowerCase().includes(query.toLowerCase())), [category, query])
  return <><PageHero eyebrow="News & stories" title={<>Stories of learning,<br />hope, and <em>possibility.</em></>} description="Ideas and updates from across our community — the good things that happen when we grow together." image={photos.community} /><section className="news-listing section-wrap"><div className="news-controls"><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stories" aria-label="Search stories" /></label><div className="filter-tabs">{categoriesList.map((item) => <button key={item} onClick={() => setCategory(item)} className={category === item ? 'active' : ''}>{item}</button>)}</div></div><div className="news-grid news-grid-list">{filtered.map((article, i) => <NewsCard key={article.slug} article={article} featured={i === 0} />)}</div>{filtered.length === 0 && <div className="empty-state"><Search size={22} /><p>No stories match your search yet.</p><button className="text-link" onClick={() => { setQuery(''); setCategory('All') }}>Clear filters</button></div>}</section><NewsletterBand /></>
}

export function ArticleDetails() {
  const { slug } = useParams()
  const article = articles.find((item) => item.slug === slug)
  if (!article) return <NotFound />
  return <><PageHero compact eyebrow={`${article.category} · ${article.date}`} title={article.title} description={article.excerpt} image={article.image} /><article className="article-content"><span className="eyebrow">A note from Bwiza Youth Bridge</span><p className="article-lead">{article.excerpt}</p><p>This article page is an editable placeholder, ready for an approved story from Bwiza Youth Bridge. Add the full article, author credit, publication date, and any related links when those details are available.</p><p>We believe that sharing thoughtful stories can help make space for learning, connection, and positive change. Thank you for being part of the conversation.</p><div className="article-author"><span className="author-mark">BYB</span><span><strong>Bwiza Youth Bridge</strong><small>Author information to be confirmed</small></span></div><Link to="/news" className="text-link"><ArrowRight className="rotate-arrow" size={16} /> Back to all stories</Link></article><CTASection /></>
}

export function Gallery() {
  const [visibleCount, setVisibleCount] = useState(8)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const closeButtonRef = useRef(null)
  const dialogRef = useRef(null)
  const triggerButtonRef = useRef(null)
  const visibleItems = galleryItems.slice(0, visibleCount)
  const isLightboxOpen = selectedIndex !== null
  const selected = isLightboxOpen ? visibleItems[selectedIndex] : null

  useEffect(() => {
    if (!isLightboxOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      triggerButtonRef.current?.focus()
    }
  }, [isLightboxOpen])

  function move(direction) {
    setSelectedIndex((index) => (index + direction + visibleItems.length) % visibleItems.length)
  }

  function handleLightboxKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setSelectedIndex(null)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'Tab') {
      const buttons = dialogRef.current?.querySelectorAll('button:not([disabled])')
      if (!buttons?.length) return
      const firstButton = buttons[0]
      const lastButton = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault()
        lastButton.focus()
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault()
        firstButton.focus()
      }
    }
  }

  return <>
    <header className="gallery-intro section-wrap">
      <div>
        <span className="eyebrow">Bwiza Youth Bridge · Gallery</span>
        <h1>Small moments.<br />Shared <em>possibility.</em></h1>
        <p>Stories of learning, service, and connection from across our community.</p>
      </div>
      <div className="gallery-intro-note">
        <span className="eyebrow">Our community, in focus</span>
        <p>People <span>·</span> Learning <span>·</span> Connection</p>
      </div>
    </header>
    <section className="gallery-page section-wrap" aria-label="Community photo gallery">
      <div className="gallery-toolbar">
        <p>Selected moments from our community</p>
        <span className="gallery-count" aria-live="polite">{visibleItems.length} of {galleryItems.length} photos</span>
      </div>
      <GalleryGrid items={visibleItems} onSelect={(index, button) => {
        triggerButtonRef.current = button
        setSelectedIndex(index)
      }} />
      {visibleItems.length < galleryItems.length && <div className="gallery-more">
        <button type="button" className="button button-outline" onClick={() => setVisibleCount((count) => Math.min(count + 4, galleryItems.length))}>
          Load more moments
          <ArrowDownRight size={16} />
        </button>
      </div>}
    </section>
    {selected && <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={selected.title}
      onClick={(event) => {
        if (event.target === event.currentTarget) setSelectedIndex(null)
      }}
      onKeyDown={handleLightboxKeyDown}
      ref={dialogRef}
      tabIndex={-1}
    >
      <button ref={closeButtonRef} className="lightbox-close" onClick={() => setSelectedIndex(null)} aria-label="Close image preview"><X /></button>
      <button className="lightbox-prev" onClick={() => move(-1)} aria-label="Previous image"><ChevronLeft /></button>
      <figure onClick={(event) => event.stopPropagation()}>
        <img src={selected.image} alt={selected.alt} width={selected.width} height={selected.height} decoding="async" />
        <figcaption><strong>{selected.title}</strong><span>{selectedIndex + 1} of {visibleItems.length}</span></figcaption>
      </figure>
      <button className="lightbox-next" onClick={() => move(1)} aria-label="Next image"><ChevronRight /></button>
    </div>}
  </>
}

export function GetInvolved() {
  return <><PageHero eyebrow="Get involved" title={<>Your time. Your voice.<br />A world of <em>possibility.</em></>} description="There are many ways to be part of a future where girls, women, and young people can thrive." image={photos.hands} /><section className="involved-grid section-wrap">{[['Volunteer with care', 'Share your time, skills, and curiosity. Explore ways to contribute alongside communities.', 'Explore volunteering', 'pink', HeartHandshake, '/volunteer'], ['Build a partnership', 'Bring your organization, network, or expertise to a conversation about shared goals.', 'Explore partnerships', 'blue', Lightbulb, '/partnerships'], ['Support our work', 'Help create room for learning, opportunity, and community-led change.', 'Ways to support', 'yellow', HeartHandshake, '/support']].map(([title, copy, link, color, Icon, path]) => <article className={`involved-card involved-${color}`} key={title}><span className="involved-icon"><Icon size={24} /></span><span className="eyebrow">A way to connect</span><h2>{title}</h2><p>{copy}</p><Button to={path} variant="outline">{link}</Button></article>)}</section><section className="involved-note section-wrap"><span className="eyebrow">Start where you are</span><h2>Thoughtful action starts with a conversation.</h2><p>Whether you have time to share, an idea to explore, or a resource to offer, we welcome a conversation about what could be useful to the community.</p><Button to="/contact" variant="dark">Talk with us</Button></section><CTASection /></>
}

export function Volunteer() {
  return <>
    <PageHero eyebrow="Volunteer" title={<>Bring your skills.<br />Make room to <em>grow.</em></>} description="Volunteers can contribute time, experience, and care to community-led learning and opportunity." image={photos.learning} />
    <section className="about-story section-wrap">
      <Reveal><span className="eyebrow">Share your time</span><h2>Good volunteering starts with listening.</h2></Reveal>
      <Reveal className="about-prose" delay={0.1}><p>We welcome people who want to contribute thoughtfully alongside girls, women, young people, and their communities.</p><p>Potential areas of contribution may include learning support, mentorship, communications, event support, or professional skills. Specific roles, schedules, and locations depend on confirmed organizational needs.</p><p>We aim to match volunteer contributions with community priorities, clear expectations, and a respectful, inclusive approach.</p></Reveal>
    </section>
    <section className="values-section section-wrap">
      <SectionHeading eyebrow="Taking the next step" title="Start with a conversation." text="Tell us what you are interested in and what you could offer. We will follow up when an appropriate opportunity is available." />
      <div className="support-options">
        {[
          ['01', 'Share your interests', 'Let us know the causes, communities, or activities you care about.'],
          ['02', 'Explore a good fit', 'Discuss your skills, availability, and the organization’s current needs.'],
          ['03', 'Contribute with care', 'Agree on a clear role and work together with respect and purpose.'],
        ].map(([number, title, copy]) => <article className="support-option" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
      </div>
      <p className="page-disclaimer">Volunteer positions are not currently listed on this website. Please contact us to ask about opportunities; submitting an inquiry does not guarantee placement.</p>
      <Button to="/contact" variant="pink">Ask about volunteering</Button>
    </section>
    <section className="involved-note section-wrap"><span className="eyebrow">Another way to contribute</span><h2>Looking to collaborate as an organization?</h2><p>Explore a partnership with Bwiza Youth Bridge and find a thoughtful way to work toward shared goals.</p><Button to="/partnerships" variant="outline">Explore partnerships</Button></section>
  </>
}

export function Partnerships() {
  return <>
    <PageHero eyebrow="Partnerships" title={<>Better futures are<br />built <em>together.</em></>} description="We welcome conversations with organizations and people interested in thoughtful, community-centered collaboration." image={photos.community} />
    <section className="about-story section-wrap">
      <Reveal><span className="eyebrow">Working together</span><h2>Shared purpose. Community-led progress.</h2></Reveal>
      <Reveal className="about-prose" delay={0.1}><p>Partnerships can connect people, ideas, knowledge, and resources in service of opportunity for girls, women, and young people.</p><p>We are open to exploring collaboration with community groups, educational organizations, nonprofits, and other partners whose goals and values align with our work.</p><p>Every partnership begins with listening and a conversation about community priorities, practical contributions, and shared expectations.</p></Reveal>
    </section>
    <section className="mission-band"><div className="mission-grid"><article><span>01 / Share</span><h2>Bring your perspective.</h2><p>Share relevant experience, local knowledge, networks, or expertise.</p></article><article><span>02 / Build</span><h2>Find common ground.</h2><p>Explore an approach that is useful, respectful, and shaped around real needs.</p></article></div></section>
    <section className="values-section section-wrap">
      <SectionHeading eyebrow="A thoughtful first step" title="Let’s explore what’s possible." text="We would be glad to hear about your organization, what brings you here, and the kind of collaboration you have in mind." />
      <Button to="/contact" variant="pink">Start a partnership conversation</Button>
    </section>
    <section className="involved-note section-wrap"><span className="eyebrow">Contribute as an individual</span><h2>There is a place for your time and skills, too.</h2><p>Learn more about contributing as a volunteer.</p><Button to="/volunteer" variant="outline">Explore volunteering</Button></section>
  </>
}

export function Support() {
  return <>
    <PageHero eyebrow="Donate / Support us" title={<>Help possibility<br /><em>take root.</em></>} description="Your encouragement and support can help strengthen opportunities for girls, women, young people, and their communities." image={photos.hands} />
    <section className="about-story section-wrap">
      <Reveal><span className="eyebrow">Support our work</span><h2>Many contributions can help a community move forward.</h2></Reveal>
      <Reveal className="about-prose" delay={0.1}><p>We appreciate the people and organizations who want to help Bwiza Youth Bridge create more room for learning, connection, and opportunity.</p><p>Support may take different forms: sharing skills or time, introducing a potential partner, helping others learn about the work, or discussing a financial contribution through a verified organizational channel.</p><p>We do not accept online donations through this website. No payment details should be submitted here. Contact us directly to discuss appropriate ways to support and to confirm official giving information.</p></Reveal>
    </section>
    <section className="values-section section-wrap">
      <SectionHeading eyebrow="Ways to support" title="Start with the contribution that fits." text="We welcome a conversation about what would be useful and appropriate." />
      <div className="support-options">
        {[
          ['01', 'Share your skills', 'Offer time or expertise that matches community and organizational priorities.'],
          ['02', 'Build a connection', 'Introduce a potential collaborator or help strengthen a community relationship.'],
          ['03', 'Discuss giving', 'Ask us for verified information before making any financial contribution.'],
        ].map(([number, title, copy]) => <article className="support-option" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
      </div>
      <div className="page-disclaimer">For your safety, only use donation details confirmed through Bwiza Youth Bridge’s official communication channels. This website does not process payments.</div>
      <Button to="/contact" variant="pink">Ask how to support</Button>
    </section>
    <section className="involved-note section-wrap"><span className="eyebrow">Share your time</span><h2>Interested in volunteering?</h2><p>Find out more about contributing your time and skills.</p><Button to="/volunteer" variant="outline">Explore volunteering</Button></section>
  </>
}

export function Contact() {
  return <><PageHero eyebrow="Contact us" title={<>Let’s start a<br /><em>conversation.</em></>} description="Have a question, an idea, or want to explore how to get involved? We’d love to hear from you." image="/images/DSC01145.webp" imageAlt="A community group gathered outside a painted building." /><section className="contact-section section-wrap"><div className="contact-details"><span className="eyebrow">Reach out</span><h2>There’s always room for a hello.</h2><p>Contact Bwiza Youth Bridge in Kigali, Rwanda, or Ntarama, Bugesera, Rwanda.</p><div className="contact-detail"><span><Mail size={18} /></span><div><small>Email Us</small><strong>bwizayouthbridge@gmail.com</strong></div></div><div className="contact-detail"><span><Phone size={18} /></span><div><small>Call Us</small><strong>+250 798 974 299</strong></div></div><div className="contact-detail"><span><ArrowDownRight size={18} /></span><div><small>Kigali, Rwanda</small><strong>Kigali, Rwanda</strong></div></div><div className="contact-detail"><span><ArrowDownRight size={18} /></span><div><small>Ntarama, Bugesera, Rwanda</small><strong>Ntarama, Bugesera, Rwanda</strong></div></div><div className="map-placeholder"><span className="map-lines" /><span className="map-pin"><ArrowDownRight size={20} /></span><strong>Kigali, Rwanda · Ntarama, Bugesera, Rwanda</strong><small>Bwiza Youth Bridge locations</small></div></div><div className="contact-form-panel"><span className="eyebrow">Send us a note</span><h2>What’s on your mind?</h2><ContactForm /></div></section><CTASection /></>
}

function LegalPage({ title, eyebrow, intro, sections }) {
  return <><PageHero compact eyebrow={eyebrow} title={title} description={intro} /><article className="legal-content"><div className="legal-notice">Editable template — have this policy reviewed and replace all placeholders before publishing.</div>{sections.map(([heading, copy]) => <section key={heading}><h2>{heading}</h2><p>{copy}</p></section>)}</article></>
}

export function PrivacyPolicy() {
  return <LegalPage eyebrow="Legal" title="Privacy policy" intro="This draft explains where the privacy policy will live. It is not legal advice and must be completed and reviewed before publication." sections={[[ 'Information we collect', 'Replace this section with an accurate description of the personal information Bwiza Youth Bridge collects, the purposes for collection, and the lawful basis for processing.' ], [ 'How information is used', 'Describe how submitted information is used, how long it is retained, and any service providers or other parties that may receive it.' ], [ 'Your choices and rights', 'Add the rights available to visitors, how they can make a request, and the verified contact channel for privacy questions.' ], [ 'Cookies and website analytics', 'Explain any cookies, analytics, embedded media, or other tracking technologies used on the live website.' ], [ 'Contact and updates', 'Add the responsible organization details, applicable jurisdiction, effective date, and process for updating this policy.' ]]} />
}

export function Terms() {
  return <LegalPage eyebrow="Legal" title="Terms & conditions" intro="This draft is a placeholder for the terms that govern use of the Bwiza Youth Bridge website." sections={[[ 'Using this website', 'Set out the permitted uses of the website, visitor responsibilities, and any age or access requirements.' ], [ 'Website content', 'Describe ownership, permissions, attribution, and appropriate reuse of text, images, and other materials.' ], [ 'External links', 'Explain that external links may lead to services outside the organization’s control and describe how they are provided.' ], [ 'Disclaimer and liability', 'Add terms appropriate to the organization and the governing law after professional legal review.' ], [ 'Changes and contact', 'Add an effective date, how terms may be updated, and a verified contact channel for questions.' ]]} />
}

export function NotFound() {
  return <section className="not-found"><span className="eyebrow">404 · Page not found</span><div className="not-found-number">04<span>04</span></div><h1>This path has taken a little detour.</h1><p>The page you’re looking for may have moved, or it may not be here yet.</p><Button to="/" variant="pink">Back to the beginning</Button></section>
}
