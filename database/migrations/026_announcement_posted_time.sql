-- Fix legacy announcement stamps that were saved as midnight (date-only).
USE pup_col_sc;

UPDATE announcements
SET published_at = created_at
WHERE published_at IS NOT NULL
  AND TIME(published_at) = '00:00:00'
  AND created_at IS NOT NULL
  AND TIME(created_at) <> '00:00:00';
