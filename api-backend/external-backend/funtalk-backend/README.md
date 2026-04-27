# Funtalk Backend API

Backend API for Funtalk Platform - B2B English Learning Platform

## Tech Stack

- **Runtime:** Node.js (JavaScript/ES6 Modules)
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Authentication:** JWT (JSON Web Tokens)
- **Validation:** express-validator

## Project Structure

```
backend/
├── config/
│   ├── config.js           # Application configuration
│   └── database.js         # PostgreSQL connection pool
├── controllers/            # Route controllers (business logic)
│   ├── authController.js
│   ├── appointmentController.js
│   ├── teacherController.js
│   ├── availabilityController.js
│   ├── studentController.js
│   ├── creditController.js
│   ├── billingController.js
│   ├── userController.js
│   ├── materialController.js
│   └── meetingController.js
├── middleware/
│   ├── auth.js            # Authentication & authorization
│   ├── errorHandler.js    # Global error handling
│   └── validation.js      # Request validation
├── routes/                # API routes organized by purpose
│   ├── index.js           # Route aggregator
│   ├── auth.js            # Authentication routes
│   ├── users.js           # User management routes
│   ├── teachers.js        # Teacher management routes
│   ├── appointments.js    # Appointment/booking routes
│   ├── availability.js    # Teacher availability routes
│   ├── students.js        # Student profile routes
│   ├── credits.js         # Credit management routes
│   ├── billing.js         # Billing & payment routes
│   ├── materials.js       # Teaching material routes
│   └── meetings.js        # Meeting link routes
├── .env.example           # Environment variables template
├── .gitignore
├── package.json
├── server.js              # Application entry point
└── README.md
```

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` file with your database credentials and configuration.

3. **Set up database:**
   - Run the SQL scripts from `docs/DATABASE.md` and `docs/DATABASE_ENHANCEMENTS.sql`
   - Ensure PostgreSQL is running and accessible

4. **Start the server:**
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register new user (Admin only)
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout user

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/status` - Update user status (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)

### Teachers
- `GET /api/teachers` - Get all teachers
- `GET /api/teachers/:id` - Get teacher by ID
- `POST /api/teachers` - Create teacher (Admin only)
- `PUT /api/teachers/:id` - Update teacher
- `PUT /api/teachers/:id/status` - Update teacher status (Admin only)
- `GET /api/teachers/:id/availability` - Get teacher availability
- `GET /api/teachers/:id/appointments` - Get teacher appointments

### Appointments
- `GET /api/appointments` - Get all appointments
- `GET /api/appointments/:id` - Get appointment by ID
- `POST /api/appointments` - Create appointment (School only)
- `PUT /api/appointments/:id/status` - Update appointment status
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment
- `GET /api/appointments/:id/history` - Get appointment history
- `POST /api/appointments/:id/feedback` - Add teacher feedback

### Availability
- `GET /api/availability/teacher/:teacherId` - Get teacher availability
- `GET /api/availability/teacher/:teacherId/available-slots` - Get available slots
- `POST /api/availability` - Set availability (Teacher only)
- `PUT /api/availability/:id` - Update availability (Teacher only)
- `DELETE /api/availability/:id` - Delete availability (Teacher only)
- `POST /api/availability/exceptions` - Add exception (Teacher only)
- `DELETE /api/availability/exceptions/:id` - Remove exception (Teacher only)

### Students
- `GET /api/students` - Get all students (School only)
- `GET /api/students/:id` - Get student by ID (School only)
- `POST /api/students` - Create student (School only)
- `PUT /api/students/:id` - Update student (School only)
- `DELETE /api/students/:id` - Delete student (School only)
- `GET /api/students/:id/appointments` - Get student appointments

### Credits
- `GET /api/credits/balance` - Get credit balance (School only)
- `GET /api/credits/transactions` - Get transaction history
- `POST /api/credits/adjust` - Adjust credits (Admin only)

### Billing
- `GET /api/billing/packages` - Get credit packages
- `GET /api/billing` - Get billing records
- `POST /api/billing/create` - Create billing (School only)
- `GET /api/billing/:id` - Get billing by ID
- `POST /api/billing/:id/payment` - Record payment
- `POST /api/billing/:id/approve` - Approve payment (Admin only)
- `POST /api/billing/:id/invoice` - Generate invoice (Admin only)

### Materials
- `GET /api/materials` - Get all materials
- `GET /api/materials/:id` - Get material by ID
- `POST /api/materials` - Create material (Admin only)
- `PUT /api/materials/:id` - Update material (Admin only)
- `DELETE /api/materials/:id` - Delete material (Admin only)

### Meetings
- `GET /api/meetings/teacher/:teacherId` - Get teacher meetings
- `POST /api/meetings` - Create meeting link
- `PUT /api/meetings/:id` - Update meeting link
- `DELETE /api/meetings/:id` - Delete meeting link

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## User Roles

- **SUPERADMIN** - Full system access
- **ADMIN** - Operational staff, manages schools and teachers
- **SCHOOL** - Client institution, books classes for students
- **TEACHER** - Service provider, teaches classes

## Environment Variables

See `.env.example` for required environment variables.

## Development

- Controllers are currently placeholders and need to be implemented with actual business logic
- Database queries should use the `query` helper from `config/database.js`
- Follow the existing route structure and validation patterns

## License

ISC

