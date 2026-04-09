import hashlib
import os
from datetime import datetime
from typing import Any

import httpx

from services.storage import get_external_quests, save_external_quest

EXTERNAL_QUESTS_API_URL = os.getenv("EXTERNAL_QUESTS_API_URL", "https://quests.kipod.cts/api")
EXTERNAL_QUESTS_UPDATE_STATUS_URL = os.getenv("EXTERNAL_QUESTS_UPDATE_STATUS_URL", "https://quests.kipod/api/updateStatus")
EXTERNAL_QUESTS_CREATE_URL = os.getenv("EXTERNAL_QUESTS_CREATE_URL", EXTERNAL_QUESTS_API_URL)
EXTERNAL_QUESTS_GROUP = os.getenv("EXTERNAL_QUESTS_GROUP", "לווינות")
EXTERNAL_STATUS_TO_LOCAL = {
    "Open": "Start",
    "Taken": "Production",
    "In Progress": "Production",
    "Done": "Finished",
    "Approved": "Finished",
    "Stopped": "Paused",
    "Cancelled": "Paused",
}

LOCAL_STATUS_TO_EXTERNAL = {
    "Start": "Open",
    "Search": "In Progress",
    "Production": "In Progress",
    "Solve": "In Progress",
    "MBT_solve": "In Progress",
    "Tiyuv": "In Progress",
    "acc_test": "In Progress",
    "Kilta": "In Progress",
    "Klita_mipuy": "In Progress",
    "MQA": "In Progress",
    "BDB": "In Progress",
    "need_ziyuah": "In Progress",
    "Need_Nezah": "In Progress",
    "Approved_Nezah": "In Progress",
    "Ziyuah_mipuy": "Open",
    "QL": "Open",
    "BDB_hold": "Open",
    "hold_ziyuah": "Open",
    "Paused": "Stopped",
    "Snow_ziyuah": "Stopped",
    "Finished": "Done",
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


def build_external_id(item: dict[str, Any]) -> str:
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
    return text.split("T", 1)[0]


def _normalize_deadline(raw_deadline: Any) -> str | None:
    if raw_deadline in (None, ""):
        return None
    return str(raw_deadline)


def _extract_year(date_text: str) -> int:
    try:
        return int(date_text[:4])
    except (ValueError, TypeError):
        return datetime.now().year


def map_local_status_to_external(local_status: str) -> str:
    return LOCAL_STATUS_TO_EXTERNAL.get(local_status, local_status)


def transform_external_quest(item: dict[str, Any], status_override: str | None = None) -> dict[str, Any]:
    return transform_external_quest_with_metadata(item, status_override=status_override, metadata=None)


def transform_external_quest_with_metadata(
    item: dict[str, Any],
    status_override: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata = metadata or {}
    date_text = _normalize_date(item.get("relevancy:Date"))
    deadline_at = _normalize_deadline(
        metadata.get("deadline_at")
        or item.get("deadline_at")
        or item.get("deadlineAt")
        or item.get("deadline")
    )
    external_status = str(item.get("status", "Open"))
    local_status = status_override or EXTERNAL_STATUS_TO_LOCAL.get(external_status, external_status)
    external_id = build_external_id(item)

    notes = str(item.get("notes", "") or "")
    objects = item.get("objects")
    priority = item.get("priority")
    matziah = str(metadata.get("matziah") or item.get("matziah") or "N")
    transferred_quest_id = metadata.get("transferred_quest_id")
    extra_bits = []
    if priority not in (None, ""):
        extra_bits.append(f"Priority: {priority}")
    if objects not in (None, ""):
        extra_bits.append(f"Objects: {objects}")
    if notes:
        extra_bits.append(notes)

    return {
        "id": external_id,
        "title": str(item.get("name", "") or "External quest"),
        "description": " | ".join(extra_bits),
        "status": local_status,
        "priority": str(priority) if priority not in (None, "") else "",
        "date": date_text,
        "deadline_at": deadline_at,
        "assigned_user": str(item.get("opener", "") or "") or None,
        "shapefile_path": None,
        "group": str(item.get("group", EXTERNAL_QUESTS_GROUP) or EXTERNAL_QUESTS_GROUP),
        "year": _extract_year(date_text),
        "ft": str(item.get("ft", "FT1") or "FT1"),
        "quest_type": str(item.get("ft", "FT1") or "FT1"),
        "matziah": matziah,
        "sync_external_id": external_id,
        "sync_source": str(item.get("source", "kipod") or "kipod"),
        "sync_name": str(item.get("name", "") or ""),
        "external_status": external_status,
        "isTransferred": bool(transferred_quest_id),
        "transferred_quest_id": transferred_quest_id,
        "geometry_type": None,
        "geometry_status": "missing",
        "geometry_source_path": None,
        "geometry_source_name": None,
        "geometry_feature_count": 0,
        "geometry_updated_at": None,
    }


def fetch_external_quests() -> list[dict[str, Any]]:
    remote_items: list[dict[str, Any]] = []
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(EXTERNAL_QUESTS_API_URL)
            response.raise_for_status()
            payload = response.json()
        remote_items = _normalize_external_payload(payload)
    except httpx.HTTPError:
        remote_items = []

    local_items = get_external_quests()
    local_items_by_id = {build_external_id(item): item for item in local_items}
    merged_items = dict(local_items_by_id)

    for item in remote_items:
        external_id = build_external_id(item)
        local_item = local_items_by_id.get(external_id)
        if local_item and str(local_item.get("source", "")) == "local-fallback":
            continue
        if local_item and local_item.get("source"):
            merged_items[external_id] = {**item, "source": local_item.get("source")}
            continue
        merged_items[external_id] = item

    return list(merged_items.values())


def find_external_quest(external_id: str) -> dict[str, Any] | None:
    for item in fetch_external_quests():
        if build_external_id(item) == external_id:
            return item
    return None


def find_external_quest_by_signature(name: str, opener: str, date_text: str) -> dict[str, Any] | None:
    normalized_date = _normalize_date(date_text)
    for item in fetch_external_quests():
        if (
            str(item.get("name", "") or "") == name
            and str(item.get("opener", "") or "") == opener
            and _normalize_date(item.get("relevancy:Date")) == normalized_date
        ):
            return item
    return None


def build_external_quest_payload(data: dict[str, Any]) -> dict[str, Any]:
    date_text = _normalize_date(data.get("date"))
    deadline_at = _normalize_deadline(data.get("deadline_at"))
    local_status = str(data.get("status") or "Start")
    quest_type = str(data.get("quest_type") or data.get("ft", "FT1") or "FT1")
    return {
        "name": str(data.get("title", "")).strip(),
        "notes": str(data.get("description", "") or ""),
        "status": map_local_status_to_external(local_status),
        "priority": str(data.get("priority", "") or ""),
        "relevancy:Date": date_text,
        "deadline_at": deadline_at,
        "opener": str(data.get("assigned_user", "") or ""),
        "group": str(data.get("group", EXTERNAL_QUESTS_GROUP) or EXTERNAL_QUESTS_GROUP),
        "year": data.get("year") or _extract_year(date_text),
        "ft": quest_type,
        "matziah": str(data.get("matziah", "N") or "N"),
    }


def _extract_created_item(response: httpx.Response) -> dict[str, Any] | None:
    if not response.content:
        return None

    try:
        payload = response.json()
    except ValueError:
        return None

    if isinstance(payload, dict) and ("name" in payload or "status" in payload):
        return payload

    normalized_items = _normalize_external_payload(payload)
    if normalized_items:
        return normalized_items[0]

    if isinstance(payload, dict):
        for key in ("quest", "item", "data", "result"):
            value = payload.get(key)
            if isinstance(value, dict):
                return value

    return None


def create_external_quest(data: dict[str, Any]) -> dict[str, Any]:
    payload = build_external_quest_payload(data)
    external_id = build_external_id(payload)

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(EXTERNAL_QUESTS_CREATE_URL, json=payload)
            response.raise_for_status()
            created_item = _extract_created_item(response)

        if created_item:
            normalized_item = {**payload, **created_item, "source": "kipod"}
            save_external_quest(build_external_id(normalized_item), normalized_item, matziah=str(normalized_item.get("matziah") or "N"))
            return normalized_item

        matching_item = find_external_quest_by_signature(
            payload["name"],
            payload["opener"],
            payload["relevancy:Date"],
        )
        if matching_item:
            normalized_item = {**matching_item, "source": "kipod"}
            save_external_quest(build_external_id(normalized_item), normalized_item, matziah=str(normalized_item.get("matziah") or "N"))
            return normalized_item
    except httpx.HTTPError:
        fallback_item = {**payload, "source": "local-fallback"}
        save_external_quest(external_id, fallback_item, matziah=str(fallback_item.get("matziah") or "N"))
        return fallback_item

    normalized_item = {**payload, "source": "kipod"}
    save_external_quest(external_id, normalized_item, matziah=str(normalized_item.get("matziah") or "N"))
    return normalized_item


def sync_external_status(quest_name: str, local_status: str) -> str:
    external_status = map_local_status_to_external(local_status)
    with httpx.Client(timeout=10.0) as client:
        response = client.post(
            EXTERNAL_QUESTS_UPDATE_STATUS_URL,
            json={"name": quest_name, "status": external_status},
        )
        response.raise_for_status()
    return external_status
