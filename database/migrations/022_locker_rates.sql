-- Official locker rental rates (new rental by row)
USE pup_col_sc;

UPDATE shop_items
SET price = 600.00, unit = 'per rental period'
WHERE shop = 'locker' AND UPPER(LEFT(COALESCE(number_label, item_key), 1)) IN ('A', 'B', 'C');

UPDATE shop_items
SET price = 450.00, unit = 'per rental period'
WHERE shop = 'locker' AND UPPER(LEFT(COALESCE(number_label, item_key), 1)) = 'D';

UPDATE shop_items
SET price = 350.00, unit = 'per rental period'
WHERE shop = 'locker' AND UPPER(LEFT(COALESCE(number_label, item_key), 1)) = 'E';
