/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses across the application
 */

const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Default error status and message
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Prisma-specific errors
    if (err.code === 'P2002') {
        return res.status(409).json({
            error: 'Duplicate entry. This record already exists.',
            field: err.meta?.target
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            error: 'Record not found'
        });
    }

    if (err.code === 'P2003') {
        return res.status(400).json({
            error: 'Invalid reference. Related record does not exist.'
        });
    }

    // Validation errors (from express-validator)
    if (err.array && typeof err.array === 'function') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.array()
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expired'
        });
    }

    // Generic error response
    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// 404 handler for undefined routes
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path
    });
};

module.exports = { errorHandler, notFoundHandler };

