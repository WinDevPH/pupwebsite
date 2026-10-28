import type { ShopId, ShopItem } from '@/components/portal/catalog'

export type ShopAvailability = 'reserved' | 'out'

export type ShopItemRecord = {
  id: number
  shop: ShopId
  itemKey: string
  key?: string
  name: string
  price: number
  unit: string
  stock: number
  image: string
  alt: string
  number: string | null
  availability: ShopAvailability | null
  sortOrder: number
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type ShopItemInput = {
  id?: number
  shop: ShopId
  itemKey?: string
  name: string
  price: number
  unit?: string
  stock?: number
  image: string
  alt?: string
  number?: string | null
  availability?: ShopAvailability | null
  sortOrder?: number
  published?: boolean
}

export type ShopListing = { title: string; kicker: string; items: ShopItem[] }
export type ShopsRecord = Record<ShopId, ShopListing>

export const SHOP_IDS: ShopId[] = ['locker', 'merch']

export const SHOP_META: Record<ShopId, { title: string; kicker: string }> = {
  locker: { title: 'Locker Availability', kicker: 'Locker' },
  merch: { title: 'Selling of Merch', kicker: 'Income · General' },
}

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

async function request<T>(path: string, init?: RequestInit): Promise<ApiOk<T> | ApiFailure> {
  try {
    const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(isFormData || !init?.body ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
      ...init,
    })
    const payload = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        error: payload?.error || 'Something went wrong. Please try again.',
        status: response.status,
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: 'Cannot reach the server. Start Apache and MySQL in XAMPP.',
      status: 0,
    }
  }
}

export async function listShopItems(options?: { shop?: ShopId; all?: boolean }) {
  const params = new URLSearchParams()
  if (options?.shop) params.set('shop', options.shop)
  if (options?.all) params.set('all', '1')
  const query = params.toString()
  return request<{ items: ShopItemRecord[] }>(`/api/shop.php${query ? `?${query}` : ''}`)
}

export async function getShopItemById(id: number) {
  return request<{ item: ShopItemRecord }>(`/api/shop.php?id=${id}`)
}

export async function createShopItem(input: ShopItemInput) {
  return request<{ item: ShopItemRecord }>('/api/shop.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateShopItem(input: ShopItemInput & { id: number }) {
  return request<{ item: ShopItemRecord }>('/api/shop.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteShopItem(id: number) {
  return request<{ ok: true }>('/api/shop.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function uploadShopImage(file: File) {
  const body = new FormData()
  body.append('image', file)
  return request<{ url: string; image: string; filename: string }>('/api/shop-upload.php', {
    method: 'POST',
    body,
  })
}

export function toShopItem(record: ShopItemRecord): ShopItem {
  const item: ShopItem = {
    id: record.itemKey || record.key || String(record.id),
    name: record.name,
    price: Number(record.price) || 0,
    unit: record.unit,
    stock: Number(record.stock) || 0,
    image: record.image,
    alt: record.alt || record.name,
  }
  if (record.number) item.number = record.number
  if (record.availability === 'reserved' || record.availability === 'out') {
    item.availability = record.availability
  }
  return item
}

/** Group API rows into the same `shops` shape the portal catalog uses. */
export function buildShops(items: ShopItemRecord[]): ShopsRecord {
  const shops: ShopsRecord = {
    locker: { ...SHOP_META.locker, items: [] },
    merch: { ...SHOP_META.merch, items: [] },
  }
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  for (const record of sorted) {
    if (record.shop !== 'locker' && record.shop !== 'merch') continue
    shops[record.shop].items.push(toShopItem(record))
  }
  return shops
}
