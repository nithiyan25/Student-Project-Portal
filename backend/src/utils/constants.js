/**
 * Constants and Configuration
 * Centralized configuration values and magic numbers
 */

// JWT Configuration
const JWT_EXPIRY = '12h';
const JWT_IDLE_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds

// Pagination Defaults
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 5000;

// Team Status Values
const TEAM_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    NOT_COMPLETED: 'NOT_COMPLETED',
    IN_PROGRESS: 'IN_PROGRESS',
    CHANGES_REQUIRED: 'CHANGES_REQUIRED',
    READY_FOR_REVIEW: 'READY_FOR_REVIEW',
    COMPLETED: 'COMPLETED'
};

// Project Status Values
const PROJECT_STATUS = {
    AVAILABLE: 'AVAILABLE',
    ASSIGNED: 'ASSIGNED',
    COMPLETED: 'COMPLETED'
};

// User Roles
const USER_ROLES = {
    ADMIN: 'ADMIN',
    FACULTY: 'FACULTY',
    STUDENT: 'STUDENT'
};

// Review Phases
const REVIEW_PHASES = {
    PHASE_1: 1,
    PHASE_2: 2,
    PHASE_3: 3
};

// Error Messages
const ERROR_MESSAGES = {
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'Access denied. Insufficient permissions.',
    NOT_FOUND: 'Resource not found',
    VALIDATION_ERROR: 'Validation failed',
    SERVER_ERROR: 'Internal server error',
    ALREADY_IN_TEAM: 'User is already in a team',
    PROJECT_TAKEN: 'Project is already assigned',
    TEAM_TOO_LARGE: 'Team size exceeds project limit',
    YEAR_MISMATCH: 'Team members must be from the same academic year',
    INVALID_CREDENTIALS: 'Invalid credentials'
};

module.exports = {
    JWT_EXPIRY,
    JWT_IDLE_TIMEOUT,
    DEFAULT_PAGE,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    TEAM_STATUS,
    PROJECT_STATUS,
    USER_ROLES,
    REVIEW_PHASES,
    ERROR_MESSAGES
};
