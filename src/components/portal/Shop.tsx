import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Bookmark, Heart, LockKeyhole, Package, Shirt } from 'lucide-react'
import type { ShopId, ShopItem } from '@/components/portal/catalog'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'

const FAVORITES_KEY = 'pup-col-sc-shop-favorites'
const FAVORITES_EVENT = 'pup-shop-favorites'

function pesos(value: number) {
  return `₱${value.toLocaleString('en-PH')}`
}

function readFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function useFavorites() {
  const [ids, setIds] = useState<string[]>(readFavorites)

  useEffect(() => {
    const sync = () => setIds(readFavorites())
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  function toggle(id: string) {
    const current = readFavorites()
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
    setIds(next)
    window.dispatchEvent(new Event(FAVORITES_EVENT))
  }

  return { ids, toggle }
}

export function ShopPanel({
  shop,
  title,
  kicker,
  items,
  showTitle = true,
}: {
  shop: ShopId
  title: string
  kicker: string
  items: ShopItem[]
  showTitle?: boolean
}) {
  const favorites = useFavorites()
  const compact = shop === 'merch' || shop === 'locker'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 sm:pb-10 lg:px-8">
      {showTitle ? (
        <div className="flex h-10 items-center">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
        </div>
      ) : null}

      <ul
        className={cn(
          'grid grid-cols-1 gap-3 sm:grid-cols-2',
          showTitle && 'mt-4',
          compact && 'lg:grid-cols-3',
        )}
      >
        {items.map((entry, index) => {
          const saved = favorites.ids.includes(entry.id)
          const closed = entry.availability === 'reserved' || entry.availability === 'out'
          const statusLabel =
            entry.availability === 'reserved'
              ? 'Reserved'
              : entry.availability === 'out'
                ? shop === 'locker'
                  ? 'Unavailable'
                  : 'Out of stock'
                : shop === 'locker'
                  ? 'Locker'
                  : 'Merch'
          return (
            <li key={entry.id}>
              <Reveal delay={Math.min(index, 4) * 0.05}>
              <article
                className={cn(
                  'card-lift flex h-full overflow-hidden rounded-2xl bg-white shadow-[0_10px_28px_-18px_rgba(30,5,65,0.45)] dark:bg-zinc-900',
                  closed && 'opacity-70',
                )}
              >
                <span
                  className={cn(
                    'relative w-28 shrink-0 bg-[#f6f6f8] sm:w-36',
                    compact && 'lg:w-28',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white',
                      closed ? 'bg-zinc-700' : 'bg-brand-700',
                    )}
                  >
                    {entry.availability === 'out' ? (
                      <Ban className="size-2.5" aria-hidden />
                    ) : shop === 'locker' ? (
                      <LockKeyhole className="size-2.5" aria-hidden />
                    ) : (
                      <Shirt className="size-2.5" aria-hidden />
                    )}
                    {statusLabel}
                  </span>
                  <img
                    src={entry.image}
                    alt={entry.alt}
                    className="h-full w-full object-contain p-3 pt-9"
                  />
                </span>
                <span
                  className={cn(
                    'flex min-w-0 flex-1 flex-col justify-center gap-3 px-3.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-4',
                    compact && 'lg:flex-col lg:items-stretch',
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-xs text-zinc-500">{kicker}</span>
                        <span className="mt-0.5 block text-base leading-5 font-semibold text-zinc-950">
                          {entry.number ? `No. ${entry.number}` : entry.name}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-pressed={saved}
                        aria-label={saved ? `Remove ${entry.name} from favorites` : `Save ${entry.name} to favorites`}
                        onClick={() => favorites.toggle(entry.id)}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-brand-700"
                      >
                        <Heart
                          className={cn('size-4', saved && 'fill-brand-700 text-brand-700')}
                          aria-hidden
                        />
                      </button>
                    </span>
                    <span className="mt-1.5 block text-sm leading-5 text-zinc-950">
                      <span className="font-semibold">{pesos(entry.price)}</span>
                      <span className="font-normal text-zinc-400"> · {entry.unit}</span>
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-500">
                      <Package className="size-3.5 shrink-0" aria-hidden />
                      {shop === 'locker'
                        ? entry.availability === 'reserved'
                          ? 'Reserved'
                          : entry.availability === 'out'
                            ? 'Unavailable'
                            : 'Available'
                        : `${entry.stock} in stock`}
                    </span>
                  </span>
                  {closed ? (
                    <button
                      type="button"
                      disabled
                      className={cn(
                        'inline-flex h-10 w-full shrink-0 cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-zinc-200 text-sm font-semibold text-zinc-500 sm:w-auto sm:px-5',
                        compact && 'lg:w-full',
                      )}
                    >
                      <Bookmark className="size-3.5" aria-hidden />
                      Reserve
                    </button>
                  ) : (
                  <Link
                    to={`/portal/reserve/${shop}/${entry.id}`}
                    className={cn(
                      'inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 sm:w-auto sm:px-5',
                      compact && 'lg:w-full',
                    )}
                  >
                    <Bookmark className="size-3.5" aria-hidden />
                    Reserve
                  </Link>
                  )}
                </span>
              </article>
              </Reveal>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
