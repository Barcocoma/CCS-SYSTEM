# Docker Setup Guide

## Services

`docker-compose.yml` starts:

- `frontend` on port `3000`
- `backend` on port `5000`
- `mongodb` on port `27017`

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

Remove volumes too:

```bash
docker-compose down -v
```

## View Logs

```bash
docker-compose logs -f
```

Specific service logs:

```bash
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f mongodb
```

## Docker Notes

- Frontend expects the backend at `http://localhost:5000`
- Backend uses the MongoDB container defined in `docker-compose.yml`
- Run `python init_db.py` inside the backend container or locally after the stack starts to seed demo data

## Seed Demo Data in Docker

```bash
docker exec -it itew6-backend python init_db.py
```

## Demo Login

- Email: `admin@example.com`
- Password: `admin123`
