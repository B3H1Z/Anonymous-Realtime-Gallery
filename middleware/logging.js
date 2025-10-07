const winston = require('winston');
const path = require('path');

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Define log colors for console output
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
};

winston.addColors(logColors);

// Create winston logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'anonymous-gallery-api' },
    transports: [
        // Write all logs to file
        new winston.transports.File({
            filename: process.env.LOG_FILE || './server.log',
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            )
        }),

        // Write error logs to separate file
        new winston.transports.File({
            filename: './error.log',
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 3,
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            )
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
            })
        )
    }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // Log request
    logger.http('Incoming request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString(),
        requestId: req.id || Math.random().toString(36).substr(2, 9)
    });

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
        const duration = Date.now() - startTime;
        
        logger.http('Request completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            responseSize: JSON.stringify(data).length,
            timestamp: new Date().toISOString(),
            requestId: req.id || Math.random().toString(36).substr(2, 9)
        });
        
        return originalJson.call(this, data);
    };

    next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
    const errorId = Math.random().toString(36).substr(2, 9);
    
    logger.error('Request error', {
        errorId,
        message: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        body: req.method === 'POST' ? req.body : undefined,
        params: req.params,
        query: req.query,
        timestamp: new Date().toISOString()
    });

    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            errorId: errorId
        });
    } else {
        res.status(500).json({
            success: false,
            error: err.message,
            errorId: errorId,
            stack: err.stack
        });
    }
};

// Application event logging
const logAppEvent = (event, data = {}) => {
    logger.info(`App event: ${event}`, {
        event,
        ...data,
        timestamp: new Date().toISOString()
    });
};

// Security event logging
const logSecurityEvent = (event, req, additionalData = {}) => {
    logger.warn(`Security event: ${event}`, {
        event,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString(),
        ...additionalData
    });
};

// Business logic logging
const logBusinessEvent = (event, data = {}) => {
    logger.info(`Business event: ${event}`, {
        event,
        ...data,
        timestamp: new Date().toISOString()
    });
};

// Performance logging
const logPerformance = (operation, duration, additionalData = {}) => {
    logger.info(`Performance: ${operation}`, {
        operation,
        duration: `${duration}ms`,
        ...additionalData,
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    logger,
    requestLogger,
    errorLogger,
    logAppEvent,
    logSecurityEvent,
    logBusinessEvent,
    logPerformance
};