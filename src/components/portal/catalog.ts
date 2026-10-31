import lockerBay from '@/assets/shop/locker-bay.jpg'
import { buildShops, listShopItems, SHOP_META } from '@/lib/shop-api'

export type ShopId = 'locker' | 'merch'

export function shopCatalogPath(shop: ShopId) {
  return shop === 'locker' ? '/lockers' : '/merch'
}

export const LOCKER_ROWS = ['A', 'B', 'C', 'D', 'E'] as const
export const LOCKER_COLS = 12

export function lockerCode(row: string, col: number) {
  return `${row}-${String(col).padStart(2, '0')}`
}

export const LOCKER_UNIT = 'per rental period'

/** New-rental fees from the official locker schedule. */
export function lockerNewRentalPrice(row: string) {
  if (row === 'D') return 450
  if (row === 'E') return 350
  return 600
}

/** Renewal fees from the official locker schedule. */
export function lockerRenewalPrice(row: string) {
  if (row === 'D') return 450
  if (row === 'E') return 350
  return 500
}

export const LOCKER_RATES = [
  { transaction: 'New rental', location: 'Rows A, B and C (top rows)', fee: 600 },
  { transaction: 'New rental', location: 'Row D (bottom row)', fee: 450 },
  { transaction: 'New rental', location: 'Row E (bottom row)', fee: 350 },
  { transaction: 'Renewal', location: 'Rows A, B and C', fee: 500 },
  { transaction: 'Renewal', location: 'Row D', fee: 450 },
  { transaction: 'Renewal', location: 'Row E', fee: 350 },
] as const

export function lockerCodeFromItem(item: {
  id?: string | number
  name?: string
  number?: string | null
}) {
  const raw = String(item.number || item.name || item.id || '')
    .toUpperCase()
    .replace(/\s+/g, '')
  const match = raw.match(/([A-E])-?(\d{1,2})/)
  if (!match) return ''
  return lockerCode(match[1], Number(match[2]))
}

export function buildLockerGridItems(): ShopItem[] {
  const items: ShopItem[] = []
  for (const row of LOCKER_ROWS) {
    for (let col = 1; col <= LOCKER_COLS; col += 1) {
      const code = lockerCode(row, col)
      items.push({
        id: code.toLowerCase(),
        name: `Locker ${code}`,
        number: code,
        price: lockerNewRentalPrice(row),
        unit: LOCKER_UNIT,
        stock: 1,
        image: lockerBay,
        alt: `Locker ${code}`,
      })
    }
  }
  return items
}

export type ShopItem = {
  id: string
  name: string
  price: number
  unit: string
  stock: number
  image: string
  alt: string
  number?: string
  availability?: 'reserved' | 'out'
}

export type ShopCatalog = Record<ShopId, { title: string; kicker: string; items: ShopItem[] }>

/** Empty catalog. Public locker and merch pages only show published CMS rows. */
export function emptyShopCatalog(): ShopCatalog {
  return {
    locker: { ...SHOP_META.locker, items: [] },
    merch: { ...SHOP_META.merch, items: [] },
  }
}

export const shops: ShopCatalog = emptyShopCatalog()

export type ShopLookup = { shop: ShopId; listing: ShopCatalog[ShopId]; item: ShopItem }

function lookupShopItem(
  catalog: ShopCatalog,
  shop: string | undefined,
  itemId: string | undefined,
): ShopLookup | null {
  if (shop !== 'locker' && shop !== 'merch') return null
  const listing = catalog[shop]
  const item = listing.items.find((entry) => entry.id === itemId)
  if (!item) return null
  return { shop, listing, item }
}

export function findShopItem(shop: string | undefined, itemId: string | undefined) {
  return lookupShopItem(shops, shop, itemId)
}

/** Load published shop items from the CMS API. Empty catalogs if the API is unreachable. */
export async function loadShopCatalog(): Promise<ShopCatalog> {
  const result = await listShopItems()
  if (!result.ok) return emptyShopCatalog()
  return buildShops(result.data.items)
}

export async function findShopItemAsync(
  shop: string | undefined,
  itemId: string | undefined,
): Promise<ShopLookup | null> {
  return lookupShopItem(await loadShopCatalog(), shop, itemId)
}
