-- SQLite schema for the foot photo album application

-- Photos table (approved and live photos)
CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    likes INTEGER DEFAULT 0,
    report_count INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'deleted')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pending photos table (awaiting admin approval)
CREATE TABLE pending_photos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
);

-- Reports table (user reports on photos)
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id TEXT NOT NULL,
    reason TEXT DEFAULT 'user_reported',
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

-- Admin actions log (audit trail)
CREATE TABLE admin_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT, -- In a real app, this would reference an admin users table
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'delete', 'view')),
    photo_id TEXT,
    details TEXT, -- JSON string with additional details
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT
);

-- User preferences table (for future features)
CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    liked_photos TEXT, -- JSON array of photo IDs
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (application configuration)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
    ('max_file_size', '5242880'), -- 5MB in bytes
    ('allowed_formats', '["image/jpeg","image/png","image/webp"]'),
    ('image_quality', '80'),
    ('max_image_width', '1200'),
    ('captcha_required', 'true'),
    ('tos_required', 'true');

-- Indexes for performance
CREATE INDEX idx_photos_status ON photos(status);
CREATE INDEX idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX idx_pending_photos_status ON pending_photos(status);
CREATE INDEX idx_pending_photos_uploaded_at ON pending_photos(uploaded_at DESC);
CREATE INDEX idx_reports_photo_id ON reports(photo_id);
CREATE INDEX idx_reports_reported_at ON reports(reported_at DESC);
CREATE INDEX idx_admin_actions_photo_id ON admin_actions(photo_id);
CREATE INDEX idx_admin_actions_performed_at ON admin_actions(performed_at DESC);
CREATE INDEX idx_user_preferences_session_id ON user_preferences(session_id);

-- Views for common queries

-- View for photos with report counts
CREATE VIEW photos_with_reports AS
SELECT
    p.*,
    COUNT(r.id) as total_reports,
    MAX(r.reported_at) as last_reported_at
FROM photos p
LEFT JOIN reports r ON p.id = r.photo_id
GROUP BY p.id;

-- View for admin dashboard stats
CREATE VIEW admin_stats AS
SELECT
    (SELECT COUNT(*) FROM photos WHERE status = 'approved') as approved_photos,
    (SELECT COUNT(*) FROM pending_photos WHERE status = 'pending') as pending_photos,
    (SELECT COUNT(*) FROM reports WHERE reported_at >= date('now', '-24 hours')) as reports_today,
    (SELECT COUNT(*) FROM reports) as total_reports,
    (SELECT COUNT(*) FROM photos) as total_photos,
    (SELECT COUNT(*) FROM pending_photos) as total_pending;

-- Triggers for data integrity

-- Trigger to log admin actions
CREATE TRIGGER log_admin_action AFTER INSERT ON admin_actions
BEGIN
    -- Ensure details is valid JSON if provided
    UPDATE admin_actions
    SET details = details
    WHERE id = NEW.id;
END;

-- Trigger to update photo likes count
CREATE TRIGGER update_photo_likes AFTER UPDATE OF likes ON photos
BEGIN
    -- Log significant like milestones (optional)
    INSERT INTO admin_actions (admin_id, action, photo_id, details)
    SELECT
        'system',
        'like_milestone',
        NEW.id,
        json_object('likes', NEW.likes)
    WHERE NEW.likes > 0 AND NEW.likes % 10 = 0; -- Every 10 likes
END;

-- Trigger to clean up reports when photo is deleted
CREATE TRIGGER cleanup_reports_on_photo_delete
    AFTER DELETE ON photos
BEGIN
    DELETE FROM reports WHERE photo_id = OLD.id;
END;

-- Sample data for development
INSERT INTO photos (id, filename, original_name, size, likes, status, created_at, approved_at) VALUES
    ('sample_001', 'processed_sample1.webp', 'feet_photo_1.jpg', 245760, 5, 'approved', '2025-09-26 10:00:00', '2025-09-26 10:05:00'),
    ('sample_002', 'processed_sample2.webp', 'feet_photo_2.png', 189440, 3, 'approved', '2025-09-26 11:00:00', '2025-09-26 11:10:00'),
    ('sample_003', 'processed_sample3.webp', 'feet_photo_3.jpg', 312000, 8, 'approved', '2025-09-26 12:00:00', '2025-09-26 12:15:00');

INSERT INTO pending_photos (id, filename, original_name, size, status, uploaded_at) VALUES
    ('pending_001', 'pending_photo1.webp', 'new_feet_1.jpg', 198720, 'pending', '2025-09-26 13:00:00'),
    ('pending_002', 'pending_photo2.webp', 'new_feet_2.png', 267840, 'pending', '2025-09-26 13:30:00');

INSERT INTO reports (photo_id, reason, reported_at) VALUES
    ('sample_001', 'user_reported', '2025-09-26 14:00:00'),
    ('sample_002', 'user_reported', '2025-09-26 14:30:00');