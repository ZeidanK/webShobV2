# Event Monitoring and Management Platform

A comprehensive security and public safety solution that integrates video surveillance, mobile citizen reporting, and emergency response coordination into a unified operational system.

## 🎯 Project Overview

The **Event Monitoring and Management Platform** serves municipalities, security operation centers, critical infrastructure facilities, and public safety organizations that require real-time situational awareness and coordinated incident management.

### Key Features

- **Multi-Source Signal Aggregation**: Combines automated AI detection, citizen reports, and responder updates into a single platform
- **Unified Operational Dashboard**: Control room operators access a shared situational picture across all data sources
- **Video Integration**: Live streaming and historical playback of security cameras with time-alignment to incidents
- **Mobile Citizen Engagement**: Easy mobile app for citizens to submit incident reports with location and media
- **Real-Time Coordination**: WebSocket-based live updates for operators and first responders
- **Multi-Tenant Architecture**: Complete data isolation between different organizations
- **RBAC & Audit Trail**: Role-based access control with complete audit logging for compliance

### Target Users

- **Control Room Operators**: Dashboard access for monitoring and incident management
- **Security Managers**: Analytics, reporting, and resource planning
- **First Responders**: Real-time assignments and location intelligence
- **Citizens**: Mobile app for incident reporting
- **System Administrators**: User and platform configuration

---

## 🏗️ System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────┐
│           Frontend Layer (React Dashboard)           │
│  Web App + Citizen Mobile App + Responder Mobile App│
└────────────────────┬────────────────────────────────┘
                     │ HTTPS + WebSocket
┌────────────────────▼────────────────────────────────┐
│            Backend API (Node.js/Express)             │
│    - Authentication & Authorization                 │
│    - Event Management                               │
│    - User & Company Management                      │
│    - Real-Time WebSocket Server                     │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──┐  ┌──────▼────┐  ┌───▼────────┐
│ MongoDB  │  │ AI Service│  │ Video      │
│ Database │  │ (Python)  │  │ Management │
└──────────┘  └───────────┘  └────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Backend API** | Node.js + TypeScript | 18 LTS |
| **Database** | MongoDB | 5.0+ |
| **Web Frontend** | React + TypeScript | 18+ |
| **Mobile Apps** | React Native + TypeScript | 0.72+ |
| **AI Service** | Python + FastAPI | 3.9+ |
| **Containerization** | Docker & Docker Compose | Latest |

### Key Architecture Principles

- **Multi-Tenant by Design**: All queries enforce tenant isolation by `companyId`
- **Correlation ID Tracking**: All requests tracked with unique correlation IDs for debugging
- **Structured JSON Logging**: Complete audit trail for all data mutations
- **Human-in-the-Loop**: AI provides signals; humans make final decisions
- **Real-Time by Default**: WebSocket broadcasts state changes immediately

---

## 📋 Prerequisites

Before running the project, ensure you have the following installed:

- **Docker**: Version 20.10 or higher ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose**: Version 1.29 or higher (usually included with Docker Desktop)
- **Git**: For cloning the repository
- **Node.js**: Version 18 LTS (if running services locally without Docker)
- **Python**: Version 3.9+ (if running AI service locally)

### System Requirements

- **RAM**: Minimum 4GB (8GB recommended for comfortable development)
- **Disk Space**: 10GB free space for Docker images and database volumes
- **Ports**: Ensure these ports are available:
  - `3000` - Backend API
  - `5173` - Frontend Development Server
  - `8000` - AI Service  - `8080` - Shinobi VMS (Video Management System)  - `27017` - MongoDB Database

---

## 🚀 Quick Start Guide (Using Docker Compose)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd webShobV2
```

### 2. Copy Environment Configuration

```bash
# Copy example environment file (if available)
# Adjust settings as needed in docker-compose.yml
```

### 3. Start All Services

Start the entire stack with a single command:

```bash
docker-compose up --build -d
```

This command will:
- Build all Docker images for backend, frontend, and AI service
- Start MongoDB database
- Start the backend API server
- Start the frontend development server
- Start the AI service

### 4. Verify Services are Running

Check that all services are healthy:

```bash
docker-compose ps
```

You should see all services with status `Up` and health status `(healthy)` or `healthy`.

### 5. Access the Application

Open your browser and navigate to:

- **Frontend Dashboard**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Documentation (Swagger)**: http://localhost:3000/api/docs
- **AI Service**: http://localhost:8000

- **Shinobi VMS**: http://localhost:8080 (default: admin@shinobi.local / admin123)
### 6. Verify Everything is Working

Check the health endpoints:

```bash
# Backend health check
curl http://localhost:3000/api/health

# AI Service health check
curl http://localhost:8000/health
```

### 7. Seed Demo Data (Optional)

The project includes database seeding scripts to quickly set up test users and demo data:

**Option 1: Seed Test Users (Recommended for Development)**

Creates a test company with multiple user roles:

```bash
# From project root
docker-compose exec backend npm run seed

# Or run locally
cd backend && npm run seed
```

**Test Users Created:**
- **Super Admin**
  - Email: `admin@test.com`
  - Password: `Admin123!`
  - Role: `super_admin` (system-wide access)

- **Company Admin**
  - Email: `companyadmin@test.com`
  - Password: `Admin123!`
  - Role: `company_admin` (manage company and users)

- **Operator**
  - Email: `operator@test.com`
  - Password: `Operator123!`
  - Role: `operator` (dashboard access for monitoring)

**Option 2: Seed Demo Cameras and VMS Setup**

Creates demo users, VMS server, and test camera with working stream:

```bash
# From project root
docker-compose exec backend npm run seed:demo

# Or run locally
cd backend && npm run seed:demo
```

**Demo Users Created:**
- **Admin**
  - Email: `admin@demo.local`
  - Password: `admin123`
  - Role: `admin` (full camera management)

- **Operator**
  - Email: `operator@demo.local`
  - Password: `operator123`
  - Role: `operator` (view and edit cameras)

**Demo Data Includes:**
- Demo Company configured for cameras, events, and reports
- VMS Server connected to local Shinobi (localhost:8080)
- Test camera with working public HLS stream
- Geo-located camera in Tel Aviv coordinates

---

## 🔧 Detailed Service Setup

### Backend Service

The backend API is built with Node.js, Express, and TypeScript.

**Key Endpoints:**
- `GET /api/health` - Health check
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/docs` - Swagger API documentation

**Environment Variables** (configured in `docker-compose.yml`):
- `NODE_ENV=development`
- `PORT=3000`
- `MONGODB_URI=mongodb://mongodb:27017/event_monitoring_dev`
- `JWT_SECRET=development-secret-change-in-production`
- `LOG_LEVEL=debug`

**Folder Structure:**
```
backend/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── index.ts               # Server entry point
│   ├── middleware/            # Express middleware (auth, logging, etc.)
│   ├── routes/                # API route handlers
│   ├── models/                # MongoDB models
│   ├── services/              # Business logic
│   ├── config/                # Configuration files
│   └── utils/                 # Utilities (logger, error handler, etc.)
└── package.json
```

### Frontend Service

React TypeScript application with Vite as the build tool.

**Key Features:**
- Interactive event map with marker visualization
- Dashboard for operators
- Real-time WebSocket updates
- Responsive design for desktop and mobile

**Environment Variables** (configured in `docker-compose.yml`):
- `VITE_API_URL=/api` - Backend API base URL
- `VITE_WS_URL=http://localhost:3000` - WebSocket connection URL

**Folder Structure:**
```
frontend/
├── src/
│   ├── App.tsx                # Main app component
│   ├── main.tsx               # React entry point
│   ├── components/            # Reusable React components
│   ├── pages/                 # Page components
│   ├── hooks/                 # Custom React hooks
│   ├── services/              # API service clients
│   └── utils/                 # Utility functions
└── package.json
```

### Database Service

MongoDB document database with persistent volume storage.

**Connection Details:**
- **Host**: `mongodb` (from inside Docker network)
- **Port**: `27017`
- **Database**: `event_monitoring_dev`
- **URL**: `mongodb://mongodb:27017/event_monitoring_dev`

**Persistent Storage:**
- Data is stored in Docker volume `mongodb_data`
- Data persists between container restarts

### AI Service

Python FastAPI service for video analytics and detection.

**Purpose:**
- Process video streams for object detection
- Generate detection events
- Provide analysis endpoints for the backend

**Environment Variables:**
- `BACKEND_API_URL=http://backend:3000` - Backend API connection
- `LOG_LEVEL=INFO`

**Folder Structure:**
```
ai-service/
├── main.py                    # FastAPI application
├── requirements.txt           # Python dependencies
└── Dockerfile
```

---

## 💻 Running Services Locally (Without Docker)

### Backend Service

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev

# The server will start on http://localhost:3000
```

**Requirements:**
- Node.js 18+ installed
- MongoDB running on `mongodb://localhost:27017/event_monitoring_dev`

### Frontend Service

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

### AI Service

```bash
cd ai-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the service
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🧪 Testing

### Database Seeding

Before running tests, you may want to seed the database with test data:

```bash
# Seed test users (super_admin, company_admin, operator)
docker-compose exec backend npm run seed

# OR seed demo cameras and VMS setup
docker-compose exec backend npm run seed:demo
```

**Available Seed Scripts:**

| Script | Command | Purpose | Users Created |
|--------|---------|---------|---------------|
| **Test Data** | `npm run seed` | Basic test users for development | super_admin, company_admin, operator |
| **Demo Cameras** | `npm run seed:demo` | Full demo with cameras and VMS | admin, operator + VMS server + test camera |

**Test User Credentials:**

After running `npm run seed`:
- Super Admin: `admin@test.com` / `Admin123!`
- Company Admin: `companyadmin@test.com` / `Admin123!`
- Operator: `operator@test.com` / `Operator123!`

After running `npm run seed:demo`:
- Admin: `admin@demo.local` / `admin123`
- Operator: `operator@demo.local` / `operator123`

### Run All Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# AI Service tests
cd ai-service
pytest
```

### Generate Coverage Reports

```bash
# Backend coverage
cd backend
npm run test:coverage

# Frontend coverage
cd frontend
npm run test:coverage

# AI Service coverage
cd ai-service
pytest --cov
```

---

## 📚 Development Workflow

### Build & Compile

```bash
# Backend
cd backend
npm run build        # Compile TypeScript
npm run typecheck    # Check types
npm run lint         # Run ESLint
npm run format       # Format code with Prettier

# Frontend
cd frontend
npm run build        # Build production bundle
npm run typecheck    # Check types
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Docker Management

```bash
# View logs from all services
docker-compose logs -f

# View logs from specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
docker-compose logs -f ai-service

# Stop all services
docker-compose down

# Remove all services and volumes
docker-compose down -v

# Rebuild a specific service
docker-compose up --build -d backend
```

---

## 🔐 Authentication & Authorization

### Default Roles (RBAC)

The platform implements role-based access control:

- **Super Admin**: System-wide access
- **Company Admin**: Manage company and all users
- **Admin**: Manage users and events
- **Operator**: Dashboard access for incident monitoring
- **First Responder**: Mobile app for field operations
- **Citizen**: Report submission

### JWT Authentication

- Web dashboard and API use JWT tokens
- Mobile apps use API Keys for authentication
- Tokens are validated on all protected endpoints

---

## 🐛 Troubleshooting

### Services Won't Start

**Check Docker is running:**
```bash
docker --version
docker-compose --version
```

**Check ports are available:**
```bash
# Windows - Check if ports are in use
netstat -ano | findstr :3000
netstat -ano | findstr :5173
netstat -ano | findstr :27017
```

**View service logs:**
```bash
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb
```

### Database Connection Issues

**Verify MongoDB is running:**
```bash
docker-compose ps mongodb
```

**Check MongoDB health:**
```bash
docker-compose logs mongodb
```

**Connect to MongoDB directly:**
```bash
# From inside the backend container
mongosh mongodb://mongodb:27017/event_monitoring_dev
```

### API Returns 500 Error

**Check backend logs:**
```bash
docker-compose logs -f backend
```

**Verify environment variables:**
```bash
docker-compose exec backend env
```

### Frontend Won't Connect to Backend

**Verify API URL configuration:**
```bash
# Check VITE_API_URL in docker-compose.yml
# Should be http://localhost:3000 for local development
```

**Check CORS settings:**
- Backend CORS is configured for `http://localhost:5173`
- Adjust in backend environment variables if needed

---

## 📖 Documentation

Additional documentation is available in the `docs/` folder:

- [API Conventions](docs/01-API_CONVENTIONS.md) - RESTful API standards and response formats
- [Testing Strategy](docs/02-TESTING_STRATEGY.md) - Unit, integration, and contract testing
- [Logging & Observability](docs/03-LOGGING_OBSERVABILITY.md) - Structured logging and metrics
- [WebSocket Events](docs/04-WEBSOCKET_EVENTS.md) - Real-time event specifications

See also the main design documents:

- [Vision & Scope](01-VISION_AND_SCOPE.md) - Project vision and business context
- [Requirements](02-REQUIREMENTS.md) - Complete functional requirements
- [System Architecture](03-SYSTEM_ARCHITECTURE.md) - Technical architecture details
- [Module Contracts](04-MODULE_CONTRACTS.md) - API contracts and interfaces
- [Work Plan](00-WORKPLAN.md) - Development roadmap and slices

---

## 🔄 Development Workflow

### First Time Setup

1. Clone repository: `git clone <repo-url> && cd webShobV2`
2. Start services: `docker-compose up --build -d`
3. Wait for services to be healthy: `docker-compose ps`
4. Seed test data: `docker-compose exec backend npm run seed`
5. Access dashboard: http://localhost:5173
6. Login with test credentials: `admin@test.com` / `Admin123!`
7. View API docs: http://localhost:3000/api/docs

### Regular Development

1. Services auto-reload code changes (hot-reload enabled)
2. Check logs: `docker-compose logs -f [service-name]`
3. Run tests: `cd [service-folder] && npm test`
4. View database: Use MongoDB client tool to connect to `mongodb://localhost:27017`

### Before Committing

```bash
# Backend
cd backend && npm run lint:fix && npm run format && npm test

# Frontend
cd frontend && npm run lint:fix && npm run format && npm test

# Commit changes
git add . && git commit -m "Your message"
```

---

## 📦 Deployment

### Production Build

```bash
# Build all services with production configuration
docker-compose -f docker-compose.yml up --build -d

# Adjust JWT_SECRET and other secrets in environment variables
# Set NODE_ENV=production
# Configure proper MongoDB credentials
```

### Environment Configuration

Update `docker-compose.yml` with production values:

```yaml
environment:
  - NODE_ENV=production
  - JWT_SECRET=<strong-random-secret>
  - MONGODB_URI=<production-mongodb-url>
  - LOG_LEVEL=info
  - CORS_ORIGINS=<production-domain>
```

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Follow the code style and conventions documented in the docs folder
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request with a clear description

---

## 📞 Support & Issues

For bugs, feature requests, or questions:

1. Check existing documentation in the `docs/` folder
2. Review the troubleshooting section above
3. Check service logs: `docker-compose logs [service-name]`
4. Review API documentation: http://localhost:3000/api/docs

---

## 📝 License

This project is proprietary and unlicensed. All rights reserved.

---

## 🗺️ Roadmap

The project is organized into 14 development slices:

| Slice | Feature | Status |
|-------|---------|--------|
| 0 | Foundation & Setup | ✅ Complete |
| 1 | Authentication Core | ✅ Complete |
| 2 | Company & User Management | 🔄 In Progress |
| 3 | Report Submission | ⏳ Upcoming |
| 4 | Event Management | ⏳ Upcoming |
| 5 | Real-Time Foundation | ⏳ Upcoming |
| 6 | Map & Dashboard UI | ⏳ Upcoming |
| 7 | Mobile API Integration | ⏳ Upcoming |
| 8 | Camera Management | ⏳ Upcoming |
| 9 | Live Video Streaming | ⏳ Upcoming |
| 10 | VMS Adapters | ⏳ Upcoming |
| 11 | Historical Video Playback | ⏳ Upcoming |
| 12 | AI Service Integration | ⏳ Upcoming |
| 13 | Polish & Hardening | ⏳ Upcoming |

---

**Last Updated**: January 15, 2026

**Version**: 1.0.0
