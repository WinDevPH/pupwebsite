-- Profile photo for admin user accounts
ALTER TABLE users
  ADD COLUMN avatar_url VARCHAR(500) NULL AFTER year_level;
