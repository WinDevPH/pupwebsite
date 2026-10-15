import { Hero } from '@/components/home/Hero'
import { LogoMarquee } from '@/components/home/LogoMarquee'
import { Projects } from '@/components/home/Projects'
import { Organizations } from '@/components/home/OrgDirectory'
import { FeaturedOfficers } from '@/components/home/FeaturedOfficers'
import { Announcements } from '@/components/home/Announcements'
import { EventsCalendar } from '@/components/home/EventsCalendar'
import { Faq } from '@/components/home/Faq'
import { ContactSection } from '@/components/home/Contact'

export default function Home() {
  return (
    <>
      <Hero />
      <LogoMarquee />
      <main id="main-content">
        <FeaturedOfficers />
        <Announcements />
        <EventsCalendar />
        <Projects />
        <Organizations />
        <Faq />
        <ContactSection />
      </main>
    </>
  )
}
