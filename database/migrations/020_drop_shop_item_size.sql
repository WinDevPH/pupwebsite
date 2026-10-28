-- Locker half/full size is unused; catalog shows every locker together
USE pup_col_sc;

ALTER TABLE shop_items DROP COLUMN size;
