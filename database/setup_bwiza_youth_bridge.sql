-- Bwiza Youth Bridge - MySQL database setup
-- Creates the bwiza_youth_bridge database, the BYBadmin1 user, and all tables.
-- Run this once with a MySQL admin account, e.g.:
--   mysql -u root -p < database/setup_bwiza_youth_bridge.sql

-- Remove any existing database and user
DROP DATABASE IF EXISTS bwiza_youth_bridge;
DROP USER IF EXISTS 'BYBadmin1'@'localhost';

-- Create the database
CREATE DATABASE bwiza_youth_bridge
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Create the application user with the required password
CREATE USER 'BYBadmin1'@'localhost' IDENTIFIED BY 'Bwizayouth1';

-- Grant full access to the bwiza_youth_bridge database
GRANT ALL PRIVILEGES ON bwiza_youth_bridge.* TO 'BYBadmin1'@'localhost';
FLUSH PRIVILEGES;

USE bwiza_youth_bridge;

-- Migration tracking table (used by npm run migrate)
CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users (authentication & profiles)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(2048) NULL,
  email_verified_at TIMESTAMP NULL DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles (member, admin)
CREATE TABLE IF NOT EXISTS roles (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (name) VALUES ('member'), ('admin')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- User <-> role assignment
CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id SMALLINT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (name, email, password_hash, is_active)
VALUES ('Bwiza Youth Bridge Admin', 'bwizayouthbridge@gmail.com', '$2b$12$NMV9ZdsLCWAQUUqVy7zTjuSHpGkFofnQV5qArILd7..Ap/lsGlSbi', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  is_active = 1;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name IN ('member', 'admin')
WHERE LOWER(u.email) = 'bwizayouthbridge@gmail.com'
ON DUPLICATE KEY UPDATE assigned_at = CURRENT_TIMESTAMP;

-- HTTP-only sessions (express-session MySQL store)
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires_at DATETIME NOT NULL,
  session_data MEDIUMTEXT NOT NULL,
  KEY idx_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_password_reset_user (user_id),
  KEY idx_password_reset_expiration (expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Programs (managed content)
CREATE TABLE IF NOT EXISTS programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT NOT NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_programs_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Projects (managed content)
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT NOT NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_projects_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Events (managed content)
CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  location VARCHAR(255) NULL,
  status ENUM('draft', 'published', 'cancelled', 'archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_events_slug (slug),
  KEY idx_events_starts_at (starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Program/event applications (authenticated users)
CREATE TABLE IF NOT EXISTS applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  program_id BIGINT UNSIGNED NULL,
  event_id BIGINT UNSIGNED NULL,
  message TEXT NULL,
  status ENUM('submitted', 'reviewing', 'accepted', 'rejected', 'withdrawn') NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_applications_user (user_id, created_at),
  KEY idx_applications_program (program_id),
  KEY idx_applications_event (event_id),
  CONSTRAINT chk_application_target CHECK ((program_id IS NOT NULL) <> (event_id IS NOT NULL)),
  CONSTRAINT fk_applications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_applications_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE RESTRICT,
  CONSTRAINT fk_applications_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contact form submissions
CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('new', 'reviewing', 'resolved', 'archived') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_contact_messages_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Record this setup as applied so migrations don't re-run it
INSERT INTO schema_migrations (migration_name) VALUES ('setup_bwiza_youth_bridge.sql')
ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;

SELECT 'bwiza_youth_bridge database, BYBadmin1 user, and all tables created successfully.' AS message;
