import { Hero } from '@/components/home/Hero'
import { LogoMarquee } from '@/components/home/LogoMarquee'
import { Projects } from '@/components/home/Projects'
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
        <Announcements />
        <EventsCalendar />
        <Projects />
        <Faq />
        <ContactSection />
      </main>
    </>
  )
}
