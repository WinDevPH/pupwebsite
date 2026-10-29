import { Hero } from '@/components/home/Hero'
import { LogoMarquee } from '@/components/home/LogoMarquee'
import { Announcements } from '@/components/home/Announcements'
import { EventsCalendar } from '@/components/home/EventsCalendar'
import { Faq } from '@/components/home/Faq'
import { ContactSection } from '@/components/home/Contact'
import { CouncilChat } from '@/components/home/CouncilChat'

export default function Home() {
  return (
    <>
      <div className="flex min-h-[calc(100svh-5rem)] flex-col md:min-h-[calc(100svh-7.25rem)]">
        <Hero />
        <LogoMarquee />
      </div>
      <main id="main-content">
        <Announcements />
        <EventsCalendar />
        <Faq />
        <ContactSection />
      </main>
      <CouncilChat />
    </>
  )
}
