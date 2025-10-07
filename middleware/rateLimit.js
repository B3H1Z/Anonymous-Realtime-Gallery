const rateLimit = require('express-rate-limit');
const { logSecurityEvent } = require('./logging');

// Custom handler for rate limit exceeded
const rateLimitHandler = (req, res) => {
    logSecurityEvent('rate_limit_exceeded', req, {
        rateLimitInfo: {
            totalHits: req.rateLimit.totalHits,
            limit: req.rateLimit.limit,
            remaining: req.rateLimit.remaining,
            resetTime: new Date(req.rateLimit.resetTime)
        }
    });

    res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment and try again.',
        retryAfter: Math.round(req.rateLimit.resetTime / 1000),
        message: 'Rate limit exceeded. Please try again later.'
    });
};

// Skip function to bypass rate limiting for certain conditions
const skipSuccessfulRequests = (req, res) => {
    // Skip counting successful requests for certain endpoints
    return res.statusCode < 400;
};

// Different rate limits for different endpoint types

// General API rate limit - moderate limits for general use
const generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window per IP
    message: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipSuccessfulRequests
});

// Strict rate limit for sensitive operations (upload, admin)
const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window per IP
    message: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false // Count all requests for sensitive operations
});

// Upload specific rate limit - very strict
const uploadRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 uploads per hour per IP
    message: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

// Admin login rate limit - extremely strict to prevent brute force
const adminLoginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 attempts per window per IP
    message: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

// Like/Report actions rate limit - moderate but controlled
const actionRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 actions per 5 minutes per IP
    message: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

// CAPTCHA verification rate limit - prevent CAPTCHA farming
const captchaRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 15, // 15 CAPTCHA verifications per 10 minutes per IP
    message: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

// Health check rate limit - very lenient for monitoring
const healthCheckRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute per IP
    message: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipSuccessfulRequests
});

// Photo loading rate limit - more permissive for infinite scroll
const photoLoadRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // 120 requests per minute per IP (2 requests per second)
    message: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false // Count all requests but be more permissive
});

module.exports = {
    generalRateLimit,
    strictRateLimit,
    uploadRateLimit,
    adminLoginRateLimit,
    actionRateLimit,
    captchaRateLimit,
    healthCheckRateLimit,
    photoLoadRateLimit
};