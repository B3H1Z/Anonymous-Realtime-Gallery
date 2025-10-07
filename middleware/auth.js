const jwt = require('jsonwebtoken');
const { logSecurityEvent } = require('./logging');

// In-memory token blacklist (in production, use Redis or database)
const tokenBlacklist = new Set();

// Enhanced JWT authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        logSecurityEvent('admin_access_no_token', req);
        return res.status(401).json({ 
            success: false, 
            error: 'Access token required',
            code: 'NO_TOKEN' 
        });
    }

    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
        logSecurityEvent('admin_access_blacklisted_token', req);
        return res.status(403).json({ 
            success: false, 
            error: 'Token has been revoked',
            code: 'TOKEN_REVOKED' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            logSecurityEvent('admin_access_invalid_token', req, { error: err.message });
            
            let errorMessage = 'Invalid token';
            let errorCode = 'INVALID_TOKEN';
            
            if (err.name === 'TokenExpiredError') {
                errorMessage = 'Token has expired';
                errorCode = 'TOKEN_EXPIRED';
            } else if (err.name === 'JsonWebTokenError') {
                errorMessage = 'Malformed token';
                errorCode = 'MALFORMED_TOKEN';
            }
            
            return res.status(403).json({ 
                success: false, 
                error: errorMessage,
                code: errorCode
            });
        }
        
        // Check if user has admin role
        if (!user.role || user.role !== 'admin') {
            logSecurityEvent('admin_access_insufficient_privileges', req, { 
                username: user.username,
                role: user.role 
            });
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient privileges',
                code: 'INSUFFICIENT_PRIVILEGES' 
            });
        }
        
        req.user = user;
        next();
    });
};

// Generate access and refresh tokens
const generateTokens = (user) => {
    const payload = {
        username: user.username,
        id: user.id,
        role: 'admin' // Explicitly set admin role
    };

    const accessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '15m' } // Shorter access token lifetime
    );

    const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' } // Longer refresh token lifetime
    );

    return { accessToken, refreshToken };
};

// Verify refresh token and generate new access token
const refreshAccessToken = (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        // Generate new access token
        const payload = {
            username: decoded.username,
            id: decoded.id,
            role: decoded.role
        };

        const newAccessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        return { accessToken: newAccessToken };
    } catch (error) {
        throw new Error('Invalid refresh token');
    }
};

// Blacklist token (logout)
const blacklistToken = (token) => {
    tokenBlacklist.add(token);
    
    // Clean up expired tokens periodically (in production, use a proper cleanup mechanism)
    if (tokenBlacklist.size > 1000) {
        // Simple cleanup - in production use proper token expiry checking
        tokenBlacklist.clear();
    }
};

// Middleware to check admin role specifically
const requireAdminRole = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        logSecurityEvent('admin_access_role_check_failed', req, {
            username: req.user?.username,
            role: req.user?.role
        });
        return res.status(403).json({
            success: false,
            error: 'Admin privileges required',
            code: 'ADMIN_REQUIRED'
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    generateTokens,
    refreshAccessToken,
    blacklistToken,
    requireAdminRole
};
