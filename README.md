# Student Project Portal

A comprehensive full-stack web application for managing student projects, team formations, and faculty reviews with multi-phase evaluation support.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Contributing](#contributing)

## ✨ Features

### For Students
- **Team Formation**: Create teams and invite fellow students
- **Project Selection**: Browse and select from available projects
- **Progress Tracking**: Submit work for review and track status
- **Review Feedback**: Receive detailed feedback from faculty

### For Faculty
- **Review Assignments**: Access assigned projects for evaluation
- **Multi-Phase Reviews**: Support for multiple review phases
- **Individual Marking**: Assign individual marks to team members
- **Time-Limited Access**: Configurable access duration for reviews

### For Administrators
- **User Management**: Create and manage users (students, faculty, admins)
- **Project Management**: Add, edit, and delete projects
- **Team Management**: Create teams, assign projects, manage members
- **Faculty Assignment**: Assign faculty to projects with phase-specific access
- **Temporary Admin Access**: Grant temporary admin privileges to faculty
- **Bulk Operations**: Import users and projects in bulk

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js v5.2.1
- **Database**: MySQL
- **ORM**: Prisma v5.22.0
- **Authentication**: JWT + Google OAuth
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express-Validator
- **Logging**: Morgan

### Frontend
- **Framework**: React 19.2.0
- **Build Tool**: Vite v7.2.4
- **Routing**: React Router DOM v7.13.0
- **Styling**: TailwindCSS v3.4.17
- **HTTP Client**: Axios
- **Authentication**: @react-oauth/google

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MySQL**: v8.0 or higher
- **Git**: Latest version

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd Student_Project_Portal
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../client
npm install
```

## ⚙️ Configuration

### Backend Configuration

1. **Create Environment File**

```bash
cd backend
cp .env.example .env
```

2. **Configure Environment Variables**

Edit `.env` file with your configuration:

```env
# Database Configuration
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/student_portal_db"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"

# JWT Secret (Generate a strong random string)
JWT_SECRET="your-super-secret-jwt-key"

# Server Configuration
PORT=5000
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"
```

3. **Generate JWT Secret** (Optional but recommended)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. **Set Up Database**

Create a MySQL database:

```sql
CREATE DATABASE student_portal_db;
```

5. **Run Prisma Migrations**

```bash
npx prisma migrate dev
```

6. **Seed Database** (Optional)

```bash
node prisma/seed.js
```

### Frontend Configuration

1. **Create Environment File**

```bash
cd client
cp .env.example .env.local
```

2. **Configure Environment Variables**

Edit `.env.local` file:

```env
VITE_GOOGLE_CLIENT_ID="your-google-client-id"
VITE_API_URL="http://localhost:5000"
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Navigate to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen
6. Add authorized JavaScript origins:
   - `http://localhost:5173` (for development)
7. Add authorized redirect URIs:
   - `http://localhost:5173`
8. Copy the **Client ID** and paste it in both `.env` files

## 🏃 Running the Application

### Development Mode

1. **Start Backend Server**

```bash
cd backend
npm run dev
```

The backend will run on `http://localhost:5000`

2. **Start Frontend Development Server** (in a new terminal)

```bash
cd client
npm run dev
```

The frontend will run on `http://localhost:5173`

### Production Mode

1. **Build Frontend**

```bash
cd client
npm run build
```

2. **Start Backend**

```bash
cd backend
npm start
```

## 📁 Project Structure

```
Student_Project_Portal/
├── backend/
│   ├── prisma/
│   │   ├── migrations/      # Database migrations
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.js          # Database seeding script
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── auth.js           # Authentication middleware
│   │   │   ├── errorHandler.js   # Error handling middleware
│   │   │   └── validation.js     # Validation schemas
│   │   ├── routes/
│   │   │   ├── admin.js          # Admin routes
│   │   │   ├── auth.js           # Authentication routes
│   │   │   ├── projects.js       # Project routes
│   │   │   ├── reviews.js        # Review routes
│   │   │   ├── teams.js          # Team routes
│   │   │   └── users.js          # User routes
│   │   ├── utils/
│   │   │   ├── constants.js      # Application constants
│   │   │   └── prisma.js         # Prisma client
│   │   └── index.js              # Application entry point
│   ├── .env.example              # Environment template
│   ├── .gitignore
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── assets/               # Static assets
│   │   ├── components/           # React components
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Authentication context
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── FacultyDashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   └── StudentDashboard.jsx
│   │   ├── api.js                # Axios configuration
│   │   ├── App.jsx               # Main application component
│   │   ├── index.css             # Global styles
│   │   └── main.jsx              # Application entry point
│   ├── .env.example              # Environment template
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
└── README.md
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

#### Authentication
- `POST /auth/google` - Google OAuth login

#### Users (Admin Only)
- `GET /users?page=1&limit=10` - Get all users (paginated)
- `POST /users` - Create a user
- `POST /users/bulk` - Bulk create users
- `DELETE /users/:id` - Delete a user

#### Projects
- `GET /projects?page=1&limit=10&status=AVAILABLE` - Get all projects (paginated, filterable)
- `POST /projects` - Create a project (Admin)
- `POST /projects/bulk` - Bulk create projects (Admin)
- `DELETE /projects/:id` - Delete a project (Admin)

#### Teams
- `POST /teams` - Create a team (Student)
- `POST /teams/invite` - Invite a member (Student)
- `GET /teams/my-team` - Get current user's team
- `GET /teams/my-invitations` - Get pending invitations (Student)
- `POST /teams/accept` - Accept invitation (Student)
- `POST /teams/reject` - Reject invitation (Student)
- `POST /teams/select-project` - Select a project (Student)
- `POST /teams/submit-for-review` - Submit for review (Student)
- `DELETE /teams/:id` - Delete a team (Admin)

#### Reviews
- `GET /reviews/assignments?page=1&limit=10` - Get faculty assignments (Faculty/Admin, paginated)
- `POST /reviews` - Submit a review (Faculty/Admin)

#### Admin
- `GET /admin/teams?page=1&limit=10` - Get all teams (paginated)
- `POST /admin/assign-faculty` - Assign faculty to project
- `DELETE /admin/unassign-faculty/:assignmentId` - Remove faculty assignment
- `GET /admin/faculty-assignments?page=1&limit=10` - Get all faculty assignments (paginated)
- `POST /admin/toggle-temp-admin` - Grant/revoke temporary admin access
- `POST /admin/create-team` - Create a team manually
- `POST /admin/add-member` - Add member to team
- `POST /admin/assign-project` - Assign project to team
- `POST /admin/remove-member` - Remove member from team
- `POST /admin/change-leader` - Change team leader
- `POST /admin/unassign-project` - Unassign project from team
- `POST /admin/assign-solo-project` - One-step solo project assignment

### Pagination

List endpoints support pagination with query parameters:

```
GET /api/users?page=2&limit=20
```

Response format:
```json
{
  "users": [...],
  "pagination": {
    "total": 100,
    "page": 2,
    "limit": 20,
    "totalPages": 5
  }
}
```

## 🔒 Security

### Implemented Security Measures

- **Helmet**: Security headers protection
- **CORS**: Restricted to configured frontend URL
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Express-validator for all inputs
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **XSS Protection**: React's built-in XSS protection
- **Idle Timeout**: Automatic logout after 3 minutes of inactivity

### Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong JWT secrets** in production
3. **Enable HTTPS** in production
4. **Regularly update dependencies**
5. **Review and rotate credentials** periodically
6. **Monitor application logs** for suspicious activity

For more details, see [SECURITY.md](./SECURITY.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- Express.js team for the excellent framework
- Prisma team for the amazing ORM
- React team for the powerful UI library
- All contributors and supporters

## 📞 Support

For support, email your-email@example.com or open an issue in the repository.

---

**Happy Coding!** 🚀
