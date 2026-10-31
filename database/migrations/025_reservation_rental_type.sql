-- New rental vs renewal on shop reservations
USE pup_col_sc;

ALTER TABLE shop_reservations
  ADD COLUMN rental_type VARCHAR(16) NOT NULL DEFAULT 'new' AFTER item_name;
