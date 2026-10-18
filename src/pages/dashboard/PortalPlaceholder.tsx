import { useLocation } from 'react-router-dom'
import { breadcrumbsFor } from '@/components/portal/nav'

export default function PortalPlaceholder() {
  const { pathname } = useLocation()
  const crumbs = breadcrumbsFor(pathname)
  const title = crumbs[crumbs.length - 1]?.label ?? 'Page'

  return (
    <div className="space-y-2">
      <h1 className="font-hero text-[clamp(1.75rem,1.2rem+1.2vw,2.25rem)] leading-none tracking-tight text-brand-950 dark:text-zinc-50">
        {title}
      </h1>
      <p className="max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        This section is empty for now.
      </p>
    </div>
  )
}
