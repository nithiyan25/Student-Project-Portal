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

const app = express();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Request Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20000, // Limit each IP to 20000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

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
            project: true,
            reviews: {
              include: { faculty: true },
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });
    res.json(member ? member.team : null);
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