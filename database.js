const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DATABASE_URL || 'sqlite:./database.sqlite';
    }

    async initialize() {
        try {
            // Ensure data directory exists
            await fs.mkdir(path.dirname(this.dbPath.replace('sqlite:', '')), { recursive: true });

            // Initialize database
            const isSQLite = this.dbPath.startsWith('sqlite:');
            const dbPath = isSQLite ? this.dbPath.replace('sqlite:', '') : this.dbPath;

            this.db = new Database(dbPath);

            // Enable WAL mode for better concurrency
            if (isSQLite) {
                this.db.pragma('journal_mode = WAL');
                this.db.pragma('synchronous = NORMAL');
                this.db.pragma('cache_size = 1000000');
                this.db.pragma('foreign_keys = ON');
                this.db.pragma('temp_store = MEMORY');
            }

            await this.createTables();

        } catch (error) {
            console.error('❌ Database initialization error:', error);
            throw error;
        }
    }

    async createTables() {
        const tables = [
            // Photos table
            `CREATE TABLE IF NOT EXISTS photos (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                size INTEGER NOT NULL,
                likes INTEGER DEFAULT 0,
                report_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                approved_at DATETIME NULL
            )`,

            // Reports table
            `CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id TEXT NOT NULL,
                reason TEXT DEFAULT 'user_reported',
                reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
            )`,

            // Admin users table
            `CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME NULL
            )`,

            // System settings table
            `CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // User likes tracking table (for preventing duplicate likes)
            `CREATE TABLE IF NOT EXISTS user_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id TEXT NOT NULL,
                user_identifier TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(photo_id, user_identifier),
                FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
            )`,

            // User reports tracking table (for preventing duplicate reports)
            `CREATE TABLE IF NOT EXISTS user_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id TEXT NOT NULL,
                user_identifier TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                reason TEXT DEFAULT 'user_reported',
                reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(photo_id, user_identifier),
                FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
            )`,

            // Indexes for better performance
            `CREATE INDEX IF NOT EXISTS idx_photos_status ON photos (status)`,
            `CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos (created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_photos_likes ON photos (likes)`,
            `CREATE INDEX IF NOT EXISTS idx_reports_photo_id ON reports (photo_id)`,
            `CREATE INDEX IF NOT EXISTS idx_reports_reported_at ON reports (reported_at)`
        ];

        for (const tableSQL of tables) {
            this.db.exec(tableSQL);
        }
    }

    // Photo operations
    async getPhotos(page = 0, limit = 12, sortBy = 'recent') {
        const offset = page * limit;

        let orderBy = 'created_at DESC';
        if (sortBy === 'liked') {
            orderBy = 'likes DESC, created_at DESC';
        } else if (sortBy === 'recent') {
            orderBy = 'created_at DESC';
        }

        const stmt = this.db.prepare(`
            SELECT * FROM photos
            WHERE status = 'approved'
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `);

        const photos = stmt.all(limit, offset);

        // Get total count
        const countStmt = this.db.prepare(`
            SELECT COUNT(*) as total FROM photos WHERE status = 'approved'
        `);
        const total = countStmt.get().total;

        return {
            photos,
            hasMore: offset + limit < total,
            total
        };
    }

    async getPhotoById(id) {
        const stmt = this.db.prepare('SELECT * FROM photos WHERE id = ?');
        return stmt.get(id);
    }

    async addPhoto(photoData) {
        const stmt = this.db.prepare(`
            INSERT INTO photos (id, filename, original_name, size, likes, report_count, status, created_at, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        return stmt.run(
            photoData.id,
            photoData.filename,
            photoData.originalName,
            photoData.size,
            photoData.likes || 0,
            photoData.reportCount || 0,
            photoData.status || 'pending',
            photoData.createdAt,
            photoData.uploadedAt
        );
    }

    async updatePhoto(id, updates) {
        const fields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
        const values = Object.values(updates);

        const stmt = this.db.prepare(`UPDATE photos SET ${fields} WHERE id = ?`);
        return stmt.run(...values, id);
    }

    async deletePhoto(id) {
        const stmt = this.db.prepare('DELETE FROM photos WHERE id = ?');
        return stmt.run(id);
    }

    // Pending photos operations
    async getPendingPhotos() {
        const stmt = this.db.prepare('SELECT * FROM photos WHERE status = ? ORDER BY created_at ASC');
        return stmt.all('pending');
    }

    async approvePhoto(id) {
        const stmt = this.db.prepare(`
            UPDATE photos
            SET status = 'approved', approved_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'pending'
        `);
        return stmt.run(id);
    }

    async rejectPhoto(id) {
        const stmt = this.db.prepare('DELETE FROM photos WHERE id = ? AND status = \'pending\'');
        return stmt.run(id);
    }

    // Like operations
    async likePhoto(id) {
        const stmt = this.db.prepare(`
            UPDATE photos
            SET likes = likes + 1
            WHERE id = ? AND status = 'approved'
        `);
        const result = stmt.run(id);

        if (result.changes > 0) {
            const getStmt = this.db.prepare('SELECT likes FROM photos WHERE id = ?');
            return getStmt.get(id).likes;
        }
        return null;
    }

    // Enhanced like operations with duplicate prevention
    async hasUserLikedPhoto(photoId, userIdentifier) {
        const stmt = this.db.prepare(`
            SELECT id FROM user_likes
            WHERE photo_id = ? AND user_identifier = ?
        `);
        const result = stmt.get(photoId, userIdentifier);
        return !!result;
    }

    async recordUserLike(photoId, userIdentifier, ipAddress = null, userAgent = null) {
        try {
            // Check if already liked
            const existing = await this.hasUserLikedPhoto(photoId, userIdentifier);
            if (existing) {
                return { alreadyLiked: true };
            }

            // Insert the like record
            const stmt = this.db.prepare(`
                INSERT INTO user_likes (photo_id, user_identifier, ip_address, user_agent)
                VALUES (?, ?, ?, ?)
            `);
            stmt.run(photoId, userIdentifier, ipAddress, userAgent);

            // Increment the photo's like count
            const updateStmt = this.db.prepare(`
                UPDATE photos
                SET likes = likes + 1
                WHERE id = ? AND status = 'approved'
            `);
            const result = updateStmt.run(photoId);

            if (result.changes > 0) {
                const getStmt = this.db.prepare('SELECT likes FROM photos WHERE id = ?');
                const newLikes = getStmt.get(photoId).likes;
                return { success: true, likes: newLikes, action: 'liked' };
            }

            return { success: false, error: 'Photo not found or not approved' };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return { alreadyLiked: true };
            }
            throw error;
        }
    }

    async removeUserLike(photoId, userIdentifier) {
        try {
            // Check if user has liked the photo
            const existing = await this.hasUserLikedPhoto(photoId, userIdentifier);
            if (!existing) {
                return { notLiked: true };
            }

            // Remove the like record
            const deleteStmt = this.db.prepare(`
                DELETE FROM user_likes
                WHERE photo_id = ? AND user_identifier = ?
            `);
            const deleteResult = deleteStmt.run(photoId, userIdentifier);

            if (deleteResult.changes > 0) {
                // Decrement the photo's like count
                const updateStmt = this.db.prepare(`
                    UPDATE photos
                    SET likes = likes - 1
                    WHERE id = ? AND status = 'approved' AND likes > 0
                `);
                const updateResult = updateStmt.run(photoId);

                const getStmt = this.db.prepare('SELECT likes FROM photos WHERE id = ?');
                const newLikes = getStmt.get(photoId).likes;

                return { success: true, likes: newLikes, action: 'unliked' };
            }

            return { success: false, error: 'Failed to remove like' };
        } catch (error) {
            throw error;
        }
    }

    async toggleUserLike(photoId, userIdentifier, ipAddress = null, userAgent = null) {
        const existing = await this.hasUserLikedPhoto(photoId, userIdentifier);

        if (existing) {
            return await this.removeUserLike(photoId, userIdentifier);
        } else {
            return await this.recordUserLike(photoId, userIdentifier, ipAddress, userAgent);
        }
    }

    // Report operations
    async reportPhoto(photoId, reason = 'user_reported') {
        // First increment report count
        const updateStmt = this.db.prepare(`
            UPDATE photos
            SET report_count = report_count + 1
            WHERE id = ? AND status = 'approved'
        `);
        updateStmt.run(photoId);

        // Then add to reports table
        const insertStmt = this.db.prepare(`
            INSERT INTO reports (photo_id, reason, reported_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        return insertStmt.run(photoId, reason);
    }

    // Enhanced report operations with duplicate prevention
    async hasUserReportedPhoto(photoId, userIdentifier) {
        const stmt = this.db.prepare(`
            SELECT id FROM user_reports
            WHERE photo_id = ? AND user_identifier = ?
        `);
        const result = stmt.get(photoId, userIdentifier);
        return !!result;
    }

    async recordUserReport(photoId, userIdentifier, reason = 'user_reported', ipAddress = null, userAgent = null) {
        try {
            // Check if already reported
            const existing = await this.hasUserReportedPhoto(photoId, userIdentifier);
            if (existing) {
                return { alreadyReported: true };
            }

            // Insert the report record in user_reports table (for duplicate prevention)
            const stmt = this.db.prepare(`
                INSERT INTO user_reports (photo_id, user_identifier, ip_address, user_agent, reason)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run(photoId, userIdentifier, ipAddress, userAgent, reason);

            // Also add to reports table so admin can see it (remove status restriction for visibility)
            const reportStmt = this.db.prepare(`
                INSERT OR IGNORE INTO reports (photo_id, reason, reported_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `);
            reportStmt.run(photoId, reason);

            // Increment the photo's report count (remove status restriction)
            const updateStmt = this.db.prepare(`
                UPDATE photos
                SET report_count = report_count + 1
                WHERE id = ?
            `);
            const result = updateStmt.run(photoId);

            if (result.changes > 0) {
                const getStmt = this.db.prepare('SELECT report_count FROM photos WHERE id = ?');
                const newReportCount = getStmt.get(photoId).report_count;
                return { success: true, reportCount: newReportCount };
            }

            return { success: false, error: 'Photo not found' };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return { alreadyReported: true };
            }
            throw error;
        }
    }

    async getReports() {
        const stmt = this.db.prepare(`
            SELECT r.id, r.photo_id, r.reason, r.reported_at, p.filename, p.original_name
            FROM reports r
            JOIN photos p ON r.photo_id = p.id
            ORDER BY r.reported_at DESC
        `);
        return stmt.all();
    }

    async getReportsWithValidation() {
        // First, get all reports with their photos
        const reports = await this.getReports();

        // Filter out any reports where the photo no longer exists
        const validReports = reports.filter(report => report.filename && report.original_name);

        // Log any orphaned reports for debugging
        const orphanedReports = reports.filter(report => !report.filename || !report.original_name);
        if (orphanedReports.length > 0) {
            orphanedReports.forEach(report => {
            });
        }

        return validReports;
    }

    // Admin operations
    async createAdminUser(username, passwordHash) {
        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO admin_users (username, password_hash)
            VALUES (?, ?)
        `);
        return stmt.run(username, passwordHash);
    }

    async getAdminUser(username) {
        const stmt = this.db.prepare('SELECT * FROM admin_users WHERE username = ?');
        return stmt.get(username);
    }

    async updateAdminLastLogin(username) {
        const stmt = this.db.prepare(`
            UPDATE admin_users
            SET last_login = CURRENT_TIMESTAMP
            WHERE username = ?
        `);
        return stmt.run(username);
    }

    // Settings operations
    async getSetting(key) {
        const stmt = this.db.prepare('SELECT value FROM system_settings WHERE key = ?');
        const result = stmt.get(key);
        return result ? result.value : null;
    }

    async setSetting(key, value) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO system_settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(key, value);
    }

    // Statistics
    async getStats() {
        const stats = {};

        // Total photos
        const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM photos WHERE status = ?');
        stats.totalPhotos = totalStmt.get('approved').count;

        // Pending photos
        stats.pendingPhotos = totalStmt.get('pending').count;

        // Total likes
        const likesStmt = this.db.prepare('SELECT SUM(likes) as total FROM photos WHERE status = ?');
        stats.totalLikes = likesStmt.get('approved').total || 0;

        // Total reports
        const reportsStmt = this.db.prepare('SELECT COUNT(*) as count FROM reports');
        stats.totalReports = reportsStmt.get().count;

        // Recent uploads (last 7 days)
        const recentStmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM photos
            WHERE status = 'approved' AND created_at >= datetime('now', '-7 days')
        `);
        stats.recentUploads = recentStmt.get().count;

        return stats;
    }

    // Migration helper: Import existing in-memory data
    async importFromMemory(photosArray, pendingPhotosArray, reportsArray) {
        try {
            // Import photos
            for (const photo of [...photosArray, ...pendingPhotosArray]) {
                await this.addPhoto(photo);
            }

            // Import reports
            for (const report of reportsArray) {
                await this.reportPhoto(report.photoId, report.reason);
            }

        } catch (error) {
            throw error;
        }
    }

    // Migration for like tracking system
    async migrateLikeSystem() {
        try {

            // Check if user_likes table exists and has data
            const tableCheck = this.db.prepare(`
                SELECT name FROM sqlite_master WHERE type='table' AND name='user_likes'
            `).get();

            if (!tableCheck) {
                return { success: true, message: 'Tables will be created on next startup' };
            }

            // Check if there's any data in the user_likes table
            const dataCheck = this.db.prepare('SELECT COUNT(*) as count FROM user_likes').get();

            if (dataCheck.count > 0) {
                return { success: true, message: 'Like tracking system already active' };
            }

            // Get photos that have likes but no individual tracking
            const photosWithLikes = this.db.prepare(`
                SELECT id, likes FROM photos WHERE likes > 0 AND status = 'approved'
            `).all();

            if (photosWithLikes.length > 0) {
            }

            return {
                success: true,
                message: 'Like tracking system ready',
                photosWithExistingLikes: photosWithLikes.length
            };

        } catch (error) {
            throw error;
        }
    }

    // Cleanup method
    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;