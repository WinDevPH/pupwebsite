-- Remove CMS Forms page description (kept as static copy on the public page)
USE pup_col_sc;

DELETE FROM site_settings WHERE setting_key = 'forms';
