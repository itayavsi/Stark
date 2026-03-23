import os, json, zipfile, tempfile, shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from services.map_service import shapefile_to_geojson, load_shapefiles_from_folder

router = APIRouter()
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../storage/uploaded_shapes")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _find_shp(folder):
    """Recursively find all .shp files in folder."""
    found = []
    for root, _, files in os.walk(folder):
        for f in files:
            if f.endswith(".shp"):
                found.append(os.path.join(root, f))
    return found

@router.post("/upload")
async def upload_shapefile(quest_id: str = Form(...), file: UploadFile = File(...)):
    quest_dir = os.path.join(UPLOAD_DIR, quest_id)
    os.makedirs(quest_dir, exist_ok=True)
    file_path = os.path.join(quest_dir, file.filename)
    content   = await file.read()

    with open(file_path, "wb") as f:
        f.write(content)

    # ── ZIP: extract then find .shp inside ───────────────
    if file.filename.lower().endswith(".zip"):
        extract_dir = os.path.join(quest_dir, "extracted")
        os.makedirs(extract_dir, exist_ok=True)
        try:
            with zipfile.ZipFile(file_path, "r") as z:
                z.extractall(extract_dir)
        except Exception as e:
            return {"status": "error", "error": f"ZIP extract failed: {e}"}

        shp_files = _find_shp(extract_dir)
        if not shp_files:
            return {"status": "error", "error": "No .shp file found inside ZIP"}

        layers = []
        for shp in shp_files:
            try:
                geojson = shapefile_to_geojson(shp)
                name    = os.path.splitext(os.path.basename(shp))[0]
                layers.append({"name": name, "geojson": geojson,
                                "fields": list(geojson["features"][0]["properties"].keys()) if geojson.get("features") else []})
            except Exception as e:
                layers.append({"name": os.path.basename(shp), "error": str(e)})
        return {"status": "converted", "source": "zip", "layers": layers}

    # ── Single .shp ───────────────────────────────────────
    if file.filename.lower().endswith(".shp"):
        try:
            geojson = shapefile_to_geojson(file_path)
            fields  = list(geojson["features"][0]["properties"].keys()) if geojson.get("features") else []
            return {"status": "converted", "source": "shp",
                    "layers": [{"name": file.filename.replace(".shp",""), "geojson": geojson, "fields": fields}]}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    # ── GeoJSON ───────────────────────────────────────────
    if file.filename.lower().endswith(".geojson") or file.filename.lower().endswith(".json"):
        try:
            geojson = json.loads(content)
            fields  = list(geojson["features"][0]["properties"].keys()) if geojson.get("features") else []
            return {"status": "converted", "source": "geojson",
                    "layers": [{"name": file.filename.replace(".geojson","").replace(".json",""),
                                "geojson": geojson, "fields": fields}]}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    return {"status": "uploaded", "path": file_path, "layers": []}

@router.get("/layer-data/{quest_id}")
def get_layer_data(quest_id: str):
    folder = os.path.join(UPLOAD_DIR, quest_id)
    if not os.path.exists(folder):
        folder = f"/shared/quests/{quest_id}"
    if not os.path.exists(folder):
        raise HTTPException(status_code=404, detail="No shapefile folder found")
    layers = load_shapefiles_from_folder(folder)
    return {"layers": layers}

@router.get("/check-folder")
def check_folder(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Folder not found: {path}")
    layers = load_shapefiles_from_folder(path)
    return {"path": path, "layers": layers, "count": len(layers)}
