import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { SiteLayout } from './components/SiteComponents'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import './App.css'

const Home = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Home })))
const About = lazy(() => import('./pages/Pages').then((module) => ({ default: module.About })))
const Programs = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Programs })))
const ProgramDetails = lazy(() => import('./pages/Pages').then((module) => ({ default: module.ProgramDetails })))
const Projects = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Projects })))
const ProjectDetails = lazy(() => import('./pages/Pages').then((module) => ({ default: module.ProjectDetails })))
const Events = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Events })))
const Team = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Team })))
const News = lazy(() => import('./pages/Pages').then((module) => ({ default: module.News })))
const ArticleDetails = lazy(() => import('./pages/Pages').then((module) => ({ default: module.ArticleDetails })))
const Gallery = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Gallery })))
const GetInvolved = lazy(() => import('./pages/Pages').then((module) => ({ default: module.GetInvolved })))
const Volunteer = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Volunteer })))
const Partnerships = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Partnerships })))
const Support = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Support })))
const Contact = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Contact })))
const PrivacyPolicy = lazy(() => import('./pages/Pages').then((module) => ({ default: module.PrivacyPolicy })))
const Terms = lazy(() => import('./pages/Pages').then((module) => ({ default: module.Terms })))
const NotFound = lazy(() => import('./pages/Pages').then((module) => ({ default: module.NotFound })))
const ApplicationsPage = lazy(() => import('./components/AuthComponents').then((module) => ({ default: module.ApplicationsPage })))
const ProfilePage = lazy(() => import('./components/AuthComponents').then((module) => ({ default: module.ProfilePage })))
const ResetPasswordPage = lazy(() => import('./components/AuthComponents').then((module) => ({ default: module.ResetPasswordPage })))
const AdminPage = lazy(() => import('./pages/AdminPage'))

const pageMetadata = {
  '/': ['Bwiza Youth Bridge | Youth Empowerment in Rwanda', 'Bwiza Youth Bridge creates space for girls, women, and young people in Rwanda to learn, grow, and shape a brighter future.'],
  '/about': ['About Bwiza Youth Bridge | Our Mission', 'Learn about Bwiza Youth Bridge, our mission, values, and community-centered approach to youth empowerment in Rwanda.'],
  '/programs': ['Programs | Bwiza Youth Bridge', 'Explore Bwiza Youth Bridge programs in leadership, education, wellbeing, and opportunity for young people in Rwanda.'],
  '/projects': ['Projects | Bwiza Youth Bridge', 'Discover community-centered project concepts from Bwiza Youth Bridge.'],
  '/events': ['Events | Bwiza Youth Bridge', 'Find upcoming events and opportunities to connect with Bwiza Youth Bridge.'],
  '/team': ['Our Team | Bwiza Youth Bridge', 'Meet the people working with Bwiza Youth Bridge to build connection and opportunity.'],
  '/news': ['News & Stories | Bwiza Youth Bridge', 'Read stories, reflections, and updates from the Bwiza Youth Bridge community.'],
  '/gallery': ['Gallery | Bwiza Youth Bridge', 'View moments of community, learning, and connection from Bwiza Youth Bridge.'],
  '/get-involved': ['Get Involved | Bwiza Youth Bridge', 'Explore thoughtful ways to volunteer, partner, and support Bwiza Youth Bridge.'],
  '/volunteer': ['Volunteer | Bwiza Youth Bridge', 'Learn how to explore volunteer opportunities with Bwiza Youth Bridge.'],
  '/partnerships': ['Partnerships | Bwiza Youth Bridge', 'Start a conversation about community-centered partnerships with Bwiza Youth Bridge.'],
  '/support': ['Support BYB | Bwiza Youth Bridge', 'Contact Bwiza Youth Bridge to discuss appropriate ways to support our work.'],
  '/contact': ['Contact | Bwiza Youth Bridge', 'Contact Bwiza Youth Bridge in Rwanda with questions about programs, volunteering, or partnerships.'],
  '/privacy': ['Privacy Policy | Bwiza Youth Bridge', 'Read the Bwiza Youth Bridge privacy information for website visitors and account holders.'],
  '/terms': ['Terms | Bwiza Youth Bridge', 'Read the terms for using the Bwiza Youth Bridge website.'],
  '/reset-password': ['Reset Password | Bwiza Youth Bridge', 'Choose a new password for your Bwiza Youth Bridge account using a valid reset link.'],
  '/profile': ['Profile | Bwiza Youth Bridge', 'Manage your Bwiza Youth Bridge account profile and password.'],
  '/my-applications': ['My Applications | Bwiza Youth Bridge', 'Review and manage your applications to Bwiza Youth Bridge programs and events.'],
  '/admin': ['Website Administration | Bwiza Youth Bridge', 'Manage published Bwiza Youth Bridge website content.'],
}

function PageMetadata() {
  const { pathname } = useLocation()
  const [title, description] = pageMetadata[pathname] || [
    pathname.match(/^\/(programs|projects|news)\/([^/]+)$/)
      ? `${pathname.split('/').pop().split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')} | Bwiza Youth Bridge`
      : 'Page Not Found | Bwiza Youth Bridge',
    'Explore Bwiza Youth Bridge programs, projects, and stories in Rwanda.',
  ]

  useEffect(() => {
    document.title = title
    let metaDescription = document.head.querySelector('meta[name="description"]')
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.name = 'description'
      document.head.append(metaDescription)
    }
    metaDescription.content = description
  }, [title, description])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PageMetadata />
        <AnimatePresence mode="wait">
          <Suspense fallback={<section className="account-state">Loading page…</section>}>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/programs" element={<Programs />} />
                <Route path="/programs/:slug" element={<ProgramDetails />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:slug" element={<ProjectDetails />} />
                <Route path="/events" element={<Events />} />
                <Route path="/team" element={<Team />} />
                <Route path="/news" element={<News />} />
                <Route path="/news/:slug" element={<ArticleDetails />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/get-involved" element={<GetInvolved />} />
                <Route path="/volunteer" element={<Volunteer />} />
                <Route path="/partnerships" element={<Partnerships />} />
                <Route path="/support" element={<Support />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/my-applications" element={<ProtectedRoute><ApplicationsPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </AnimatePresence>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
