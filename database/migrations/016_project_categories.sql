-- Project program categories + multiple images
USE pup_col_sc;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS category VARCHAR(64) NOT NULL DEFAULT 'internal-affairs' AFTER slug;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS images_json JSON NULL AFTER image_url;

ALTER TABLE projects
  ADD KEY idx_projects_category (category, is_published, sort_order);

UPDATE projects
SET images_json = JSON_ARRAY(image_url)
WHERE (images_json IS NULL OR JSON_TYPE(images_json) = 'NULL')
  AND image_url <> '';

UPDATE projects
SET category = 'internal-affairs'
WHERE category IS NULL OR category = '';
