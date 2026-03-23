"""
╔══════════════════════════════════════════════════════════════╗
║           OFFLINE MAP GENERATOR                              ║
║                                                              ║
║  Run this ONCE on a machine WITH internet.                   ║
║  Then copy the entire gis-app/ folder to the offline PC.    ║
║  The app will use the saved map files — no internet needed.  ║
║                                                              ║
║  Usage:                                                      ║
║      cd backend                                              ║
║      python generate_offline_map.py                          ║
╚══════════════════════════════════════════════════════════════╝
"""

import os
import sys
import json
import time
import math
import urllib.request
import urllib.error
import threading
from pathlib import Path

# ── Output paths ─────────────────────────────────────────────
ROOT         = Path(__file__).parent.parent
FRONTEND_PUB = ROOT / "frontend" / "public"
GEOJSON_OUT  = FRONTEND_PUB / "world.geojson"
TILES_OUT    = FRONTEND_PUB / "tiles"

# ── Settings ──────────────────────────────────────────────────
# Zoom levels to download (0=whole world, 5=country level, 8=city level)
# More zoom levels = bigger download, better detail
MIN_ZOOM = 0
MAX_ZOOM = 5   # ~10MB for zoom 0-5.  Set to 7 for more detail (~150MB)

TILE_SERVER = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
HEADERS     = {"User-Agent": "GIS-Offline-App/1.0 (offline LAN use)"}

# ── Helpers ───────────────────────────────────────────────────
def deg2num(lat, lon, zoom):
    lat_r = math.radians(lat)
    n = 2 ** zoom
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n)
    return x, y

def all_tiles_for_zoom(zoom):
    """Return all (z, x, y) tiles for a zoom level."""
    n = 2 ** zoom
    return [(zoom, x, y) for x in range(n) for y in range(n)]

def count_tiles(min_z, max_z):
    total = 0
    for z in range(min_z, max_z + 1):
        total += 4 ** z
    return total

def download_tile(z, x, y, retries=3):
    tile_dir  = TILES_OUT / str(z) / str(x)
    tile_path = tile_dir / f"{y}.png"
    if tile_path.exists():
        return True   # already downloaded
    tile_dir.mkdir(parents=True, exist_ok=True)
    url = TILE_SERVER.format(z=z, x=x, y=y)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10) as resp:
                tile_path.write_bytes(resp.read())
            return True
        except Exception:
            if attempt < retries - 1:
                time.sleep(1)
    return False

# ── Step 1: Download world GeoJSON ────────────────────────────
def download_world_geojson():
    print("\n━━━ Step 1: Downloading world country borders ━━━")

    # Try multiple sources
    sources = [
        ("Natural Earth (high quality)",
         "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"),
        ("Backup source",
         "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"),
    ]

    for name, url in sources:
        print(f"  Trying: {name}...")
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
            FRONTEND_PUB.mkdir(parents=True, exist_ok=True)
            GEOJSON_OUT.write_text(json.dumps(data), encoding="utf-8")
            size_kb = GEOJSON_OUT.stat().st_size / 1024
            print(f"  ✓ Saved world.geojson ({size_kb:.0f} KB, {len(data['features'])} countries)")
            return True
        except Exception as e:
            print(f"  ✗ Failed: {e}")

    # Fallback: use geopandas built-in (no download needed)
    print("  Trying geopandas built-in data (no internet needed)...")
    try:
        import geopandas as gpd
        try:
            world = gpd.read_file(gpd.datasets.get_path("naturalearth_lowres"))
        except Exception:
            from geodatasets import get_path
            world = gpd.read_file(get_path("naturalearth.land"))
        world = world.to_crs(epsg=4326)
        cols = [c for c in ["geometry", "name", "continent", "pop_est"] if c in world.columns]
        geojson = json.loads(world[cols].to_json())
        FRONTEND_PUB.mkdir(parents=True, exist_ok=True)
        GEOJSON_OUT.write_text(json.dumps(geojson), encoding="utf-8")
        size_kb = GEOJSON_OUT.stat().st_size / 1024
        print(f"  ✓ Saved world.geojson from geopandas ({size_kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"  ✗ geopandas fallback failed: {e}")

    print("  ✗ Could not download world map. The app will use the embedded fallback.")
    return False

# ── Step 2: Download map tiles ────────────────────────────────
def download_tiles():
    print(f"\n━━━ Step 2: Downloading map tiles (zoom {MIN_ZOOM}–{MAX_ZOOM}) ━━━")
    total   = count_tiles(MIN_ZOOM, MAX_ZOOM)
    done    = 0
    failed  = 0
    lock    = threading.Lock()

    print(f"  Total tiles: {total}")
    print(f"  Saving to: {TILES_OUT}")
    print()

    def worker(tile):
        nonlocal done, failed
        z, x, y = tile
        ok = download_tile(z, x, y)
        with lock:
            if ok:
                done += 1
            else:
                failed += 1
            pct = (done + failed) / total * 100
            # Print progress every 50 tiles
            if (done + failed) % 50 == 0 or (done + failed) == total:
                bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
                print(f"\r  [{bar}] {pct:.0f}%  {done}/{total} tiles", end="", flush=True)

    all_tiles = []
    for z in range(MIN_ZOOM, MAX_ZOOM + 1):
        all_tiles.extend(all_tiles_for_zoom(z))

    # Use thread pool for faster downloads
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=8) as pool:
        pool.map(worker, all_tiles)

    print(f"\n  ✓ Done: {done} downloaded, {failed} failed")
    return done > 0

# ── Step 3: Write tile server config ──────────────────────────
def write_tile_config():
    """Write a config file so the app knows to use local tiles."""
    config = {
        "offline": True,
        "tile_source": "local",   # "local" = use /tiles/{z}/{x}/{y}.png
        "min_zoom": MIN_ZOOM,
        "max_zoom": MAX_ZOOM,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    config_path = FRONTEND_PUB / "offline_config.json"
    config_path.write_text(json.dumps(config, indent=2))
    print(f"\n  ✓ Written: offline_config.json")

# ── Main ──────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  GIS App — Offline Map Generator")
    print("=" * 60)
    print(f"  Output folder: {FRONTEND_PUB}")
    print()

    # Check internet
    print("Checking internet connection...")
    try:
        urllib.request.urlopen("https://tile.openstreetmap.org", timeout=5)
        print("  ✓ Internet available\n")
        has_internet = True
    except Exception:
        print("  ✗ No internet — using geopandas built-in data only\n")
        has_internet = False

    # Step 1: GeoJSON world borders
    download_world_geojson()

    # Step 2: Tiles (only if internet available)
    tiles_ok = False
    if has_internet:
        answer = input(f"\nDownload map tiles for offline use? (zoom 0-{MAX_ZOOM}, ~10MB) [y/N]: ").strip().lower()
        if answer == "y":
            tiles_ok = download_tiles()
            write_tile_config()
        else:
            print("  Skipped tile download. App will use GeoJSON map only.")
    else:
        print("No internet — skipping tile download.")

    # Summary
    print("\n" + "=" * 60)
    print("  DONE — Summary")
    print("=" * 60)
    if GEOJSON_OUT.exists():
        print(f"  ✓ world.geojson  ({GEOJSON_OUT.stat().st_size // 1024} KB)")
    if tiles_ok:
        tile_count = sum(1 for _ in TILES_OUT.rglob("*.png"))
        print(f"  ✓ tiles/         ({tile_count} tile files)")
    print()
    print("  Next steps:")
    print("  1. cd frontend && npm install && npm run build")
    print("  2. Copy the entire gis-app/ folder to the offline PC")
    print("  3. On offline PC: python backend/app.py")
    print("  4. On offline PC: python -m http.server 3000 (in frontend/build/)")
    print("=" * 60)

if __name__ == "__main__":
    main()
