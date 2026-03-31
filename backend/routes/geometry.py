from fastapi import APIRouter, Body, File, HTTPException, UploadFile

from models.geometry import QuestPointGeometryCreate
from services.geometry_service import (
    complete_quest_geometry,
    get_finished_geometry_catalog,
    get_geometry_catalog,
    get_quest_geometry,
    save_quest_point_geometry,
    save_quest_polygon_geometry,
)

router = APIRouter()


@router.get("/catalog")
def geometry_catalog(group: str | None = None, status: str | None = None):
    return get_geometry_catalog(group=group, status=status)


@router.get("/finished-catalog")
def finished_geometry_catalog(group: str | None = None):
    return get_finished_geometry_catalog(group=group)


@router.get("/quests/{quest_id}")
def geometry_by_quest(quest_id: str):
    geometry = get_quest_geometry(quest_id)
    if geometry is None:
        raise HTTPException(status_code=404, detail="Quest not found")
    return geometry


@router.put("/quests/{quest_id}/point")
def set_quest_point_geometry(quest_id: str, payload: QuestPointGeometryCreate):
    try:
        return save_quest_point_geometry(quest_id, payload.utm)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/quests/{quest_id}/polygon-upload")
async def upload_quest_polygon_geometry(quest_id: str, files: list[UploadFile] = File(...)):
    uploads = []
    for file in files:
        uploads.append(
            {
                "filename": file.filename or "upload.bin",
                "content": await file.read(),
            }
        )

    try:
        return save_quest_polygon_geometry(quest_id, uploads)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/quests/{quest_id}/complete")
def complete_quest(quest_id: str, accuracy_xy: float = Body(...), accuracy_z: float = Body(...)):
    try:
        return complete_quest_geometry(quest_id, accuracy_xy, accuracy_z)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
