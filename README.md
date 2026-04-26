# CCS Comprehensive Profiling System

CCS Comprehensive Profiling System is a full-stack university information system built with React, Flask, and Firebase Firestore.

## Stack

- Frontend: React + Vite
- Backend: Flask
- Database: Firebase Firestore

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

Copy values from [.env.example](/c:/Users/zoen/Downloads/ITEW6/CCS-SYSTEM/.env.example) or [backend/.env.example](/c:/Users/zoen/Downloads/ITEW6/CCS-SYSTEM/backend/.env.example).

Common values:

```env
VITE_API_URL=http://localhost:5000
SECRET_KEY=dev-secret-key
JWT_SECRET_KEY=dev-jwt-secret-key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=
DB_MOCK=false
```

## Database Seeding

`python init_db.py` seeds demo data for:

- admin login
- students and student detail records
- faculty records
- schedules
- events
- organizations
- research entries
- syllabus, curriculum, and lessons

The seeding is idempotent, so re-running it is safe.

## Verification

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

- [SETUP_GUIDE.md](/c:/Users/zoen/Downloads/ITEW6/CCS-SYSTEM/SETUP_GUIDE.md)
- [DOCKER_SETUP.md](/c:/Users/zoen/Downloads/ITEW6/CCS-SYSTEM/DOCKER_SETUP.md)
- [backend/README.md](/c:/Users/zoen/Downloads/ITEW6/CCS-SYSTEM/backend/README.md)
