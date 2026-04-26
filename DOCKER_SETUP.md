# Docker Setup Guide

## Services

`docker-compose.yml` starts:

- `frontend` on port `3000`
- `backend` on port `5000`

Firebase Firestore is external, so Docker does not start a database container anymore.

## Start the Stack

```bash
docker-compose up --build
```

Run in the background:

```bash
docker-compose up -d --build
```

## Stop the Stack

```bash
docker-compose down
```

## View Logs

```bash
docker-compose logs -f
```

Specific service logs:

```bash
docker-compose logs -f frontend
docker-compose logs -f backend
```

## Docker Notes

- Frontend expects the backend at `http://localhost:5000`
- Backend expects Firebase env vars from your local `.env`
- Run `python init_db.py` in the backend container or locally after the stack starts to seed demo data

## Seed Demo Data in Docker

```bash
docker exec -it itew6-backend python init_db.py
```

## Demo Login

- Email: `admin@example.com`
- Password: `admin123`
