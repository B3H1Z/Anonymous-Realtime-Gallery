const Joi = require('joi');

// Validation middleware factory
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }))
            });
        }
        next();
    };
};

// Validation schemas
const schemas = {
    // Photo upload validation - terms acceptance is implicit by uploading
    photoUpload: Joi.object({
        captchaToken: Joi.string().min(10).required().messages({
            'string.empty': 'Captcha token is required',
            'string.min': 'Invalid captcha token',
            'any.required': 'Captcha verification is required'
        })
    }),

    // Admin login validation
    adminLogin: Joi.object({
        username: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).required().messages({
            'string.empty': 'Username is required',
            'string.pattern.base': 'Username must contain only alphanumeric characters and underscores',
            'string.min': 'Username must be at least 3 characters long',
            'string.max': 'Username must not exceed 30 characters'
        }),
        password: Joi.string().min(6).required().messages({
            'string.empty': 'Password is required',
            'string.min': 'Password must be at least 6 characters long'
        }),
        captchaToken: Joi.string().min(10).required().messages({
            'string.empty': 'Captcha token is required',
            'string.min': 'Invalid captcha token',
            'any.required': 'Captcha verification is required'
        })
    }),

    // Photo like validation
    photoLike: Joi.object({
        action: Joi.string().valid('like', 'unlike').required().messages({
            'any.only': 'Action must be either "like" or "unlike"',
            'any.required': 'Action is required'
        })
    }),

    // Photo report validation
    photoReport: Joi.object({
        reason: Joi.string().valid(
            'inappropriate_content',
            'spam',
            'copyright_violation', 
            'harassment',
            'nudity',
            'violence',
            'other'
        ).required().messages({
            'any.only': 'Invalid report reason',
            'any.required': 'Report reason is required'
        }),
        details: Joi.string().max(500).optional().messages({
            'string.max': 'Details must not exceed 500 characters'
        }),
        captchaToken: Joi.string().min(10).optional().messages({
            'string.empty': 'Captcha token is required',
            'string.min': 'Invalid captcha token'
        })
    }),

    // ID parameter validation
    photoId: Joi.object({
        id: Joi.string().required().messages({
            'string.base': 'Photo ID must be a string',
            'string.empty': 'Photo ID cannot be empty',
            'any.required': 'Photo ID is required'
        })
    })
};

// Parameter validation middleware
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.params);
        if (error) {
            return res.status(400).json({
                error: 'Invalid parameters',
                details: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }))
            });
        }
        next();
    };
};

// Query parameters validation
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.query);
        if (error) {
            return res.status(400).json({
                error: 'Invalid query parameters',
                details: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }))
            });
        }
        next();
    };
};

// Query schema for pagination
const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    sort: Joi.string().valid('newest', 'oldest', 'popular').optional().default('newest')
});

module.exports = {
    validateRequest,
    validateParams, 
    validateQuery,
    schemas,
    paginationSchema
};