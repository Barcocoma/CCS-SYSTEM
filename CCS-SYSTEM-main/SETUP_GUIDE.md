# CCS System Setup Guide

## Overview

This project uses:

- React + Vite for the frontend
- Flask for the backend
- MongoDB as the main database

Node.js with Express was optional in the project brief, so this project keeps the existing Flask backend to avoid a risky rewrite.

## 1. Database Setup

### Local MongoDB

Start MongoDB locally (default port `27017`) or via Docker.

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
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=itew6_user
MONGO_PASSWORD=itew6_password
MONGO_DB_NAME=itew6_db
MONGO_AUTH_DB=admin
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

## 6. API Areas

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Students

- `GET /api/students`
- `POST /api/students`
- `GET /api/students/<id>`
- `PUT /api/students/<id>`
- `DELETE /api/students/<id>`

Student filters supported:

- `search`
- `course`
- `year_level`
- `skill`
- `activity`
- `affiliation`

### Faculty

- `GET /api/faculty`
- `POST /api/faculty`
- `GET /api/faculty/<id>`
- `PUT /api/faculty/<id>`
- `DELETE /api/faculty/<id>`

### Scheduling

- `GET /api/schedules`
- `POST /api/schedules`
- `PUT /api/schedules/<id>`
- `DELETE /api/schedules/<id>`

### Events

- `GET /api/reports?report_type=event`
- `POST /api/reports`
- `PUT /api/reports/<id>`
- `DELETE /api/reports/<id>`

### Research

- `GET /api/research`
- `POST /api/research`
- `PUT /api/research/<id>`
- `DELETE /api/research/<id>`

### Instructions

- `GET/POST/PUT/DELETE /api/syllabus`
- `GET/POST/PUT/DELETE /api/curriculum`
- `GET/POST/PUT/DELETE /api/lessons`

## 7. Suggested Verification

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

## 8. Demo Checklist

- Log in
- Add student
- Open student profile
- Add skill/activity/affiliation
- Run `Basketball` query
- Run `Programming` query
- Edit student
- View faculty
- Add schedule
- Add event
- View research
- Add syllabus/curriculum/lesson
