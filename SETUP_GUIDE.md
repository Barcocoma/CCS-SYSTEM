# CCS System Setup Guide

## Overview

This project uses:

- React + Vite for the frontend
- Flask for the backend
- Firebase Firestore for the database

## 1. Firebase Setup

Create a Firebase project, enable Firestore, and generate a service account key for the backend.

## 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python init_db.py
python app.py
```

Backend URL: `http://localhost:5000`

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:3000`

## 4. Environment Files

Use these values from `.env.example`:

```env
VITE_API_URL=http://localhost:5000
SECRET_KEY=dev-secret-key
JWT_SECRET_KEY=dev-jwt-secret-key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_DATABASE_ID=
FIREBASE_SERVICE_ACCOUNT_PATH=
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=
DB_MOCK=false
```

## 5. Seeded Demo Data

`python init_db.py` seeds:

- admin login
- students
- faculty
- schedules
- events
- organizations
- research
- syllabus
- curriculum
- lessons

Demo credentials:

- Email: `admin@example.com`
- Password: `admin123`

## 6. Suggested Verification

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
