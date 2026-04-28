# GIS App — מערכת מיפוי LAN (Offline)

A fully offline GIS platform. Works with **zero internet access**.

---

## ⚡ First-time Setup (run once)

### Step 1 — Install backend
```bash
cd backend
pip install -r requirements.txt
```

### Step 2 — Generate the offline world map
```bash
cd backend
python generate_offline_map.py
```
This creates `frontend/public/world.geojson` from geopandas' built-in
Natural Earth data. **No internet needed** — the data ships with geopandas.

### Step 3 — Install frontend
```bash
cd frontend
npm install
```

---

## 🚀 Start (every time)

**Terminal 1 — Backend:**
```bash
cd backend
python app.py
# → http://0.0.0.0:8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
# → http://localhost:3000
```

Now turn off your internet and it still works. ✅

---

## 👤 Login credentials

| Username | Password  | Role        |
|----------|-----------|-------------|
| admin    | admin123  | Team Leader |
| user1    | pass123   | User        |
| viewer1  | view123   | Viewer      |

---

## 🗺️ How offline map works

- The world map is a **GeoJSON file** served from `frontend/public/world.geojson`
- MapLibre GL renders it locally — **no tile server, no CDN, no internet**
- Your shapefile layers are added on top of this base map
- The map style is fully dark-themed and self-contained

### Want higher-res tiles instead?

For a more detailed offline map, use tileserver-gl with an MBTiles file:

```bash
# Install once
npm install -g tileserver-gl

# Download an MBTiles file (while you have internet)
# e.g. from https://openmaptiles.org/

# Run locally on LAN
tileserver-gl israel.mbtiles --port 8080
```

Then in `frontend/src/components/MapView.js`, replace the GeoJSON source:
```js
sources: {
  'osm': { type: 'raster', tiles: ['http://YOUR-LAN-IP:8080/styles/basic/{z}/{x}/{y}.png'], tileSize: 256 }
}
```

---

## Neon Setup

This backend now reads and writes users and quests from Postgres, so you can point it at your Neon project directly.

### 1. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Add your Neon connection string

Copy `backend/.env.example` to `backend/.env` and keep `DB_TARGET=neon`.
Set `DATABASE_URL` to the pooled connection string from your Neon project `muddy-glitter-65270295`.

```bash
cd backend
cp .env.example .env
```

Expected format:

```bash
DATABASE_URL=postgresql://<role>:<password>@<your-neon-endpoint-pooler>/<database>?sslmode=require
```

### 3. Run versioned migrations (Alembic)

```bash
cd backend
python scripts/run_migrations.py
```

### 3.1 Create a new migration from ORM models

The backend now uses SQLAlchemy ORM models in `backend/services/orm_models.py` and Alembic is connected to `Base.metadata`.

```bash
cd backend
alembic revision --autogenerate -m "describe schema change"
python scripts/run_migrations.py
```

### 4. Start the backend

```bash
cd backend
python app.py
```

The baseline migration uses existing idempotent bootstrap logic, so first run creates/seeds schema and future changes can be added as new Alembic revisions.

### Notes

- Use the pooled Neon connection string for the FastAPI app.
- Keep `sslmode=require` in the connection string.
- To switch to local Postgres later:
  1. Set `DB_TARGET=local` in `backend/.env`
  2. Set `LOCAL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gis_app`
  3. Run `python scripts/run_migrations.py` again

### Import completed quests from Excel

If you have a legacy Excel file with finished quests, you can import it into Postgres:

```bash
cd backend
python scripts/import_completed_quests.py /path/to/completed-quests.xlsx --dry-run
python scripts/import_completed_quests.py /path/to/completed-quests.xlsx
```

Default column detection supports common headers such as `title`, `description`, `date`, `assigned_user`, `group`, `year`, `ft`, and `shapefile_path`. By default imported rows are marked as `Done`, but you can override that:

```bash
python scripts/import_completed_quests.py /path/to/completed-quests.xlsx --status Approved
```

---

## 📡 Deploy on LAN

```bash
# Backend — binds to 0.0.0.0 so LAN devices can reach it
cd backend && python app.py

# Frontend — build and serve statically
cd frontend
npm run build
npx serve -s build -l 3000
```

Set your server's LAN IP in `frontend/.env`:
```
REACT_APP_API_URL=http://192.168.1.100:8000
```
