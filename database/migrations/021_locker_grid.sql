-- Replace sample lockers with the A–E / 01–12 availability grid
USE pup_col_sc;

DELETE FROM shop_items WHERE shop = 'locker';
