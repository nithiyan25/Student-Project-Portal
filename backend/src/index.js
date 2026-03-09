require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const teamRoutes = require('./routes/teams');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const exportRoutes = require('./routes/export');
const settingsRoutes = require('./routes/settings');
const scopesRoutes = require('./routes/scopes');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const probingGuard = require('./middleware/probingGuard');
const { logSecurityAlert } = require('./utils/securityUtils');

const app = express();

// Trust exactly two proxy hops (e.g. Docker Gateway + College Proxy)
// This identifies the real client IP while satisfying express-rate-limit's security check
app.set('trust proxy', 2);

// CORS Configuration (Moved to top to ensure all responses, including errors, have CORS headers)
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Global Probing Guard (Catch malicious bots/scripts immediately)
app.use(probingGuard);

// Security Middleware (Helmet should come after CORS for some configurations, but staying here is fine)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// Request Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000, // Increased from 20,000 to 100,000 (~6,666/min)
  message: 'Too many requests, please try again later.',
  skip: (req) => req.path.startsWith('/auth') || req.path.startsWith('/api/auth'),
  handler: (req, res, next, options) => {
    console.warn(`[RATE_LIMIT_GLOBAL] Limit hit by IP: ${req.ip} | URL: ${req.originalUrl}`);
    logSecurityAlert(null, 'RATE_LIMIT_EXCEEDED', `IP address ${req.ip} exceeded global rate limit.`, req, 'LOW');
    res.status(options.statusCode).send(options.message);
  }
});

// Stricter limiter for Auth routes (Brute-force protection)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Increased from 100 to 1,000 per minute
  message: 'Too many login attempts. Please wait a minute.',
  handler: (req, res, next, options) => {
    console.warn(`[RATE_LIMIT_AUTH] Limit hit by IP: ${req.ip} | URL: ${req.originalUrl}`);
    logSecurityAlert(null, 'BRUTE_FORCE_ATTEMPT', `Possible brute-force detected on auth route from ${req.ip}: ${req.originalUrl}`, req, 'HIGH');
    res.status(options.statusCode).send(options.message);
  }
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Body Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/scopes', scopesRoutes);
app.use('/api/rubrics', require('./routes/rubrics'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/venues', require('./routes/venue'));
app.use('/api/security', require('./routes/security'));


const { authenticate, authorize } = require('./middleware/auth');
const prisma = require('./utils/prisma');


app.get('/api/my-team', authenticate, async (req, res) => {
  try {
    const member = await prisma.teammember.findUnique({
      where: { userId: req.user.id },
      include: {
        team: {
          include: {
            members: { include: { user: true } },
            project: {
              include: { scope: true }
            },
            reviews: {
              include: {
                faculty: true,
                reviewMarks: true
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!member) return res.json(null);

    const team = member.team;

    // Strip reviewMarks for students (enforce backend role check)
    if (req.user.role === 'STUDENT' && team.reviews) {
      team.reviews = team.reviews.map(r => {
        const { reviewMarks, ...rest } = r;
        return rest;
      });
    }

    res.json(team);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch team data" });
  }
});


app.get('/api/my-invitations', authenticate, authorize(['STUDENT']), async (req, res) => {
  try {
    const pendingMemberships = await prisma.teammember.findMany({
      where: {
        userId: req.user.id,
        approved: false
      },
      include: {
        team: {
          include: {
            members: { include: { user: true } },
            project: true,
            reviews: {
              include: { faculty: true },
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    const invitations = pendingMemberships.map(membership => {
      const firstMember = membership.team.members.find(m => m.approved)?.user || { name: 'Unknown', email: 'N/A' };

      return {
        teamId: membership.teamId,
        memberName: firstMember.name,
        memberEmail: firstMember.email,
        teamSize: membership.team.members.length,
        projectTitle: membership.team.project?.title || null,
        status: membership.team.status
      };
    });

    res.json(invitations);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

// 404 Handler - Must be after all routes
app.use(notFoundHandler);

// Error Handler - Must be last
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));