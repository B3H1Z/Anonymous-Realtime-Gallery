const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const cors = require('cors');
const https = require('https');
const querystring = require('querystring');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const DatabaseManager = require('./database');
const { validateRequest, validateParams, schemas } = require('./middleware/validation');
const { logger, requestLogger, errorLogger, logAppEvent, logSecurityEvent, logBusinessEvent } = require('./middleware/logging');
const { generalRateLimit, uploadRateLimit, adminLoginRateLimit, actionRateLimit, healthCheckRateLimit, photoLoadRateLimit } = require('./middleware/rateLimit');
const { authenticateToken: authToken, generateTokens, refreshAccessToken, blacklistToken, requireAdminRole } = require('./middleware/auth');

// API Key validation middleware
const validateApiKey = (req, res, next) => {
    // Skip API key check for web interface requests (from same origin)
    const origin = req.get('origin') || req.get('referer');
    const userAgent = req.get('user-agent') || '';
    
    // Allow requests from the web interface (same domain/localhost)
    if (origin && (origin.includes('localhost:3000') || origin.includes(req.get('host')))) {
        return next();
    }
    
    // Allow requests from browsers with referer from same domain
    if (req.get('referer') && req.get('referer').includes(req.get('host'))) {
        return next();
    }
    
    // For external API access, require API key
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const validApiKeys = (process.env.API_KEYS || '').split(',').filter(key => key.length > 0);
    
    if (!apiKey) {
        logSecurityEvent('api_access_no_key', req, {
            origin: origin,
            userAgent: userAgent,
            endpoint: req.path
        });
        return res.status(401).json({ 
            success: false, 
            error: 'API key required for external access',
            message: 'Please provide a valid API key in X-API-Key header or api_key query parameter'
        });
    }
    
    if (!validApiKeys.includes(apiKey)) {
        logSecurityEvent('api_access_invalid_key', req, {
            providedKey: apiKey.substring(0, 8) + '***',
            origin: origin,
            userAgent: userAgent,
            endpoint: req.path
        });
        return res.status(403).json({ 
            success: false, 
            error: 'Invalid API key',
            message: 'The provided API key is not valid'
        });
    }
    
    // Log successful API key usage
    logAppEvent('api_key_access', {
        keyUsed: apiKey.substring(0, 8) + '***',
        endpoint: req.path,
        ip: req.ip,
        userAgent: userAgent
    });
    
    next();
};

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new DatabaseManager();

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS ?
            process.env.ALLOWED_ORIGINS.split(',') :
            ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173'];

        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use(express.static('dist'));

// Add request logging middleware
app.use(requestLogger);

// Add general rate limiting to all API routes
app.use('/api', generalRateLimit);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
        }
    }
});

// Helper function to verify hCaptcha using native HTTPS
async function verifyCaptcha(token) {
    try {
        const secretKey = process.env.HCAPTCHA_SECRET_KEY || '0x0000000000000000000000000000000000000000';

        if (!token || typeof token !== 'string' || token.length < 10) {
            return false;
        }

        const postData = querystring.stringify({
            secret: secretKey,
            response: token,
        });

        const options = {
            hostname: 'hcaptcha.com',
            port: 443,
            path: '/siteverify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';


                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const responseData = JSON.parse(data);
                        resolve(responseData.success || false);
                    } catch (parseError) {
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                resolve(false);
            });

            req.write(postData);
            req.end();
        });

    } catch (error) {
        return false;
    }
}

// Image processing function
async function processImage(buffer, filename) {
    try {
        if (!buffer || buffer.length === 0) {
            throw new Error('Empty image buffer');
        }

        const processedBuffer = await sharp(buffer)
            .resize(1200, null, {
                withoutEnlargement: true,
                fit: 'inside'
            })
            .webp({ quality: 80 })
            .toBuffer();

        const safeName = path.parse(filename).name
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');

        const processedFilename = `processed_${safeName}_${Date.now()}.webp`;
        await fs.writeFile(path.join(__dirname, 'public', 'images', processedFilename), processedBuffer);

        return {
            success: true,
            filename: processedFilename,
            size: processedBuffer.length
        };
    } catch (error) {
        throw new Error('Failed to process image');
    }
}

// Middleware to verify JWT token
// Authentication middleware moved to ./middleware/auth.js

// Initialize database and create default admin user
async function initializeApp() {
    try {
        await db.initialize();

        // Run like system migration check
        try {
            const migrationResult = await db.migrateLikeSystem();
            if (migrationResult.photosWithExistingLikes > 0) {
            }
        } catch (migrationError) {
            // Don't fail startup for migration issues
        }

        // Create default admin user if it doesn't exist
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        const existingAdmin = await db.getAdminUser(adminUsername);
        if (!existingAdmin) {
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
            await db.createAdminUser(adminUsername, passwordHash);
        }

    } catch (error) {
        console.error('❌ App initialization failed:', error);
        process.exit(1);
    }
}

// API Routes

// Get photos with pagination (API key required for external access)
app.get('/api/photos', validateApiKey, photoLoadRateLimit, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const limit = 12;
        const sortBy = req.query.sort || 'recent';

        const result = await db.getPhotos(page, limit, sortBy);

        res.json({
            success: true,
            photos: result.photos,
            hasMore: result.hasMore,
            total: result.total
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch photos' });
    }
});

// Check if image exists (API key required for external access)
app.get('/api/images/check/:filename', validateApiKey, async (req, res) => {
    try {
        const { filename } = req.params;
        const imagePath = path.join(__dirname, 'public', 'images', filename);
        
        // Check if file exists using fs.access (non-blocking)
        try {
            await fs.access(imagePath);
            res.json({ success: true, exists: true, filename });
        } catch (error) {
            res.json({ success: true, exists: false, filename });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to check image' });
    }
});


// Upload new photo
app.post('/api/photos/upload', uploadRateLimit, upload.single('image'), validateRequest(schemas.photoUpload), async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image file provided' });
        }


        // Verify CAPTCHA (skip in development if using test keys)
        const { captchaToken } = req.body;
        const isDevelopment = process.env.NODE_ENV === 'development';
        const secretKey = process.env.HCAPTCHA_SECRET_KEY || '0x0000000000000000000000000000000000000000';

        // Skip captcha verification in development or if using test keys or bypass token
        let isCaptchaValid = true;
        const isTestKey = secretKey.includes('0x0000000000000000000000000000000000000000');
        const isBypassToken = captchaToken === 'dev-bypass-token';
        
        if (!isDevelopment && !isTestKey && !isBypassToken) {
            if (!captchaToken) {
                return res.status(400).json({ success: false, error: 'Captcha verification required' });
            }
            if (!isBypassToken) {
                isCaptchaValid = await verifyCaptcha(captchaToken);
                if (!isCaptchaValid) {
                    return res.status(400).json({ success: false, error: 'Invalid captcha' });
                }
            }
        } else {
        }

        const processedImage = await processImage(req.file.buffer, req.file.originalname);

        const photo = {
            id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            filename: processedImage.filename,
            originalName: req.file.originalname,
            size: processedImage.size,
            likes: 0,
            reportCount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
            uploadedAt: new Date().toISOString()
        };

        await db.addPhoto(photo);
        
        // Log business event
        logBusinessEvent('photo_uploaded', {
            photoId: photo.id,
            filename: processedImage.filename,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            ip: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            message: 'Photo uploaded successfully and is pending review',
            photo: {
                id: photo.id,
                message: 'Your photo has been submitted for review.'
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to upload photo', details: error.message });
    }
});

// Admin Routes

// Get photos with pagination for admin (admin only)
app.get('/api/admin/photos', authToken, validateApiKey, photoLoadRateLimit, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 50;
        const sortBy = req.query.sort || 'recent';

        const result = await db.getPhotos(page, limit, sortBy);

        res.json({
            success: true,
            photos: result.photos,
            hasMore: result.hasMore,
            total: result.total
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch photos' });
    }
});

// Admin login
app.post('/api/admin/login', adminLoginRateLimit, validateRequest(schemas.adminLogin), async (req, res) => {
    try {
        const { username, password, captchaToken } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password required' });
        }

        if (!captchaToken) {
            return res.status(400).json({ success: false, error: 'Captcha verification required' });
        }

        // Verify captcha (skip in development or if using test keys or bypass token)
        const isDevelopment = process.env.NODE_ENV === 'development';
        const secretKey = process.env.HCAPTCHA_SECRET_KEY || '0x0000000000000000000000000000000000000000';
        const isTestKey = secretKey.includes('0x0000000000000000000000000000000000000000');
        const isBypassToken = captchaToken === 'dev-bypass-token';

        let isCaptchaValid = true;
        if (!isDevelopment && !isTestKey && !isBypassToken) {
            isCaptchaValid = await verifyCaptcha(captchaToken);
            if (!isCaptchaValid) {
                return res.status(400).json({ success: false, error: 'Invalid captcha verification' });
            }
        } else {
        }

        const admin = await db.getAdminUser(username);
        if (!admin) {
            logSecurityEvent('admin_login_failed_user_not_found', req, { username });
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, admin.password_hash);
        if (!isValidPassword) {
            logSecurityEvent('admin_login_failed_invalid_password', req, { username });
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Update last login
        await db.updateAdminLastLogin(username);
        
        // Log successful admin login
        logBusinessEvent('admin_login_success', { username, adminId: admin.id });

        // Generate access and refresh tokens
        const { accessToken, refreshToken } = generateTokens({
            username: admin.username,
            id: admin.id
        });

        res.json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: { 
                username: admin.username,
                role: 'admin'
            },
            tokenExpiry: '15m' // Access token expires in 15 minutes
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Admin token refresh
app.post('/api/admin/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ 
                success: false, 
                error: 'Refresh token required' 
            });
        }

        const { accessToken } = refreshAccessToken(refreshToken);
        
        logBusinessEvent('admin_token_refreshed', {
            ip: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            accessToken,
            tokenExpiry: '15m'
        });

    } catch (error) {
        logSecurityEvent('admin_token_refresh_failed', req, { error: error.message });
        res.status(403).json({ 
            success: false, 
            error: 'Invalid refresh token' 
        });
    }
});

// Admin logout
app.post('/api/admin/logout', authToken, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token) {
            blacklistToken(token);
        }

        logBusinessEvent('admin_logout', {
            username: req.user?.username,
            ip: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Logout failed' });
    }
});

// Get pending photos (admin only)
app.get('/api/admin/pending', authToken, async (req, res) => {
    try {
        const photos = await db.getPendingPhotos();
        res.json({
            success: true,
            photos
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch pending photos' });
    }
});

// Get reports (admin only)
app.get('/api/admin/reports', authToken, async (req, res) => {
    try {
        const reports = await db.getReportsWithValidation();
        res.json({
            success: true,
            reports
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch reports' });
    }
});

// Delete any photo (admin only) - general delete endpoint
app.delete('/api/admin/photos/:id', authToken, validateParams(schemas.photoId), async (req, res) => {
    try {
        const photoId = req.params.id;

        // Get photo details before deletion
        const photo = await db.getPhotoById(photoId);
        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo not found' });
        }

        // Delete processed image file if photo exists
        if (photo) {
            try {
                await fs.unlink(path.join(__dirname, 'public', 'images', photo.filename));
            } catch (fileError) {
                // Continue with database deletion even if file delete fails
            }
        }

        // Delete the photo from database (this will also cascade delete reports and likes due to foreign key)
        await db.deletePhoto(photoId);

        res.json({
            success: true,
            message: 'Photo deleted successfully'
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete photo' });
    }
});

// Delete reported photo (admin only)
app.delete('/api/admin/photos/:id/delete-reported', authToken, validateParams(schemas.photoId), async (req, res) => {
    try {
        const photoId = req.params.id;

        // Get photo details before deletion
        const photo = await db.getPhotoById(photoId);
        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo not found' });
        }

        // Delete processed image file if photo exists
        if (photo) {
            try {
                await fs.unlink(path.join(__dirname, 'public', 'images', photo.filename));
            } catch (fileError) {
            }
        }

        // Delete the photo from database (this will also cascade delete reports due to foreign key)
        await db.deletePhoto(photoId);

        res.json({
            success: true,
            message: 'Photo and all associated reports deleted successfully'
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete photo' });
    }
});

// Approve photo (admin only)
app.post('/api/admin/photos/:id/approve', authToken, validateParams(schemas.photoId), async (req, res) => {
    try {
        const photoId = req.params.id;

        await db.approvePhoto(photoId);

        res.json({
            success: true,
            message: 'Photo approved successfully'
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to approve photo' });
    }
});

// Reject photo (admin only)
app.post('/api/admin/photos/:id/reject', authToken, validateParams(schemas.photoId), async (req, res) => {
    try {
        const photoId = req.params.id;

        // Get photo details before deletion
        const photo = await db.getPhotoById(photoId);

        // Delete processed image file if photo exists
        if (photo) {
            try {
                await fs.unlink(path.join(__dirname, 'public', 'images', photo.filename));
            } catch (fileError) {
            }
        }

        await db.rejectPhoto(photoId);

        res.json({
            success: true,
            message: 'Photo rejected and deleted'
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to reject photo' });
        }
});

app.post('/api/photos/:id/like', actionRateLimit, validateParams(schemas.photoId), async (req, res) => {
    try {
        const photoId = req.params.id;
        const { captchaToken } = req.body;

        // Get client information for user identification
        const clientIP = req.ip ||
                        req.connection.remoteAddress ||
                        req.socket.remoteAddress ||
                        (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                        'unknown';

        const userAgent = req.get('User-Agent') || 'unknown';

        // Create a unique user identifier combining IP and user agent
        // This provides better tracking than IP alone while maintaining privacy
        const crypto = require('crypto');
        const userIdentifier = crypto
            .createHash('sha256')
            .update(clientIP + '|' + userAgent)
            .digest('hex')
            .substring(0, 16); // Use first 16 chars for reasonable uniqueness

        const isDevelopment = process.env.NODE_ENV === 'development';
        const secretKey = process.env.HCAPTCHA_SECRET_KEY || '0x0000000000000000000000000000000000000000';

        // Skip captcha verification in development or if using test keys
        let isCaptchaValid = true;
        if (!isDevelopment || !secretKey.includes('0x0000000000000000000000000000000000000000')) {
            if (!captchaToken) {
                return res.status(400).json({ success: false, error: 'Captcha verification required' });
            }
            isCaptchaValid = await verifyCaptcha(captchaToken);
            if (!isCaptchaValid) {
                return res.status(400).json({ success: false, error: 'Invalid captcha' });
            }
        } else {
        }

        // Use the enhanced toggle like system (allows both like and unlike)
        const result = await db.toggleUserLike(photoId, userIdentifier, clientIP, userAgent);

        if (result.alreadyLiked) {
            // This means the user tried to like but already liked (shouldn't happen with toggle)
            return res.status(409).json({
                success: false,
                error: 'You have already liked this photo',
                alreadyLiked: true
            });
        }

        if (result.notLiked) {
            // This means the user tried to unlike but hasn't liked (shouldn't happen with toggle)
            return res.status(409).json({
                success: false,
                error: 'You have not liked this photo',
                notLiked: true
            });
        }

        if (result.success) {
            res.json({
                success: true,
                likes: result.likes,
                action: result.action // 'liked' or 'unliked'
            });
        } else {
            return res.status(404).json({
                success: false,
                error: result.error || 'Photo not found or not approved'
            });
        }

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to like photo' });
    }
});

// Report a photo
app.post('/api/photos/:id/report', actionRateLimit, validateParams(schemas.photoId), validateRequest(schemas.photoReport), async (req, res) => {
    try {
        const { captchaToken, reason = 'user_reported' } = req.body
        const photoId = req.params.id;

        // Get client information for user identification
        const clientIP = req.ip ||
                        req.connection.remoteAddress ||
                        req.socket.remoteAddress ||
                        (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                        'unknown';

        const userAgent = req.get('User-Agent') || 'unknown';

        // Create a unique user identifier combining IP and user agent
        const crypto = require('crypto');
        const userIdentifier = crypto
            .createHash('sha256')
            .update(clientIP + '|' + userAgent)
            .digest('hex')
            .substring(0, 16);

        const isDevelopment = process.env.NODE_ENV === 'development';
        const secretKey = process.env.HCAPTCHA_SECRET_KEY || '0x0000000000000000000000000000000000000000';

        // Skip captcha verification in development or if using test keys
        let isCaptchaValid = true;
        if (!isDevelopment || !secretKey.includes('0x0000000000000000000000000000000000000000')) {
            if (!captchaToken) {
                return res.status(400).json({ success: false, error: 'Captcha verification required' });
            }
            isCaptchaValid = await verifyCaptcha(captchaToken);
            if (!isCaptchaValid) {
                return res.status(400).json({ success: false, error: 'Invalid captcha' });
            }
        } else {
        }

        // Use the enhanced report system with duplicate prevention
        const result = await db.recordUserReport(photoId, userIdentifier, reason, clientIP, userAgent);

        if (result.alreadyReported) {
            return res.status(409).json({
                success: false,
                error: 'You have already reported this photo',
                alreadyReported: true
            });
        }

        if (result.success) {
            res.json({
                success: true,
                message: 'Photo reported successfully',
                reportCount: result.reportCount
            });
        } else {
            return res.status(404).json({
                success: false,
                error: result.error || 'Photo not found or not approved'
            });
        }

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to report photo' });
    }
});

// Generate API key (admin only)
app.post('/api/admin/generate-api-key', authToken, async (req, res) => {
    try {
        const { keyName, expiresInDays = 30 } = req.body;
        
        if (!keyName || keyName.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'API key name must be at least 3 characters long'
            });
        }
        
        // Generate a secure random API key
        const crypto = require('crypto');
        const apiKey = 'pk_' + crypto.randomBytes(32).toString('hex');
        
        // In a real app, you'd store this in the database with expiration
        // For now, we'll just return it for manual addition to .env
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + expiresInDays);
        
        logAppEvent('api_key_generated', {
            adminUser: req.user?.username,
            keyName: keyName,
            keyPrefix: apiKey.substring(0, 8) + '***',
            expirationDate: expirationDate.toISOString(),
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'API key generated successfully',
            apiKey: apiKey,
            keyName: keyName,
            expirationDate: expirationDate.toISOString(),
            instructions: 'Add this key to your .env file in the API_KEYS variable (comma-separated for multiple keys)'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to generate API key' });
    }
});

// Get statistics (admin only)
app.get('/api/admin/stats', authToken, async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

// Health check endpoint
app.get('/api/health', healthCheckRateLimit, async (req, res) => {
    const healthCheck = {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: require('./package.json').version || '1.0.0',
        checks: {
            database: { status: 'unknown', responseTime: null },
            filesystem: { status: 'unknown', responseTime: null },
            memory: { status: 'unknown', usage: null },
            diskSpace: { status: 'unknown', available: null }
        },
        metrics: {
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        }
    };

    let overallHealthy = true;

    try {
        // Database connectivity check
        const dbStartTime = Date.now();
        await db.getPhotos(0, 1);
        const dbResponseTime = Date.now() - dbStartTime;
        
        healthCheck.checks.database = {
            status: dbResponseTime < 1000 ? 'healthy' : 'slow',
            responseTime: `${dbResponseTime}ms`
        };
        
        if (dbResponseTime >= 1000) overallHealthy = false;

    } catch (dbError) {
        healthCheck.checks.database = {
            status: 'unhealthy',
            error: dbError.message,
            responseTime: null
        };
        overallHealthy = false;
    }

    try {
        // Filesystem check - verify upload and public directories are accessible
        const fs = require('fs').promises;
        const fsStartTime = Date.now();
        
        await fs.access(process.env.UPLOAD_PATH || './uploads');
        await fs.access(process.env.PUBLIC_PATH || './public');
        
        const fsResponseTime = Date.now() - fsStartTime;
        healthCheck.checks.filesystem = {
            status: 'healthy',
            responseTime: `${fsResponseTime}ms`
        };

    } catch (fsError) {
        healthCheck.checks.filesystem = {
            status: 'unhealthy',
            error: fsError.message,
            responseTime: null
        };
        overallHealthy = false;
    }

    try {
        // Memory usage check
        const memUsage = process.memoryUsage();
        const totalMemory = memUsage.heapTotal;
        const usedMemory = memUsage.heapUsed;
        const memoryPercentage = (usedMemory / totalMemory) * 100;

        healthCheck.checks.memory = {
            status: memoryPercentage < 90 ? 'healthy' : 'high',
            usage: `${Math.round(memoryPercentage)}%`,
            heapUsed: `${Math.round(usedMemory / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(totalMemory / 1024 / 1024)}MB`
        };

        if (memoryPercentage >= 95) overallHealthy = false;

    } catch (memError) {
        healthCheck.checks.memory = {
            status: 'error',
            error: memError.message
        };
    }

    try {
        // Disk space check
        const fs = require('fs');
        const stats = fs.statSync('./');
        
        healthCheck.checks.diskSpace = {
            status: 'healthy',
            available: 'check_not_implemented' // Could be enhanced with additional libraries
        };

    } catch (diskError) {
        healthCheck.checks.diskSpace = {
            status: 'error',
            error: diskError.message
        };
    }

    // Set overall status
    healthCheck.status = overallHealthy ? 'healthy' : 'degraded';
    healthCheck.success = overallHealthy;

    // Log health check if requested with detailed=true
    if (req.query.detailed === 'true') {
        logAppEvent('health_check_detailed', {
            status: healthCheck.status,
            checks: healthCheck.checks
        });
    }

    // Return appropriate status code
    const statusCode = overallHealthy ? 200 : 503;
    res.status(statusCode).json(healthCheck);
});

// Detailed system status (admin only)
app.get('/api/admin/system-status', authToken, async (req, res) => {
    try {
        const systemStatus = {
            timestamp: new Date().toISOString(),
            server: {
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                pid: process.pid
            },
            memory: {
                ...process.memoryUsage(),
                heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            },
            database: {
                status: 'checking...'
            },
            performance: {
                cpuUsage: process.cpuUsage()
            }
        };

        // Database statistics
        try {
            const totalPhotos = await db.getPhotoCount();
            const pendingPhotos = await db.getPendingPhotos();
            const reports = await db.getReports();

            systemStatus.database = {
                status: 'connected',
                totalPhotos: totalPhotos || 0,
                pendingPhotos: pendingPhotos ? pendingPhotos.length : 0,
                totalReports: reports ? reports.length : 0
            };
        } catch (dbError) {
            systemStatus.database = {
                status: 'error',
                error: dbError.message
            };
        }

        logAppEvent('admin_system_status_accessed', {
            adminUser: req.user?.username,
            ip: req.ip
        });

        res.json({
            success: true,
            systemStatus
        });

    } catch (error) {
        logger.error('System status error', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve system status'
        });
    }
});

// Serve React app for all non-API routes (client-side routing)
app.get('*', (req, res) => {
    // Don't serve React app for API routes - they should return 404 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
    
    // Serve the React app index.html from the dist folder
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Global error handler with logging
app.use(errorLogger);

// Server startup with comprehensive logging
async function startServer() {
    try {

        // Initialize the application
        await initializeApp();

        // Start the server
        const server = app.listen(PORT, () => {
            
            // Log application startup
            logAppEvent('server_started', { 
                port: PORT, 
                env: process.env.NODE_ENV || 'development',
                nodeVersion: process.version 
            });

            // Write PID file for process management
            try {
                require('fs').writeFileSync('server.pid', process.pid.toString());
            } catch (pidError) {
            }
        });

        // Handle server events
        server.on('error', (error) => {
            console.error('💥 Server error:', error);
            if (error.syscall !== 'listen') {
                throw error;
            }

            switch (error.code) {
                case 'EACCES':
                    break;
                case 'EADDRINUSE':
                    break;
                default:
                    break;
            }
            process.exit(1);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            server.close(() => {
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            server.close(() => {
                process.exit(0);
            });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });


    } catch (error) {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer().catch((error) => {
    console.error('💥 Server startup failed:', error);
    process.exit(1);
});