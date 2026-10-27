# TodaGoo

TodaGoo is a tricycle ride-booking and operations platform. Passengers can request rides, drivers can manage and complete bookings, and operations teams can manage TODA information and review incident reports.

The project is split into three apps:

| App | Location | Stack | Purpose |
| --- | --- | --- | --- |
| Backend | [`backend/`](./backend/) | Django, Django REST Framework, Channels | REST API, authentication, bookings, chat, incident reports, and real-time updates |
| Web dashboard | [`frontend/`](./frontend/) | React, Vite | Operations and TODA dashboards |
| Mobile app | [`mobile/`](./mobile/) | React Native, Expo | Passenger and driver experience |

## Requirements

- Python compatible with Django 6
- Node.js and npm
- PostgreSQL with the PostGIS extension
- GDAL and GEOS libraries available to GeoDjango
- Redis for a shared Channels layer and cache in multi-process deployments (optional for local development)

The backend can fall back to SQLite when PostgreSQL settings are omitted, but PostgreSQL with PostGIS is the intended database for the project's geospatial features.

## Getting started

### 1. Configure the backend

In PowerShell, from the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least:

```env
SECRET_KEY=replace-with-a-long-random-secret
EMAIL_HOST_USER=your-email@example.com
EMAIL_HOST_PASSWORD=your-email-app-password

PG_NAME=todagoo
PG_USER=todagoo
PG_PASSWORD=choose-a-database-password
PG_HOST=localhost
PG_PORT=5432
```

Create the PostgreSQL database and enable PostGIS before running migrations. The optional `setup-db.py` helper in the repository root can create a database, user, and PostGIS extensions; it requires `psql` to be installed and available on `PATH`. On Windows, GeoDjango may also need valid `GDAL_PATH` and `GEOS_LIBRARY_PATH` values in `backend/.env`.

Apply migrations and start the API:

```powershell
python manage.py migrate
python manage.py runserver
```

The API is served at `http://127.0.0.1:8000/`; routes are under `/api/` and the Django admin is at `/admin/`.

### 2. Run the web dashboard

In a second terminal at the repository root:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

The Vite development server prints the local URL when it starts (usually `http://localhost:5173`). Check `frontend/.env` and set `VITE_API_URL` and `VITE_WS_URL` to the backend's API and WebSocket base URLs if they differ from the example.

### 3. Run the mobile app (optional)

In a third terminal:

```powershell
cd mobile
npm install
Copy-Item .env.example .env
npm start
```

Follow the Expo CLI prompts to open the app in an emulator or on a device. For a physical device, set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WS_URL` in `mobile/.env` to use your development computer's LAN IP address instead of `127.0.0.1` or `localhost`. The phone and computer need to be on a network that allows the device to reach the backend.

## Environment variables

Environment files are intentionally kept out of version control. Start from the templates and never commit real passwords, API keys, or Django secrets.

| File | Variables used |
| --- | --- |
| `backend/.env` | `SECRET_KEY`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`; PostgreSQL: `PG_NAME`, `PG_USER`, `PG_PASSWORD`, `PG_HOST`, `PG_PORT`; optional `CORS_ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, `REDIS_HOST`, `REDIS_PORT`, `CLOUDINARY_URL`, `GDAL_PATH`, `GEOS_LIBRARY_PATH` |
| `frontend/.env` | `VITE_API_URL`, `VITE_WS_URL`; optional `VITE_MEDIA_URL` |
| `mobile/.env` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL`; optional `EXPO_PUBLIC_ORS_API_KEY` for route services |

## Common commands

Run these from the relevant app directory:

```powershell
# Backend tests
cd backend
python manage.py test

# Web dashboard
cd frontend
npm run lint
npm run build

# Mobile app
cd mobile
npm run lint
```

## Project layout

```text
backend/
  api/features/     Django API features (users, bookings, drivers, passengers, chat, reports)
  websocket/        Channels consumers and real-time event handling
  backend/          Django project configuration and URL routing
frontend/
  src/pages/        Web dashboard pages
  src/components/   Shared dashboard components
mobile/
  app/              Expo Router screens and navigation
  api/              Mobile API clients
  components/       Shared mobile UI
```

## Additional documentation

- [`PostGres.md`](./PostGres.md) — PostgreSQL setup notes
- [`backend/.env.example`](./backend/.env.example) — backend environment template
- [`frontend/.env.example`](./frontend/.env.example) — web environment template
- [`mobile/.env.example`](./mobile/.env.example) — mobile environment template
