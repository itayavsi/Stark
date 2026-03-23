import os, json
from typing import List, Dict

COLOR_RULES = {2026:"#22c55e", 2025:"#3b82f6", 2024:"#ef4444", 2023:"#f97316"}

def shapefile_to_geojson(shp_path: str) -> Dict:
    """Convert .shp → GeoJSON, reprojected to WGS84."""
    try:
        import geopandas as gpd
        gdf = gpd.read_file(shp_path)
        if gdf.crs is None:
            gdf = gdf.set_crs(epsg=4326)
        elif gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        # Convert all non-serialisable column types to string
        for col in gdf.columns:
            if col == "geometry":
                continue
            try:
                gdf[col] = gdf[col].astype(str)
            except Exception:
                gdf = gdf.drop(columns=[col])
        return json.loads(gdf.to_json())
    except ImportError:
        raise RuntimeError("geopandas not installed. Run: pip install geopandas fiona")
    except Exception as e:
        raise RuntimeError(f"Failed to convert shapefile: {e}")

def geojson_from_gdb(gdb_path: str, layer_name: str = None) -> Dict:
    """Read a layer from a FileGDB (.gdb) using fiona."""
    try:
        import fiona, geopandas as gpd
        layers = fiona.listlayers(gdb_path)
        target = layer_name if layer_name in layers else layers[0]
        gdf = gpd.read_file(gdb_path, layer=target)
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        for col in gdf.columns:
            if col == "geometry":
                continue
            try:
                gdf[col] = gdf[col].astype(str)
            except Exception:
                gdf = gdf.drop(columns=[col])
        return {"layer": target, "all_layers": layers, "geojson": json.loads(gdf.to_json())}
    except ImportError:
        raise RuntimeError("fiona/geopandas not installed")
    except Exception as e:
        raise RuntimeError(f"Failed to read GDB: {e}")

def load_shapefiles_from_folder(folder: str) -> List[Dict]:
    layers = []
    if not os.path.exists(folder):
        return layers
    for root, dirs, files in os.walk(folder):
        # Handle .gdb folders
        for d in dirs:
            if d.endswith(".gdb"):
                try:
                    result = geojson_from_gdb(os.path.join(root, d))
                    layers.append({"name": d, "type": "gdb",
                                   "data": result["geojson"],
                                   "fields": list(result["geojson"]["features"][0]["properties"].keys()) if result["geojson"].get("features") else []})
                except Exception as e:
                    layers.append({"name": d, "type": "gdb", "error": str(e)})
        for fname in files:
            fpath = os.path.join(root, fname)
            if fname.endswith(".geojson"):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        geojson = json.load(f)
                    fields = list(geojson["features"][0]["properties"].keys()) if geojson.get("features") else []
                    layers.append({"name": fname.replace(".geojson",""), "type":"geojson",
                                   "data": geojson, "fields": fields})
                except Exception:
                    pass
            elif fname.endswith(".shp"):
                try:
                    geojson = shapefile_to_geojson(fpath)
                    fields  = list(geojson["features"][0]["properties"].keys()) if geojson.get("features") else []
                    layers.append({"name": fname.replace(".shp",""), "type":"shapefile",
                                   "data": geojson, "fields": fields})
                except Exception as e:
                    layers.append({"name": fname, "type":"shapefile", "error": str(e)})
    return layers

def get_color_by_year(year: int) -> str:
    return COLOR_RULES.get(year, "#6b7280")
