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

Use [backend/.env.example](/c:/Users/zoen/Downloads/ITEW6/CCS-SYSTEM/backend/.env.example) as a reference.

Main Firebase settings:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_DATABASE_ID=
FIREBASE_SERVICE_ACCOUNT_PATH=
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=
DB_MOCK=false
```

Use `FIREBASE_SERVICE_ACCOUNT_PATH` for local development or `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` for hosted deployments such as Render.

## Seeded Demo Account

- Email: `admin@example.com`
- Password: `admin123`

## Testing

```bash
python -m compileall .
python -m unittest discover -s tests
```
