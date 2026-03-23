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

## 🗄️ Switching to PostgreSQL later

All storage is in `backend/services/storage.py`. Replace the JSON functions
with SQLAlchemy calls to switch to PostGIS:

```bash
pip install sqlalchemy psycopg2-binary geoalchemy2
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
