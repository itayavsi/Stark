import hashlib
import os
from datetime import datetime
from typing import Any

import httpx

EXTERNAL_QUESTS_API_URL = os.getenv("EXTERNAL_QUESTS_API_URL", "https://quests.kipod.cts/api")
EXTERNAL_QUESTS_UPDATE_STATUS_URL = os.getenv("EXTERNAL_QUESTS_UPDATE_STATUS_URL", "https://quests.kipod/api/updateStatus")
EXTERNAL_QUESTS_GROUP = os.getenv("EXTERNAL_QUESTS_GROUP", "לווינות")
EXTERNAL_STATUS_TO_LOCAL = {
    "Open": "Open",
    "Taken": "Taken",
    "In Progress": "In Progress",
    "Done": "Done",
    "Approved": "Approved",
    "Stopped": "Stopped",
    "Cancelled": "Cancelled",
}
LOCAL_STATUS_TO_EXTERNAL = {
    "Open": "Open",
    "Taken": "In Progress",
    "In Progress": "In Progress",
    "Done": "Done",
    "Approved": "Done",
    "Stopped": "Stopped",
    "Cancelled": "Stopped",
}


def _normalize_external_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if isinstance(payload, dict):
        for key in ("quests", "data", "items", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]

    return []


def _build_external_id(item: dict[str, Any]) -> str:
    raw = "|".join(
        [
            str(item.get("name", "")),
            str(item.get("opener", "")),
            str(item.get("relevancy:Date", "")),
        ]
    )
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    return f"external:{digest}"


def _normalize_date(raw_date: Any) -> str:
    if not raw_date:
        return datetime.now().strftime("%Y-%m-%d")

    text = str(raw_date)
    if "T" in text:
        return text.split("T", 1)[0]
    return text


def _extract_year(date_text: str) -> int:
    try:
        return int(date_text[:4])
    except (ValueError, TypeError):
        return datetime.now().year


def transform_external_quest(item: dict[str, Any], status_override: str | None = None) -> dict[str, Any]:
    date_text = _normalize_date(item.get("relevancy:Date"))
    external_status = str(item.get("status", "Open"))
    local_status = status_override or EXTERNAL_STATUS_TO_LOCAL.get(external_status, external_status)

    notes = str(item.get("notes", "") or "")
    objects = item.get("objects")
    priority = item.get("priority")
    extra_bits = []
    if priority not in (None, ""):
        extra_bits.append(f"Priority: {priority}")
    if objects not in (None, ""):
        extra_bits.append(f"Objects: {objects}")
    if notes:
        extra_bits.append(notes)

    return {
        "id": _build_external_id(item),
        "title": str(item.get("name", "") or "External quest"),
        "description": " | ".join(extra_bits),
        "status": local_status,
        "date": date_text,
        "assigned_user": str(item.get("opener", "") or "") or None,
        "shapefile_path": None,
        "group": EXTERNAL_QUESTS_GROUP,
        "year": _extract_year(date_text),
        "ft": "FT1",
        "sync_source": "kipod",
        "sync_name": str(item.get("name", "") or ""),
        "external_status": external_status,
    }


def fetch_external_quests() -> list[dict[str, Any]]:
    with httpx.Client(timeout=10.0) as client:
        response = client.get(EXTERNAL_QUESTS_API_URL)
        response.raise_for_status()
        payload = response.json()
    return _normalize_external_payload(payload)


def find_external_quest(external_id: str) -> dict[str, Any] | None:
    for item in fetch_external_quests():
        if _build_external_id(item) == external_id:
            return item
    return None


def sync_external_status(quest_name: str, local_status: str) -> str:
    external_status = LOCAL_STATUS_TO_EXTERNAL.get(local_status, local_status)
    with httpx.Client(timeout=10.0) as client:
        response = client.post(
            EXTERNAL_QUESTS_UPDATE_STATUS_URL,
            json={"name": quest_name, "status": external_status},
        )
        response.raise_for_status()
    return external_status
