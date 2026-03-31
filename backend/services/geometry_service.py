import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath
import re
from typing import Any, Dict, List

import geopandas as gpd
from pyproj import CRS, Transformer
from shapely.ops import unary_union

from services.geometry_storage import (
    get_finished_geometry_records,
    get_geometry_by_quest_id,
    get_ready_geometry_records,
    move_geometry_to_finished,
    upsert_quest_geometry,
)
from services.storage import get_quest_by_id

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BASE_DIR / "storage" / "uploaded_shapes"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
UTM_PATTERN = re.compile(
    r"^(\d{1,2})([C-HJ-NP-X])?\s+(\d+(?:\.\d+)?)\s*E?\s+(\d+(?:\.\d+)?)\s*N?$",
    re.IGNORECASE,
)


def _empty_feature_collection() -> Dict[str, Any]:
    return {"type": "FeatureCollection", "features": []}


def _quest_feature_properties(quest: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "quest_id": quest["id"] if "id" in quest else quest["quest_id"],
        "title": quest["title"],
        "status": quest["status"],
        "priority": quest.get("priority"),
        "date": quest.get("date"),
        "assigned_user": quest.get("assigned_user"),
        "group": quest.get("group"),
        "year": quest.get("year"),
        "ft": quest.get("ft"),
        "quest_type": quest.get("quest_type") or quest.get("ft"),
        "matziah": quest.get("matziah"),
    }


def _normalize_upload_relative_path(filename: str) -> Path:
    raw_path = filename.replace("\\", "/")
    parts = []
    for part in PurePosixPath(raw_path).parts:
        if part in {"", ".", "..", "/"}:
            continue
        parts.append(part.replace(":", "_"))
    if not parts:
        raise ValueError("Upload file name is invalid")
    return Path(*parts)


def _parse_utm_point(utm_text: str) -> Dict[str, Any]:
    match = UTM_PATTERN.match(utm_text.strip())
    if not match:
        raise ValueError("UTM must look like '36R 712345 3512345'")

    zone = int(match.group(1))
    band = (match.group(2) or "N").upper()
    easting = float(match.group(3))
    northing = float(match.group(4))

    if zone < 1 or zone > 60:
        raise ValueError("UTM zone must be between 1 and 60")

    northern_hemisphere = band >= "N"
    epsg = 32600 + zone if northern_hemisphere else 32700 + zone
    transformer = Transformer.from_crs(CRS.from_epsg(epsg), CRS.from_epsg(4326), always_xy=True)
    lng, lat = transformer.transform(easting, northing)

    return {
        "zone": zone,
        "band": band,
        "easting": easting,
        "northing": northing,
        "lng": lng,
        "lat": lat,
    }


def _build_feature_collection(geometry: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": properties,
                "geometry": geometry,
            }
        ],
    }


def _extract_polygon_geometry(shapefiles: List[Path]) -> str:
    geometries = []

    for shapefile in shapefiles:
        gdf = gpd.read_file(shapefile)
        if gdf.empty:
            continue
        if gdf.crs is None:
            gdf = gdf.set_crs(epsg=4326)
        elif gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)

        gdf = gdf[gdf.geometry.notnull()].copy()
        if gdf.empty:
            continue

        polygon_only = gdf[gdf.geometry.geom_type.isin(["Polygon", "MultiPolygon"])].copy()
        if polygon_only.empty:
            continue

        geometries.extend(list(polygon_only.geometry))

    if not geometries:
        raise ValueError("No polygon geometry was found in the uploaded shapefiles")

    merged = unary_union(geometries)
    if merged.geom_type == "GeometryCollection":
        polygon_parts = [geom for geom in merged.geoms if geom.geom_type in {"Polygon", "MultiPolygon"}]
        if not polygon_parts:
            raise ValueError("Uploaded shapefiles did not contain usable polygon geometry")
        merged = unary_union(polygon_parts)

    if merged.is_empty:
        raise ValueError("Merged polygon geometry is empty")

    if not merged.is_valid:
        merged = merged.buffer(0)

    geo_series = gpd.GeoSeries([merged], crs="EPSG:4326")
    return geo_series.to_json()


def _feature_collection_from_geometry_json(geometry_json: str, properties: Dict[str, Any]) -> Dict[str, Any]:
    import json

    payload = json.loads(geometry_json)
    if payload.get("type") == "FeatureCollection":
        features = []
        for index, feature in enumerate(payload.get("features") or []):
            if not feature.get("geometry"):
                continue
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        **properties,
                        **(feature.get("properties") or {}),
                        "feature_index": index,
                    },
                    "geometry": feature["geometry"],
                }
            )
        return {"type": "FeatureCollection", "features": features}
    raise ValueError("Unsupported geometry payload")


def get_geometry_catalog(group: str | None = None, status: str | None = None) -> Dict[str, Any]:
    records = get_ready_geometry_records(group=group, status=status)
    point_features: List[Dict[str, Any]] = []
    polygon_features: List[Dict[str, Any]] = []
    quest_types = sorted(
        {
            str(record.get("quest_type") or record.get("ft") or "Unknown")
            for record in records
        }
    )

    for record in records:
        feature_collection = record.get("feature_collection") or _empty_feature_collection()
        features = feature_collection.get("features") or []
        properties = _quest_feature_properties(record)

        for index, feature in enumerate(features):
            if not feature.get("geometry"):
                continue
            next_feature = {
                "type": "Feature",
                "properties": {
                    **properties,
                    **(feature.get("properties") or {}),
                    "feature_index": index,
                },
                "geometry": feature["geometry"],
            }
            if record.get("geometry_type") == "polygon":
                polygon_features.append(next_feature)
            else:
                point_features.append(next_feature)

    return {
        "quest_types": quest_types,
        "points": {"type": "FeatureCollection", "features": point_features},
        "polygons": {"type": "FeatureCollection", "features": polygon_features},
    }


def get_quest_geometry(quest_id: str) -> Dict[str, Any] | None:
    return get_geometry_by_quest_id(quest_id)


def save_quest_point_geometry(quest_id: str, utm_text: str) -> Dict[str, Any]:
    quest = get_quest_by_id(quest_id)
    if quest is None:
        raise LookupError("Quest not found")

    point = _parse_utm_point(utm_text)
    feature_collection = _build_feature_collection(
        {"type": "Point", "coordinates": [point["lng"], point["lat"]]},
        {
            **_quest_feature_properties(quest),
            "utm": {
                "zone": point["zone"],
                "band": point["band"],
                "easting": point["easting"],
                "northing": point["northing"],
            },
        },
    )

    geometry = upsert_quest_geometry(
        quest_id,
        {
            "geometry_type": "point",
            "geometry_status": "ready",
            "geometry_geojson": feature_collection,
            "source_path": None,
            "source_name": f"utm-{point['zone']}{point['band']}",
            "upload_kind": "utm",
            "feature_count": len(feature_collection["features"]),
            "utm_zone": point["zone"],
            "utm_band": point["band"],
            "utm_easting": point["easting"],
            "utm_northing": point["northing"],
        },
    )
    if geometry is None:
        raise RuntimeError("Failed to save point geometry")
    return geometry


def save_quest_polygon_geometry(quest_id: str, uploads: List[Dict[str, Any]]) -> Dict[str, Any]:
    quest = get_quest_by_id(quest_id)
    if quest is None:
        raise LookupError("Quest not found")
    if not uploads:
        raise ValueError("No files were uploaded")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    destination_dir = UPLOAD_ROOT / quest_id / timestamp

    with tempfile.TemporaryDirectory() as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        zip_upload = next(
            (
                upload
                for upload in uploads
                if str(upload.get("filename", "")).lower().endswith(".zip")
            ),
            None,
        )

        if zip_upload is not None and len(uploads) == 1:
            zip_name = _normalize_upload_relative_path(str(zip_upload["filename"]))
            zip_path = temp_dir / zip_name
            zip_path.parent.mkdir(parents=True, exist_ok=True)
            zip_path.write_bytes(bytes(zip_upload["content"]))
            extract_dir = temp_dir / "extracted"
            extract_dir.mkdir(parents=True, exist_ok=True)
            try:
                with zipfile.ZipFile(zip_path, "r") as archive:
                    archive.extractall(extract_dir)
            except zipfile.BadZipFile as exc:
                raise ValueError("The uploaded ZIP file could not be read") from exc
        else:
            for upload in uploads:
                relative_path = _normalize_upload_relative_path(str(upload["filename"]))
                target_path = temp_dir / relative_path
                target_path.parent.mkdir(parents=True, exist_ok=True)
                target_path.write_bytes(bytes(upload["content"]))

        shapefiles = sorted(temp_dir.rglob("*.shp"))
        if not shapefiles:
            raise ValueError("No shapefile (.shp) was found in the uploaded files")

        polygon_geojson_raw = _extract_polygon_geometry(shapefiles)
        feature_collection = _feature_collection_from_geometry_json(
            polygon_geojson_raw,
            _quest_feature_properties(quest),
        )
        if not feature_collection["features"]:
            raise ValueError("No polygon feature could be produced from the uploaded shapefiles")

        destination_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(temp_dir, destination_dir, dirs_exist_ok=True)

    source_name = shapefiles[0].stem if len(shapefiles) == 1 else "merged-polygon"
    geometry = upsert_quest_geometry(
        quest_id,
        {
            "geometry_type": "polygon",
            "geometry_status": "ready",
            "geometry_geojson": feature_collection,
            "source_path": str(destination_dir),
            "source_name": source_name,
            "upload_kind": "shapefile",
            "feature_count": len(feature_collection["features"]),
            "utm_zone": None,
            "utm_band": None,
            "utm_easting": None,
            "utm_northing": None,
        },
    )
    if geometry is None:
        raise RuntimeError("Failed to save polygon geometry")
    return geometry


def complete_quest_geometry(quest_id: str, accuracy_xy: float, accuracy_z: float) -> Dict[str, Any]:
    result = move_geometry_to_finished(quest_id, accuracy_xy, accuracy_z)
    if result is None:
        raise LookupError("Quest not found or has no geometry")
    return result


def get_finished_geometry_catalog(group: str | None = None) -> Dict[str, Any]:
    records = get_finished_geometry_records(group=group)
    point_features: List[Dict[str, Any]] = []
    polygon_features: List[Dict[str, Any]] = []
    quest_types = sorted(
        {
            str(record.get("quest_type") or record.get("ft") or "Unknown")
            for record in records
        }
    )

    for record in records:
        feature_collection = record.get("feature_collection") or _empty_feature_collection()
        features = feature_collection.get("features") or []
        properties = _quest_feature_properties(record)

        for index, feature in enumerate(features):
            if not feature.get("geometry"):
                continue
            next_feature = {
                "type": "Feature",
                "properties": {
                    **properties,
                    **(feature.get("properties") or {}),
                    "feature_index": index,
                },
                "geometry": feature["geometry"],
            }
            if record.get("geometry_type") == "polygon":
                polygon_features.append(next_feature)
            else:
                point_features.append(next_feature)

    return {
        "quest_types": quest_types,
        "points": {"type": "FeatureCollection", "features": point_features},
        "polygons": {"type": "FeatureCollection", "features": polygon_features},
    }
