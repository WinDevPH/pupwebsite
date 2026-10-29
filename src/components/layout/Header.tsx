import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { NavigationMenu } from 'radix-ui'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronsRight, Clock, Menu, Moon, Sun, X } from 'lucide-react'
import logo from '@/assets/pup-col-sc-logo.png'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useScrollContainer } from '@/context/ScrollContext'
import { useTheme } from '@/context/ThemeContext'
import { scrollPageTo, setPageScrollLocked } from '@/hooks/useLenis'
import { useNavItems } from '@/hooks/useResourceLibrary'
import { useSiteContact } from '@/hooks/useSiteContact'
import type { SiteContact } from '@/lib/site-settings-api'
import { cn } from '@/lib/utils'
import {
  isExternalNavTo,
  primaryCta,
  projectPillars,
  siteName,
  type NavFeature,
  type NavGroup,
  type NavItem,
  type NavLinkItem,
} from './nav-data'

type MenuItem = Extract<NavItem, { groups: NavGroup[] }>

const navLinkClass =
  'inline-flex h-11 items-center gap-1 rounded-lg px-3 text-[15px] font-medium whitespace-nowrap text-zinc-700 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'

const GROUP_COL = 340
const WIDE_GROUP_COL = 580
const FEATURE_COL = 272
const MENU_GAP = 20
const MENU_PAD_X = 20

function menuWidth(item: MenuItem) {
  const groups = item.groups.reduce(
    (sum, group) => sum + (group.wide ? WIDE_GROUP_COL : GROUP_COL),
    0,
  )
  const columns = item.groups.length + (item.feature ? 1 : 0)
  const gaps = Math.max(0, columns - 1) * MENU_GAP

  return groups + (item.feature ? FEATURE_COL : 0) + gaps + MENU_PAD_X * 2
}

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  // The menu is "open" only for the route it was opened on, so navigating
  // closes it without needing an effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const { pathname } = useLocation()
  const mobileOpen = openedAt === pathname
  const scroller = useScrollContainer()
  const items = useNavItems()
  const siteContact = useSiteContact()

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 8)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scroller, pathname])

  const onHero =
    pathname === '/' ||
    pathname === '/about/the-council' ||
    pathname === '/transparency' ||
    pathname === '/forms' ||
    pathname === '/lockers' ||
    pathname === '/merch' ||
    pathname === '/projects' ||
    projectPillars.some((item) => item.to === pathname)

  return (
    <>
      <div className="sticky top-0 z-50">
      <TopBar hidden={scrolled} contact={siteContact} />
      <header
        className={cn(
          'border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300',
          scrolled || mobileOpen || !onHero
            ? 'border-brand-100/80 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95'
            : 'header-blend border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand onNavigate={() => setOpenedAt(null)} />

          <DesktopNav items={items} />

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle className="hidden xl:inline-flex" />
            <div className="hidden xl:block">
              <Button asChild className="h-11">
                <Link to={primaryCta.to} aria-label={primaryCta.label}>
                  {primaryCta.label}
                  <ChevronsRight className="size-4" />
                </Link>
              </Button>
            </div>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-lg text-brand-900 hover:bg-brand-50 dark:text-zinc-100 dark:hover:bg-brand-500/15 xl:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setOpenedAt(mobileOpen ? null : pathname)}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mobileOpen ? 'close' : 'open'}
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex"
                >
                  {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>
      </div>
      <MobileNav
        items={items}
        contact={siteContact}
        open={mobileOpen}
        barVisible={!scrolled}
        onNavigate={() => setOpenedAt(null)}
      />
    </>
  )
}


function TopBar({ hidden, contact }: { hidden: boolean; contact: SiteContact }) {
  return (
    <div
      className={cn(
        'hidden overflow-hidden border-b border-transparent bg-brand-950 text-brand-100 transition-[max-height,background-color,border-color,color] duration-300 ease-out md:block dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
        hidden ? 'pointer-events-none max-h-0' : 'max-h-9',
      )}
      inert={hidden}
      aria-hidden={hidden}
    >
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-3 px-4 text-[11px] sm:px-6 sm:text-xs lg:px-8">
        <p className="inline-flex min-w-0 items-center gap-1.5 font-medium tracking-wide">
          <Clock className="size-3.5 shrink-0 text-gold-400 dark:text-gold-400" aria-hidden />
          <span className="truncate">
            <span className="text-white/60 dark:text-zinc-500">Office hours:</span>{' '}
            <span className="text-brand-100 dark:text-zinc-200">{contact.hours}</span>
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {contact.socials.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${social.name} ${social.handle}`}
              title={social.handle}
              className="inline-flex items-center gap-1.5 text-brand-100 transition-colors hover:text-white dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <SocialIcon name={social.name} className="size-3.5" />
              <span className="hidden lg:inline">{social.handle}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()

  return (
    <Link
      to="/"
      aria-label={`${siteName.short} ${siteName.unit}, home`}
      onClick={(event) => {
        onNavigate?.()
        if (pathname === '/') {
          event.preventDefault()
          scrollPageTo(0, true)
          return
        }
        scrollPageTo(0, false)
      }}
      className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
    >
      <img
        src={logo}
        alt=""
        width={48}
        height={48}
        className="size-12 rounded-full ring-2 ring-gold-400"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-bold tracking-tight text-brand-950">
          {siteName.short}
        </span>
        <span className="text-[12px] font-semibold tracking-[0.18em] text-brand-600 uppercase">
          {siteName.unit}
        </span>
      </span>
    </Link>
  )
}

function DesktopNav({ items }: { items: NavItem[] }) {
  return (
    <NavigationMenu.Root className="relative hidden xl:block">
      <NavigationMenu.List className="flex items-center gap-0.5">
        {items
          .filter((item) => !item.mobileOnly)
          .map((item) =>
            item.groups ? (
              <NavigationMenu.Item
                key={item.label}
                className={menuWidth(item) > 640 ? undefined : 'relative'}
              >
                <NavigationMenu.Trigger
                  className={cn(
                    navLinkClass,
                    'group data-[state=open]:text-brand-700',
                  )}
                >
                  {item.label}
                  <ChevronDown
                    aria-hidden
                    className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content
                  className="absolute top-full left-1/2 z-50 pt-3 -translate-x-1/2"
                  style={{ width: menuWidth(item) }}
                >
                  <div className="origin-top overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_28px_60px_-24px_rgba(30,5,65,0.4)] animate-menu-in dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50">
                    <MegaMenu item={item} />
                  </div>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            ) : (
              <NavigationMenu.Item key={item.label}>
                <NavigationMenu.Link asChild>
                  <SiteNavLink
                    to={item.to}
                    className={cn(navLinkClass, 'aria-[current=page]:text-brand-700')}
                  >
                    {item.label}
                  </SiteNavLink>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ),
          )}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}

function MegaMenu({ item, stacked = false }: { item: MenuItem; stacked?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-4', stacked ? 'px-2 py-4' : 'px-5 py-5')}>
      {item.title ? (
        <p className="px-3 text-[11px] font-semibold tracking-[0.16em] text-brand-600 uppercase">
          {item.title}
        </p>
      ) : null}
      <div
        className={cn('flex', stacked ? 'flex-col gap-5' : 'items-stretch')}
        style={stacked ? undefined : { gap: MENU_GAP }}
      >
        {item.groups.map((group) => (
          <div
            key={group.title}
            className="px-3 py-1"
            style={
              stacked ? undefined : { width: group.wide ? WIDE_GROUP_COL : GROUP_COL }
            }
          >
            <p className="mb-3 text-sm font-bold text-brand-950">{group.title}</p>
            <ul
              className={cn(
                'grid gap-1.5',
                group.wide && !stacked && 'grid-cols-2 gap-x-6',
              )}
            >
              {group.links.map((link) => (
                <li key={link.to}>
                  {stacked ? (
                    <MenuLink link={link} />
                  ) : (
                    <NavigationMenu.Link asChild>
                      <MenuLink link={link} />
                    </NavigationMenu.Link>
                  )}
                </li>
              ))}
            </ul>
            {group.note ? (
              <p className="mt-4 px-3 text-xs/5 text-zinc-400">{group.note}</p>
            ) : null}
          </div>
        ))}
        {item.feature ? (
          stacked ? (
            <FeatureCard feature={item.feature} className="w-full" />
          ) : (
            <NavigationMenu.Link asChild>
              <FeatureCard feature={item.feature} style={{ width: FEATURE_COL }} />
            </NavigationMenu.Link>
          )
        ) : null}
      </div>
    </div>
  )
}

function FeatureCard({
  feature,
  className,
  ...props
}: { feature: NavFeature } & Omit<ComponentProps<typeof Link>, 'to'>) {
  return (
    <Link
      {...props}
      to={feature.to}
      className={cn(
        'group relative flex flex-col gap-4 self-start overflow-hidden rounded-2xl bg-brand-600 p-5 text-white transition-colors hover:bg-brand-700',
        className,
      )}
    >
      <WavePattern />
      <div className="relative">
        <p className="text-[11px] font-semibold tracking-wider text-gold-300 uppercase">
          {feature.eyebrow}
        </p>
        <p className="mt-1.5 text-base leading-snug font-bold">{feature.title}</p>
        <p className="mt-2 text-xs/5 text-white/80">{feature.description}</p>
      </div>
      <span className="relative inline-flex w-fit items-center gap-1 rounded-full border border-white/40 px-3 py-1.5 text-xs font-medium transition-colors group-hover:border-white/70 group-hover:bg-white/10">
        {feature.cta}
        <ChevronsRight className="size-3.5" />
      </span>
    </Link>
  )
}

function WavePattern() {
  return (
    <svg
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-3/5 w-full opacity-25"
      viewBox="0 0 220 140"
      fill="none"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 10 }, (_, i) => {
        const y = 20 + i * 13
        return (
          <path
            key={i}
            d={`M-10 ${y} C 50 ${y - 24}, 120 ${y + 34}, 230 ${y - 10}`}
            stroke="white"
            strokeWidth="1"
          />
        )
      })}
    </svg>
  )
}

const menuEase = [0.22, 1, 0.36, 1] as const

const menuListVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.08 },
  },
}

const menuItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: menuEase },
  },
}

function MobileNav({
  items,
  contact,
  open,
  barVisible,
  onNavigate,
}: {
  items: NavItem[]
  contact: SiteContact
  open: boolean
  barVisible: boolean
  onNavigate: () => void
}) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.classList.add('mobile-nav-open')
    setPageScrollLocked(true)
    return () => {
      document.body.style.overflow = previous
      document.documentElement.classList.remove('mobile-nav-open')
      setPageScrollLocked(false)
    }
  }, [open])

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          id="mobile-nav"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: menuEase }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden bg-white top-20 xl:hidden dark:bg-zinc-950',
            barVisible && 'md:top-[7.25rem]',
          )}
        >
          <motion.div
            initial={{ y: -12 }}
            animate={{ y: 0 }}
            exit={{ y: -8 }}
            transition={{ duration: 0.32, ease: menuEase }}
            className="flex h-full min-h-0 flex-col"
          >
            <nav
              aria-labelledby="mobile-nav-label"
              data-lenis-prevent
              className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain px-5"
            >
              <p
                id="mobile-nav-label"
                className="pt-4 text-[11px] font-semibold tracking-[0.16em] text-zinc-400 uppercase"
              >
                Main navigation
              </p>
              <motion.ul
                variants={menuListVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-1 py-3"
              >
                {items.map((item) =>
                  item.groups ? (
                    <motion.li key={item.label} variants={menuItemVariants}>
                      <MobileGroup item={item} />
                    </motion.li>
                  ) : (
                    <motion.li key={item.label} variants={menuItemVariants}>
                      <MobileDestination
                        item={item}
                        onNavigate={onNavigate}
                      />
                    </motion.li>
                  ),
                )}
              </motion.ul>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.22, ease: menuEase }}
                className="mt-auto border-t border-zinc-100 py-5"
              >
                <MobileThemeToggle />
                <Button asChild size="lg" className="mt-3 w-full">
                  <Link to={primaryCta.to} aria-label={primaryCta.label}>
                    {primaryCta.label}
                    <ChevronsRight className="size-4" />
                  </Link>
                </Button>
                <div className="mt-5 flex items-center justify-center gap-5">
                  {contact.socials.map((social) => (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${social.name} ${social.handle}`}
                      className="text-zinc-400 transition-colors duration-200 hover:text-brand-700"
                    >
                      <SocialIcon name={social.name} className="size-5" />
                    </a>
                  ))}
                </div>
              </motion.div>
            </nav>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const mobileItemClass =
  'flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left text-[15px] font-medium text-zinc-700 transition-colors hover:bg-brand-50 hover:text-brand-700'

function MobileThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const Icon = dark ? Moon : Sun

  return (
    <button
      type="button"
      role="switch"
      onClick={toggleTheme}
      aria-checked={dark}
      aria-label={dark ? 'Dark Mode enabled' : 'Light Mode enabled'}
      className={cn(mobileItemClass, 'justify-between pr-3 dark:text-zinc-100 dark:hover:bg-brand-500/12')}
    >
      <span className="inline-flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <Icon className="size-4" aria-hidden />
        </span>
        {dark ? 'Dark Mode' : 'Light Mode'}
      </span>
      <span className="inline-flex shrink-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'relative h-6 w-11 rounded-full border transition-colors',
            dark
              ? 'border-brand-500/50 bg-brand-600 dark:border-brand-400/50 dark:bg-brand-500'
              : 'border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-5 rounded-full bg-[#ffffff] shadow-sm transition-transform',
              dark && 'translate-x-5',
            )}
          />
        </span>
      </span>
    </button>
  )
}

function MobileDestination({
  item,
  onNavigate,
}: {
  item: Extract<NavItem, { to: string }>
  onNavigate?: () => void
}) {
  return (
    <SiteNavLink
      to={item.to}
      onNavigate={onNavigate}
      className={cn(mobileItemClass, 'aria-[current=page]:text-brand-700')}
    >
      <MenuRowIcon icon={item.icon} />
      {item.label}
    </SiteNavLink>
  )
}

function SiteNavLink({
  to,
  className,
  children,
  onNavigate,
}: {
  to: string
  className?: string
  children: ReactNode
  onNavigate?: () => void
}) {
  const location = useLocation()
  const hashAt = to.indexOf('#')
  const hashed = hashAt !== -1

  function scrollToHash() {
    if (!hashed) return
    const path = to.slice(0, hashAt) || '/'
    const hash = to.slice(hashAt)
    if (location.pathname !== path || location.hash !== hash) return
    const target = document.getElementById(hash.slice(1))
    const scroller = document.querySelector('.app-scroll')
    if (!(target instanceof HTMLElement) || !(scroller instanceof HTMLElement)) return
    const top =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      112
    scrollPageTo(Math.max(0, top), true)
  }

  if (!hashed) {
    return (
      <NavLink to={to} end={to === '/'} className={className} onClick={onNavigate}>
        {children}
      </NavLink>
    )
  }

  return (
    <Link
      to={to}
      className={className}
      onClick={() => {
        onNavigate?.()
        scrollToHash()
      }}
    >
      {children}
    </Link>
  )
}

function MobileGroup({ item }: { item: MenuItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className={cn(mobileItemClass, expanded && 'bg-brand-50 text-brand-700')}
      >
        <MenuRowIcon icon={item.icon} />
        <span className="min-w-0 flex-1">{item.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: menuEase }}
            className="overflow-hidden"
          >
            <div className="px-1 pt-2 pb-3">
              <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <MegaMenu item={item} stacked />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function MenuRowIcon({ icon: Icon }: { icon?: NavItem['icon'] }) {
  if (!Icon) return null

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

function MenuLink({
  link,
  compact = false,
  className,
  ...props
}: { link: NavLinkItem; compact?: boolean } & Omit<ComponentProps<typeof Link>, 'to'>) {
  const Icon = link.icon
  const hasDescription = !compact && Boolean(link.description)
  const classes = cn(
    'flex gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-brand-50',
    hasDescription ? 'items-start' : 'items-center',
    className,
  )
  const body = (
    <>
      {Icon ? (
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700',
            hasDescription && 'mt-0.5',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-800">{link.label}</span>
        {hasDescription ? (
          <span className="mt-1 block text-xs/5 text-zinc-500">{link.description}</span>
        ) : null}
      </span>
    </>
  )

  if (isExternalNavTo(link.to)) {
    return (
      <a
        {...(props as ComponentProps<'a'>)}
        href={link.to}
        target="_blank"
        rel="noreferrer"
        className={classes}
      >
        {body}
      </a>
    )
  }

  return (
    <Link {...props} to={link.to} className={classes}>
      {body}
    </Link>
  )
}

function SocialIcon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    Facebook:
      'M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z',
    X: 'M17.5 3h3l-6.8 7.8L21.7 21h-6.2l-4.9-6.4L5 21H2l7.3-8.3L1.7 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.2h1.7L6.9 4.7H5.1l11.3 14.5Z',
    Instagram:
      'M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.9-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM12 2.2c-2.7 0-3 0-4 .1-1.1 0-1.8.2-2.4.5-.7.2-1.2.6-1.8 1.1C3.3 4.5 3 5 2.7 5.7c-.2.6-.4 1.3-.4 2.4-.1 1-.1 1.3-.1 4s0 3 .1 4c0 1 .2 1.8.4 2.4.3.6.6 1.2 1.2 1.7.5.6 1.1.9 1.7 1.2.6.2 1.4.4 2.4.4 1.1.1 1.4.1 4 .1s3 0 4-.1c1.1 0 1.8-.2 2.4-.4.7-.3 1.2-.6 1.8-1.2.5-.5.9-1 1.1-1.7.3-.6.4-1.4.5-2.4v-8c-.1-1.1-.2-1.8-.5-2.4-.2-.7-.6-1.2-1.1-1.8-.6-.5-1.1-.9-1.8-1.1-.6-.3-1.3-.5-2.4-.5-1-.1-1.3-.1-4-.1Zm0 1.7c2.6 0 3 0 4 .1.9 0 1.5.2 1.8.3.5.2.8.4 1.1.7.4.4.6.7.7 1.1.2.4.3.9.4 1.9v7.8c-.1 1-.2 1.5-.4 1.9-.1.4-.3.7-.7 1.1-.3.3-.6.5-1.1.7-.3.1-.9.3-1.8.3-1 .1-1.4.1-4 .1s-3 0-4-.1c-.9 0-1.5-.2-1.8-.3-.5-.2-.8-.4-1.1-.7-.4-.4-.6-.7-.7-1.1-.1-.4-.3-.9-.4-1.9V8c.1-1 .3-1.5.4-1.9.1-.4.3-.7.7-1.1.3-.3.6-.5 1.1-.7.3-.1.9-.3 1.8-.3 1-.1 1.4-.1 4-.1Z',
  }

  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d={paths[name] ?? ''} />
    </svg>
  )
}
