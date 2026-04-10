# Backend API

Flask backend for the CCS Comprehensive Profiling System.

## Setup

```bash
pip install -r requirements.txt
python init_db.py
python app.py
```

API URL: `http://localhost:5000`

## Environment Variables

Use [`backend/.env.example`](/c:/Users/zoen/Downloads/ITEW6/Test%201%20-%20Start/CCS-SYSTEM/backend/.env.example) as a reference.

Main database settings:

```env
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=itew6_user
MONGO_PASSWORD=itew6_password
MONGO_DB_NAME=itew6_db
MONGO_AUTH_DB=admin
```

## Seeded Demo Account

- Email: `admin@example.com`
- Password: `admin123`

## Main API Groups

- `/api/auth`
- `/api/students`
- `/api/faculty`
- `/api/schedules`
- `/api/reports`
- `/api/organizations`
- `/api/research`
- `/api/syllabus`
- `/api/curriculum`
- `/api/lessons`
- `/api/audit-logs`

## Student Query Support

`GET /api/students` supports:

- `search`
- `course`
- `year_level`
- `skill`
- `activity`
- `affiliation`

## Testing

```bash
python -m compileall .
python -m unittest discover -s tests
```
