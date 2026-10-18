import { useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BackToTop } from '@/components/layout/BackToTop'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CookieNotice } from '@/components/layout/CookieNotice'
import { PortalShell } from '@/components/portal/PortalShell'
import { ScrollContext } from '@/context/ScrollContext'
import { scrollPageTo, useLenis } from '@/hooks/useLenis'
import Announcement from '@/pages/Announcement'
import AnnouncementFormPage from '@/pages/dashboard/AnnouncementFormPage'
import AnnouncementsAdmin from '@/pages/dashboard/AnnouncementsAdmin'
import CalendarAdmin from '@/pages/dashboard/CalendarAdmin'
import CalendarEventFormPage from '@/pages/dashboard/CalendarEventFormPage'
import DashboardHome from '@/pages/dashboard/DashboardHome'
import ProjectFormPage from '@/pages/dashboard/ProjectFormPage'
import ProjectsAdmin from '@/pages/dashboard/ProjectsAdmin'
import CouncilMemberFormPage from '@/pages/dashboard/CouncilMemberFormPage'
import CouncilMembersAdmin from '@/pages/dashboard/CouncilMembersAdmin'
import AboutAdmin from '@/pages/dashboard/AboutContentAdmin'
import AboutContentFormPage from '@/pages/dashboard/AboutContentFormPage'
import DocumentFormPage from '@/pages/dashboard/DocumentFormPage'
import DocumentsAdmin from '@/pages/dashboard/DocumentsAdmin'
import FaqAdmin from '@/pages/dashboard/FaqAdmin'
import FaqFormPage from '@/pages/dashboard/FaqFormPage'
import MerchAdmin from '@/pages/dashboard/MerchAdmin'
import MerchFormPage from '@/pages/dashboard/MerchFormPage'
import OrganizationFormPage from '@/pages/dashboard/OrganizationFormPage'
import ReservationFormPage from '@/pages/dashboard/ReservationFormPage'
import ReservationsAdmin from '@/pages/dashboard/ReservationsAdmin'
import OrganizationsAdmin from '@/pages/dashboard/OrganizationsAdmin'
import SettingsAdmin from '@/pages/dashboard/SettingsAdmin'
import UserFormPage from '@/pages/dashboard/UserFormPage'
import UsersAdmin from '@/pages/dashboard/UsersAdmin'
import GalleryAdmin from '@/pages/dashboard/GalleryAdmin'
import GalleryBatchFormPage from '@/pages/dashboard/GalleryBatchFormPage'
import RequestDetailPage from '@/pages/dashboard/RequestDetailPage'
import RequestsAdmin from '@/pages/dashboard/RequestsAdmin'
import PortalPlaceholder from '@/pages/dashboard/PortalPlaceholder'
import ForgotPassword from '@/pages/ForgotPassword'
import Home from '@/pages/Home'
import HowItWorks from '@/pages/HowItWorks'
import Login from '@/pages/Login'
import Placeholder from '@/pages/Placeholder'
import Portal from '@/pages/Portal'
import Project from '@/pages/Project'
import Privacy from '@/pages/Privacy'
import Reservation from '@/pages/Reservation'
import TheCouncil from '@/pages/TheCouncil'
import { ExecutivePage, LegislativePage } from '@/pages/Governance'
import Transparency from '@/pages/Transparency'

const pageEase = [0.22, 1, 0.36, 1] as const

function isAdminAppPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export default function App() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const adminApp = isAdminAppPath(pathname)
  useLenis(wrapperRef, contentRef)

  if (adminApp) {
    return (
      <ScrollContext.Provider value={wrapperRef}>
        <div ref={wrapperRef} className="app-scroll">
          <div ref={contentRef} className="min-h-full">
            <Routes>
              <Route path="/admin" element={<PortalShell />}>
                <Route index element={<DashboardHome />} />
                <Route path="requests" element={<RequestsAdmin />} />
                <Route path="requests/:id" element={<RequestDetailPage />} />
                <Route path="announcements" element={<AnnouncementsAdmin />} />
                <Route path="announcements/new" element={<AnnouncementFormPage />} />
                <Route path="announcements/:id/edit" element={<AnnouncementFormPage />} />
                <Route path="calendar" element={<CalendarAdmin />} />
                <Route path="calendar/new" element={<CalendarEventFormPage />} />
                <Route path="calendar/:id/edit" element={<CalendarEventFormPage />} />
                <Route path="projects" element={<ProjectsAdmin />} />
                <Route path="projects/new" element={<ProjectFormPage />} />
                <Route path="projects/:id/edit" element={<ProjectFormPage />} />
                <Route path="officers" element={<CouncilMembersAdmin board="officers" />} />
                <Route path="officers/new" element={<CouncilMemberFormPage board="officers" />} />
                <Route path="officers/:id/edit" element={<CouncilMemberFormPage board="officers" />} />
                <Route
                  path="commissioners"
                  element={<CouncilMembersAdmin board="commissioners" />}
                />
                <Route
                  path="commissioners/new"
                  element={<CouncilMemberFormPage board="commissioners" />}
                />
                <Route
                  path="commissioners/:id/edit"
                  element={<CouncilMemberFormPage board="commissioners" />}
                />
                <Route
                  path="advisory-board"
                  element={<CouncilMembersAdmin board="advisory" />}
                />
                <Route
                  path="advisory-board/new"
                  element={<CouncilMemberFormPage board="advisory" />}
                />
                <Route
                  path="advisory-board/:id/edit"
                  element={<CouncilMemberFormPage board="advisory" />}
                />
                <Route path="gallery" element={<GalleryAdmin />} />
                <Route path="gallery/new" element={<GalleryBatchFormPage />} />
                <Route path="gallery/:id/edit" element={<GalleryBatchFormPage />} />
                <Route path="mission-vision-values-goals" element={<AboutAdmin page="mvvg" />} />
                <Route
                  path="mission-vision-values-goals/edit/mission"
                  element={<AboutContentFormPage page="mvvg" kind="mission" />}
                />
                <Route
                  path="mission-vision-values-goals/edit/vision"
                  element={<AboutContentFormPage page="mvvg" kind="vision" />}
                />
                <Route
                  path="mission-vision-values-goals/new/values"
                  element={<AboutContentFormPage page="mvvg" kind="values" />}
                />
                <Route
                  path="mission-vision-values-goals/edit/values/:index"
                  element={<AboutContentFormPage page="mvvg" kind="values" />}
                />
                <Route
                  path="mission-vision-values-goals/new/goals"
                  element={<AboutContentFormPage page="mvvg" kind="goals" />}
                />
                <Route
                  path="mission-vision-values-goals/edit/goals/:index"
                  element={<AboutContentFormPage page="mvvg" kind="goals" />}
                />
                <Route path="mandate" element={<AboutAdmin page="mandate" />} />
                <Route
                  path="mandate/new"
                  element={<AboutContentFormPage page="mandate" kind="mandate" />}
                />
                <Route
                  path="mandate/edit/:index"
                  element={<AboutContentFormPage page="mandate" kind="mandate" />}
                />
                <Route path="agenda" element={<AboutAdmin page="agenda" />} />
                <Route
                  path="agenda/new"
                  element={<AboutContentFormPage page="agenda" kind="agenda" />}
                />
                <Route
                  path="agenda/edit/:index"
                  element={<AboutContentFormPage page="agenda" kind="agenda" />}
                />
                <Route path="history" element={<AboutAdmin page="history" />} />
                <Route
                  path="history/new"
                  element={<AboutContentFormPage page="history" kind="history" />}
                />
                <Route
                  path="history/edit/:index"
                  element={<AboutContentFormPage page="history" kind="history" />}
                />
                <Route path="organizations" element={<OrganizationsAdmin />} />
                <Route path="organizations/new" element={<OrganizationFormPage />} />
                <Route path="organizations/:id/edit" element={<OrganizationFormPage />} />
                <Route path="merch" element={<MerchAdmin />} />
                <Route path="merch/new" element={<MerchFormPage />} />
                <Route path="merch/:id/edit" element={<MerchFormPage />} />
                <Route path="reservations" element={<ReservationsAdmin />} />
                <Route path="reservations/new" element={<ReservationFormPage />} />
                <Route path="reservations/:id/edit" element={<ReservationFormPage />} />
                <Route path="faq" element={<FaqAdmin />} />
                <Route path="faq/new" element={<FaqFormPage />} />
                <Route path="faq/:id/edit" element={<FaqFormPage />} />
                <Route path="documents" element={<DocumentsAdmin />} />
                <Route path="documents/new" element={<DocumentFormPage />} />
                <Route path="documents/:id/edit" element={<DocumentFormPage />} />
                <Route path="users" element={<UsersAdmin />} />
                <Route path="users/new" element={<UserFormPage />} />
                <Route path="users/:id/edit" element={<UserFormPage />} />
                <Route path="settings" element={<SettingsAdmin />} />
                <Route path="*" element={<PortalPlaceholder />} />
              </Route>
            </Routes>
          </div>
        </div>
      </ScrollContext.Provider>
    )
  }

  return (
    <ScrollContext.Provider value={wrapperRef}>
      <div ref={wrapperRef} className="app-scroll">
        <div ref={contentRef} className="flex min-h-full flex-col">
          <Header />
          <AnimatedRoutes />
          <Footer />
        </div>
      </div>
      <BackToTop />
      <CookieNotice />
    </ScrollContext.Provider>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  const reduce = useReducedMotion() === true

  useLayoutEffect(() => {
    const id = location.hash.replace('#', '')
    const target = id ? document.getElementById(id) : null
    const scroller = document.querySelector('.app-scroll')
    if (target && scroller instanceof HTMLElement) {
      const top =
        target.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop -
        112
      scrollPageTo(Math.max(0, top), false)
      return
    }
    scrollPageTo(0, false)
  }, [location.pathname, location.hash])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.45, ease: pageEase }}
        className="grow"
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/contact" element={<Navigate to="/#contact" replace />} />
          <Route path="/about/the-council" element={<TheCouncil />} />
          <Route path="/governance/legislative" element={<LegislativePage />} />
          <Route path="/governance/executive" element={<ExecutivePage />} />
          <Route path="/announcements/:id" element={<Announcement />} />
          <Route path="/projects/:slug" element={<Project />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/forgot" element={<ForgotPassword />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/portal/reserve/:shop/:itemId" element={<Reservation />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/transparency" element={<Transparency />} />
          <Route path="*" element={<Placeholder />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}
