-- Calendar event cover images
USE pup_col_sc;

ALTER TABLE calendar_events
  ADD COLUMN image_url VARCHAR(500) NULL AFTER description;
