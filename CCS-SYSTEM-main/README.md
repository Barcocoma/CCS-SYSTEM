# CCS Comprehensive Profiling System

CCS Comprehensive Profiling System is a class-ready full-stack university information system built with React, Flask, and MongoDB. It covers the required modules for the project brief:

- Student Profile
- Faculty Profile
- Events
- Scheduling
- College Research
- Instructions (Syllabus, Curriculum, Lessons)

## Stack

- Frontend: React + Vite
- Backend: Flask
- Database: MongoDB

## Core Project Coverage

### Student Profile Module
- Add student profile
- View student list
- View individual profile
- Edit and delete student profile
- Manage academic history, non-academic activities, violations, skills, and affiliations

### Query and Filtering
- Free-text student search
- Student filtering by course, year level, skill, activity, and affiliation
- Demo-ready query buttons for `Basketball` and `Programming`

### Other Required Modules
- Faculty profile management
- Event management with filtering
- Class scheduling with validation
- College research management
- Instructions management for syllabus, curriculum, and lessons

## Demo Account

- Email: `admin@example.com`
- Password: `admin123`

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python init_db.py
python app.py
```

Backend runs on `http://localhost:5000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

## Environment Variables

Copy values from the root `.env.example` or [`backend/.env.example`](/c:/Users/zoen/Downloads/ITEW6/Test%201%20-%20Start/CCS-SYSTEM/backend/.env.example).

Common values:

```env
VITE_API_URL=http://localhost:5000
SECRET_KEY=dev-secret-key
JWT_SECRET_KEY=dev-jwt-secret-key
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=itew6_user
MONGO_PASSWORD=itew6_password
MONGO_DB_NAME=itew6_db
MONGO_AUTH_DB=admin
```

## Database Seeding

`python init_db.py` creates tables and seeds demo data for:

- 1 admin login
- student profiles and student detail records
- faculty records
- schedules
- events
- organizations
- research entries
- syllabus, curriculum, and lessons

The seeding is idempotent, so re-running it refreshes the demo data safely.

## Presentation Flow

For the live demo, use this order:

1. Log in with the seeded admin account.
2. Add a student profile.
3. Open the student profile and add skill/activity/affiliation data.
4. Run the `Basketball` and `Programming` student queries.
5. Edit or delete a student.
6. Open Faculty Profile and show faculty records.
7. Add or edit a schedule.
8. Add or edit an event.
9. Show a research record.
10. Add a syllabus, curriculum, or lesson entry.

## Verification

Recommended local verification:

```bash
cd frontend
npm run build
npm run lint
```

```bash
cd backend
python -m compileall .
python -m unittest discover -s tests
```

## Additional Docs

- [SETUP_GUIDE.md](/c:/Users/zoen/Downloads/ITEW6/Test%201%20-%20Start/CCS-SYSTEM/SETUP_GUIDE.md)
- [DOCKER_SETUP.md](/c:/Users/zoen/Downloads/ITEW6/Test%201%20-%20Start/CCS-SYSTEM/DOCKER_SETUP.md)
- [backend/README.md](/c:/Users/zoen/Downloads/ITEW6/Test%201%20-%20Start/CCS-SYSTEM/backend/README.md)
