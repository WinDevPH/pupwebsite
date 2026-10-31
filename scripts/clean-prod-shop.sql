-- Hostinger / phpMyAdmin: run this on production if you do not re-import the cleaned dump.
-- Removes sample merch and locker reserved/out flags that have no reservation.

DELETE FROM shop_items
WHERE shop = 'merch'
  AND item_key IN ('college-shirt', 'college-polo', 'lanyard');

UPDATE shop_items
SET availability = NULL
WHERE shop = 'locker'
  AND availability IN ('reserved', 'out');
