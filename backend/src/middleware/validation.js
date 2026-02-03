/**
 * Validation Middleware and Schemas
 * Reusable validation rules using express-validator
 */

const { body, param, query, validationResult } = require('express-validator');
const { MAX_LIMIT } = require('../utils/constants');

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

/**
 * Common validation rules
 */
const commonValidations = {
    email: body('email')
        .trim()
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail(),

    name: body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),

    role: body('role')
        .isIn(['ADMIN', 'FACULTY', 'STUDENT'])
        .withMessage('Role must be ADMIN, FACULTY, or STUDENT'),

    uuid: param('id')
        .notEmpty()
        .withMessage('ID is required'),

    year: body('year')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Year must be between 1 and 5'),

    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: MAX_LIMIT })
            .withMessage(`Limit must be between 1 and ${MAX_LIMIT}`)
    ]
};

/**
 * User validation schemas
 */
const userValidation = {
    create: [
        commonValidations.email,
        commonValidations.name,
        commonValidations.role,
        body('rollNumber')
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage('Roll number must be between 1 and 50 characters'),
        body('department')
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Department must be between 2 and 100 characters'),
        commonValidations.year,
        validate
    ],

    bulkCreate: [
        body('users')
            .isArray({ min: 1 })
            .withMessage('Users must be a non-empty array'),
        body('users.*.email')
            .isEmail()
            .withMessage('Each user must have a valid email'),
        body('users.*.name')
            .notEmpty()
            .withMessage('Each user must have a name'),
        body('users.*.role')
            .isIn(['ADMIN', 'FACULTY', 'STUDENT'])
            .withMessage('Each user must have a valid role'),
        validate
    ],

    delete: [
        commonValidations.uuid,
        validate
    ],

    bulkDelete: [
        body('ids')
            .isArray({ min: 1 })
            .withMessage('IDs must be a non-empty array'),
        body('ids.*')
            .exists()
            .withMessage('Each ID must be valid'),
        validate
    ],

    update: [
        commonValidations.uuid,
        body('email')
            .optional()
            .trim()
            .isEmail()
            .withMessage('Must be a valid email address'),
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters'),
        body('rollNumber')
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 }),
        body('department')
            .optional()
            .trim(),
        body('year')
            .optional()
            .isInt({ min: 1, max: 5 }),
        validate
    ]
};

/**
 * Project validation schemas
 */
const projectValidation = {
    create: [
        body('title')
            .trim()
            .notEmpty()
            .withMessage('Title is required')
            .isLength({ min: 3, max: 200 })
            .withMessage('Title must be between 3 and 200 characters'),
        body('category')
            .trim()
            .notEmpty()
            .withMessage('Category is required'),
        body('maxTeamSize')
            .isInt({ min: 1, max: 10 })
            .withMessage('Max team size must be between 1 and 10'),
        body('description')
            .optional()
            .trim(),
        body('session')
            .optional()
            .trim(),
        body('scopeId')
            .optional({ nullable: true })
            .notEmpty()
            .withMessage('Invalid scope ID'),
        body('techStack')
            .optional()
            .trim(),
        body('srs')
            .optional()
            .trim(),
        validate
    ],

    bulkCreate: [
        body('projects')
            .isArray({ min: 1 })
            .withMessage('Projects must be a non-empty array'),
        body('projects.*.title')
            .notEmpty()
            .withMessage('Each project must have a title'),
        body('projects.*.category')
            .notEmpty()
            .withMessage('Each project must have a category'),
        validate
    ],

    delete: [
        commonValidations.uuid,
        validate
    ],

    bulkDelete: [
        body('ids')
            .isArray({ min: 1 })
            .withMessage('IDs must be a non-empty array'),
        body('ids.*')
            .exists()
            .withMessage('Each ID must be valid'),
        validate
    ],

    update: [
        commonValidations.uuid,
        body('title')
            .optional()
            .trim()
            .isLength({ min: 3, max: 200 }),
        body('category')
            .optional()
            .trim(),
        body('maxTeamSize')
            .optional()
            .isInt({ min: 1, max: 10 }),
        body('description')
            .optional()
            .trim(),
        body('status')
            .optional()
            .isIn(['AVAILABLE', 'ASSIGNED', 'REQUESTED']),
        body('techStack')
            .optional()
            .trim(),
        body('srs')
            .optional()
            .trim(),
        body('scopeId')
            .optional({ nullable: true })
            .notEmpty()
            .withMessage('Invalid scope ID'),
        validate
    ]
};

/**
 * Team validation schemas
 */
const teamValidation = {
    invite: [
        commonValidations.email,
        validate
    ],

    acceptReject: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        validate
    ],

    selectProject: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        body('projectId')
            .notEmpty()
            .withMessage('Invalid project ID'),
        validate
    ],

    delete: [
        commonValidations.uuid,
        validate
    ]
};

/**
 * Review validation schemas
 */
const reviewValidation = {
    submit: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        body('projectId')
            .notEmpty()
            .withMessage('Invalid project ID'),
        body('content')
            .optional()
            .trim()
            .isLength({ min: 1, max: 5000 })
            .withMessage('Content must be between 1 and 5000 characters'),
        body('status')
            .optional()
            .isIn(['NOT_COMPLETED', 'IN_PROGRESS', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED'])
            .withMessage('Invalid status'),
        body('reviewPhase')
            .optional()
            .isInt({ min: 1, max: 10 })
            .withMessage('Review phase must be between 1 and 10'),
        body('individualMarks')
            .optional()
            .isArray()
            .withMessage('Individual marks must be an array'),
        body('individualMarks.*.studentId')
            .if(body('individualMarks').exists())
            .exists()
            .withMessage('Invalid student ID in marks'),
        body('individualMarks.*.marks')
            .if(body('individualMarks').exists())
            .isInt({ min: 0, max: 100 })
            .withMessage('Marks must be between 0 and 100'),
        validate
    ],

    update: [
        commonValidations.uuid,
        body('content')
            .optional()
            .trim()
            .isLength({ min: 1, max: 5000 }),
        body('status')
            .optional()
            .isIn(['NOT_COMPLETED', 'IN_PROGRESS', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED']),
        validate
    ],

    updateMark: [
        param('id').notEmpty().withMessage('Invalid mark ID'),
        body('marks')
            .isInt({ min: 0, max: 100 })
            .withMessage('Marks must be between 0 and 100'),
        validate
    ]
};

/**
 * Admin validation schemas
 */
const adminValidation = {
    assignFaculty: [
        body('projectId')
            .notEmpty()
            .withMessage('Invalid project ID'),
        body('facultyId')
            .notEmpty()
            .withMessage('Invalid faculty ID'),
        body('accessDurationHours')
            .optional()
            .isInt({ min: 1, max: 8760 })
            .withMessage('Access duration must be between 1 and 8760 hours'),
        body('reviewPhase')
            .optional()
            .isInt({ min: 1, max: 10 })
            .withMessage('Review phase must be between 1 and 10'),
        body('mode')
            .optional()
            .isIn(['ONLINE', 'OFFLINE'])
            .withMessage("Mode must be 'ONLINE' or 'OFFLINE'"),
        body('accessStartsAt')
            .optional({ nullable: true })
            .isISO8601()
            .withMessage('Invalid start date/time format'),
        validate
    ],

    bulkAssignFaculty: [
        body('projectIds')
            .isArray({ min: 1 })
            .withMessage('Project IDs must be a non-empty array'),
        body('projectIds.*')
            .exists()
            .withMessage('Each Project ID must be valid'),
        body('facultyIds')
            .isArray({ min: 1 })
            .withMessage('Faculty IDs must be a non-empty array'),
        body('facultyIds.*')
            .exists()
            .withMessage('Each Faculty ID must be valid'),
        body('accessDurationHours')
            .optional()
            .isInt({ min: 1, max: 8760 })
            .withMessage('Access duration must be between 1 and 8760 hours'),
        body('reviewPhase')
            .optional()
            .isInt({ min: 1, max: 10 })
            .withMessage('Review phase must be between 1 and 10'),
        body('distributeEvenly')
            .optional()
            .isBoolean()
            .withMessage('Distribute evenly must be a boolean'),
        body('mode')
            .optional()
            .isIn(['ONLINE', 'OFFLINE'])
            .withMessage("Mode must be 'ONLINE' or 'OFFLINE'"),
        body('accessStartsAt')
            .optional({ nullable: true })
            .isISO8601()
            .withMessage('Invalid start date/time format'),
        validate
    ],

    bulkUnassignFaculty: [
        body('assignmentIds')
            .isArray({ min: 1 })
            .withMessage('Assignment IDs must be a non-empty array'),
        body('assignmentIds.*')
            .exists()
            .withMessage('Each Assignment ID must be valid'),
        validate
    ],

    bulkUpdateFacultyAccess: [
        body('assignmentIds')
            .isArray({ min: 1 })
            .withMessage('Assignment IDs must be a non-empty array'),
        body('assignmentIds.*')
            .exists()
            .withMessage('Each Assignment ID must be valid'),
        body('accessDurationHours')
            .optional({ nullable: true })
            .isInt({ min: 1, max: 8760 })
            .withMessage('Access duration must be between 1 and 8760 hours or null for permanent'),
        body('accessStartsAt')
            .optional({ nullable: true })
            .isISO8601()
            .withMessage('Invalid start date/time format'),
        validate
    ],

    createTeam: [
        commonValidations.email,
        validate
    ],

    addMember: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        commonValidations.email,
        validate
    ],

    assignProject: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        body('projectId')
            .notEmpty()
            .withMessage('Invalid project ID'),
        validate
    ],

    removeMember: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        body('userId')
            .notEmpty()
            .withMessage('Invalid user ID'),
        validate
    ],

    changeLeader: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        body('newLeaderId')
            .notEmpty()
            .withMessage('Invalid new leader ID'),
        validate
    ],

    toggleTempAdmin: [
        body('userId')
            .notEmpty()
            .withMessage('Invalid user ID'),
        body('grant')
            .isBoolean()
            .withMessage('Grant must be a boolean'),
        validate
    ],

    assignSoloProject: [
        body('studentId')
            .notEmpty()
            .withMessage('Invalid student ID'),
        body('projectId')
            .notEmpty()
            .withMessage('Invalid project ID'),
        validate
    ],

    assignTeamFaculty: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        body('facultyId')
            .notEmpty()
            .withMessage('Invalid faculty ID'),
        body('role')
            .isIn(['GUIDE', 'EXPERT'])
            .withMessage("Role must be 'GUIDE' or 'EXPERT'"),
        validate
    ],

    unassignTeamFaculty: [
        body('teamId')
            .notEmpty()
            .withMessage('Invalid team ID'),
        body('role')
            .isIn(['GUIDE', 'EXPERT'])
            .withMessage("Role must be 'GUIDE' or 'EXPERT'"),
        validate
    ]
};



/**
 * Rubric validation schemas
 */
const rubricValidation = {
    create: [
        body('name').trim().notEmpty().withMessage('Rubric name is required'),
        body('category').trim().notEmpty().withMessage('Category is required'),
        body('phase').isInt({ min: 1, max: 6 }).withMessage('Phase must be between 1 and 6'),
        body('criteria').isArray({ min: 1 }).withMessage('At least one criterion is required'),
        body('criteria.*.name').notEmpty().withMessage('Criterion name is required'),
        body('criteria.*.maxMarks').isInt({ min: 1 }).withMessage('Max marks must be positive'),
        validate
    ],
    update: [
        commonValidations.uuid,
        body('phase').optional().isInt({ min: 1, max: 6 }),
        body('criteria').optional().isArray({ min: 1 }),
        body('criteria.*.name').optional().notEmpty(),
        body('criteria.*.maxMarks').optional().isInt({ min: 1 }),
        validate
    ],
    delete: [
        commonValidations.uuid,
        validate
    ]
};

module.exports = {
    validate,
    commonValidations,
    userValidation,
    projectValidation,
    teamValidation,
    reviewValidation,
    adminValidation,
    rubricValidation
};
