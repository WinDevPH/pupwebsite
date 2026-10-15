import lockerBay from '@/assets/shop/locker-bay.jpg'
import collegeShirt from '@/assets/shop/college-shirt.jpg'
import collegePolo from '@/assets/shop/college-polo.jpg'
import lanyard from '@/assets/shop/lanyard.jpg'

export type ShopId = 'locker' | 'merch'

export type LockerSize = 'half' | 'full'

export type ShopItem = {
  id: string
  name: string
  price: number
  unit: string
  stock: number
  image: string
  alt: string
  size?: LockerSize
  number?: string
  availability?: 'reserved' | 'out'
}

export const shops: Record<ShopId, { title: string; kicker: string; items: ShopItem[] }> = {
  locker: {
    title: 'Bookings for Locker',
    kicker: 'Locker',
    items: [
      { id: 'half-12', name: 'Half locker No. 12', number: '12', size: 'half', price: 250, unit: 'per semester', stock: 1, image: lockerBay, alt: 'Sample photo of a violet school locker' },
      { id: 'half-18', name: 'Half locker No. 18', number: '18', size: 'half', price: 250, unit: 'per semester', stock: 1, image: lockerBay, alt: 'Sample photo of a violet school locker' },
      { id: 'half-24', name: 'Half locker No. 24', number: '24', size: 'half', price: 250, unit: 'per semester', stock: 1, image: lockerBay, alt: 'Sample photo of a violet school locker' },
      { id: 'full-07', name: 'Full locker No. 07', number: '07', size: 'full', price: 400, unit: 'per semester', stock: 1, image: lockerBay, alt: 'Sample photo of a violet school locker' },
      { id: 'full-15', name: 'Full locker No. 15', number: '15', size: 'full', price: 400, unit: 'per semester', stock: 1, image: lockerBay, alt: 'Sample photo of a violet school locker' },
      { id: 'full-21', name: 'Full locker No. 21', number: '21', size: 'full', price: 400, unit: 'per semester', stock: 1, image: lockerBay, alt: 'Sample photo of a violet school locker' },
    ],
  },
  merch: {
    title: 'Selling of Merch',
    kicker: 'Income · General',
    items: [
      {
        id: 'college-shirt',
        name: 'College shirt',
        price: 450,
        unit: 'each',
        stock: 18,
        image: collegeShirt,
        alt: 'Sample photo of a violet college shirt',
      },
      {
        id: 'college-polo',
        name: 'College polo',
        price: 550,
        unit: 'each',
        image: collegePolo,
        stock: 12,
        alt: 'Sample photo of a white college polo',
      },
      {
        id: 'lanyard',
        name: 'Lanyard',
        price: 150,
        unit: 'each',
        image: lanyard,
        stock: 0,
        availability: 'out',
        alt: 'Sample photo of a violet lanyard',
      },
    ],
  },
}

export function findShopItem(
  shop: string | undefined,
  itemId: string | undefined,
): { shop: ShopId; listing: (typeof shops)[ShopId]; item: ShopItem } | null {
  if (shop !== 'locker' && shop !== 'merch') return null
  const listing = shops[shop]
  const item = listing.items.find((entry) => entry.id === itemId)
  if (!item) return null
  return { shop, listing, item }
}
