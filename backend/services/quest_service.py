import uuid
from datetime import datetime

from services.external_quest_service import (
    build_external_id,
    compose_open_quest_zarhan_notes,
    create_external_quest,
    fetch_external_quests,
    find_external_quest,
    map_local_status_to_external,
    sync_external_status,
    transform_external_quest_with_metadata,
)
from services.storage import (
    delete_external_quest,
    get_external_quest,
    get_finished_quests,
    get_quest_by_sync_external_id,
    get_quest_by_id,
    get_quests,
    move_quest,
    save_external_quest,
    save_quest,
    update_external_quest_status,
    update_quest,
)


VALID_MATZIAH = {"N", "H", "M"}
FINISHED_STATUSES = {"Finished", "Done", "Created"}


def _normalize_matziah(value: str | None, default: str) -> str:
    normalized = str(value or "").strip().upper()
    if normalized in VALID_MATZIAH:
        return normalized
    return default


def _build_local_quest_payload(data: dict, default_matziah: str = "H") -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    sync_external_id = data.get("sync_external_id")
    quest_type = data.get("quest_type")
    if quest_type in (None, ""):
        quest_type = data.get("ft")
    if quest_type in (None, "") and not sync_external_id:
        quest_type = "FT1"
    status = data.get("status", "Start")
    raw_priority = data.get("priority")
    raw_deadline_at = data.get("deadline_at")
    raw_date = data.get("date")
    deadline_at = raw_deadline_at
    if deadline_at in (None, "") and data.get("priority") == "deadline" and isinstance(raw_date, str) and "T" in raw_date:
        deadline_at = raw_date
    normalized_date = raw_date or today
    if isinstance(normalized_date, str) and "T" in normalized_date:
        normalized_date = normalized_date.split("T", 1)[0]
    entry_date = data.get("entry_date") or today
    finished_date = data.get("finished_date")
    if status in FINISHED_STATUSES and not finished_date:
        finished_date = today
    if status not in FINISHED_STATUSES:
        finished_date = None
    quest = {
        "id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "status": status,
        "priority": "ב" if raw_priority is None else raw_priority,
        "date": normalized_date,
        "deadline_at": deadline_at,
        "assigned_user": data.get("assigned_user"),
        "shapefile_path": data.get("shapefile_path"),
        "model_simulations": data.get("model_simulations"),
        "model_folder": data.get("model_folder"),
        "target_type": data.get("target_type"),
        "country": data.get("country"),
        "zarhan_notes": data.get("zarhan_notes"),
        "user_priority": data.get("user_priority"),
        "duo_to_use": data.get("duo_to_use"),
        "ground_point": data.get("ground_point"),
        "solve_strategy": data.get("solve_strategy"),
        "entry_date": entry_date,
        "finished_date": finished_date,
        "group": data.get("group", "לווינות"),
        "year": data.get("year", datetime.now().year),
        "ft": quest_type,
        "quest_type": quest_type,
        "matziah": _normalize_matziah(
            data.get("matziah"),
            default="N" if sync_external_id and default_matziah == "H" else default_matziah,
        ),
        "sync_external_id": sync_external_id,
        "sync_source": data.get("sync_source"),
        "sync_name": data.get("sync_name"),
        "geometry_type": None,
        "geometry_status": "pending" if data.get("shapefile_path") else "missing",
        "geometry_source_path": data.get("shapefile_path"),
        "geometry_source_name": None,
        "geometry_feature_count": 0,
        "geometry_updated_at": None,
    }
    return quest


def _should_sync_external_status(quest: dict) -> bool:
    return _normalize_matziah(quest.get("matziah"), default="H") == "N" and bool(quest.get("sync_name"))


def get_all_quests():
    open_quests = get_quests()
    finished_quests = get_finished_quests()
    local_quests = [*open_quests, *finished_quests]
    local_external_sync_ids = {
        str(quest.get("sync_external_id"))
        for quest in local_quests
        if quest.get("sync_external_id")
    }

    try:
        external_items = fetch_external_quests()
        external_quests = []
        for item in external_items:
            external_id = build_external_id(item)
            stored_external = get_external_quest(external_id)
            if external_id in local_external_sync_ids:
                continue
            if stored_external and stored_external.get("transferred_quest_id"):
                continue

            external_quests.append(
                transform_external_quest_with_metadata(
                    item,
                    status_override=stored_external.get("local_status") if stored_external else None,
                    metadata=stored_external,
                )
            )
    except Exception:
        external_quests = []

    return [*local_quests, *external_quests]


def get_quest(quest_id: str):
    return get_quest_by_id(quest_id)


def create_quest(data: dict):
    quest = _build_local_quest_payload(data, default_matziah="H")
    save_quest(quest)
    return get_quest(quest["id"]) or quest


def create_external_quest_entry(data: dict):
    matziah = _normalize_matziah(data.get("matziah"), default="N")
    external_item = create_external_quest({**data, "matziah": matziah})
    external_id = build_external_id(external_item)
    stored_external = save_external_quest(external_id, external_item, matziah=matziah)
    return transform_external_quest_with_metadata(external_item, metadata=stored_external)


def transfer_external_quest_to_local(quest_id: str):
    existing_local_quest = get_quest_by_sync_external_id(quest_id)
    if existing_local_quest is not None:
        stored_external = get_external_quest(quest_id)
        if stored_external is not None:
            save_external_quest(
                quest_id,
                stored_external,
                matziah=_normalize_matziah(existing_local_quest.get("matziah"), default="N"),
                local_status=stored_external.get("local_status"),
                transferred_quest_id=existing_local_quest["id"],
            )
            delete_external_quest(quest_id)
        return existing_local_quest

    external_quest = find_external_quest(quest_id)
    if external_quest is None:
        return None

    stored_external = get_external_quest(quest_id)
    transformed_external = transform_external_quest_with_metadata(
        external_quest,
        status_override=stored_external.get("local_status") if stored_external else None,
        metadata=stored_external,
    )
    local_quest = create_quest(
        {
            "title": transformed_external["title"],
            "description": transformed_external["description"],
            "status": transformed_external["status"],
            "priority": transformed_external["priority"],
            "date": transformed_external["date"],
            "deadline_at": transformed_external.get("deadline_at"),
            "assigned_user": transformed_external["assigned_user"],
            "model_simulations": transformed_external.get("model_simulations"),
            "target_type": transformed_external.get("target_type"),
            "country": transformed_external.get("country"),
            "zarhan_notes": compose_open_quest_zarhan_notes(
                transformed_external.get("zarhan_notes"),
                transformed_external.get("relevance"),
                transformed_external.get("objects"),
                transformed_external.get("matziah"),
            ),
            "user_priority": transformed_external.get("user_priority"),
            "duo_to_use": transformed_external.get("duo_to_use"),
            "ground_point": transformed_external.get("ground_point"),
            "solve_strategy": transformed_external.get("solve_strategy"),
            "entry_date": transformed_external.get("entry_date"),
            "finished_date": transformed_external.get("finished_date"),
            "group": transformed_external["group"],
            "year": transformed_external["year"],
            "ft": transformed_external["ft"],
            "matziah": transformed_external["matziah"],
            "sync_external_id": transformed_external["sync_external_id"],
            "sync_source": transformed_external["sync_source"],
            "sync_name": transformed_external["sync_name"],
        }
    )
    save_external_quest(
        quest_id,
        external_quest,
        matziah=transformed_external["matziah"],
        local_status=stored_external.get("local_status") if stored_external else None,
        transferred_quest_id=local_quest["id"],
    )
    delete_external_quest(quest_id)
    return local_quest


def take_quest(quest_id: str, username: str):
    return update_quest(quest_id, {"status": "Production", "assigned_user": username})


def complete_quest(quest_id: str):
    return update_quest_status(quest_id, "Finished")


def update_quest_status(quest_id: str, status: str):
    if quest_id.startswith("external:"):
        external_quest = find_external_quest(quest_id)
        if external_quest is None:
            return None

        stored_external = get_external_quest(quest_id)
        external_status = map_local_status_to_external(status)
        matziah = _normalize_matziah(
            stored_external.get("matziah") if stored_external else None,
            default="N",
        )
        if matziah == "N" and str(external_quest.get("source", "kipod") or "kipod") != "local-fallback":
            sync_external_status(str(external_quest.get("name", "")), status)

        saved_external = save_external_quest(
            quest_id,
            {**external_quest, "status": external_status},
            matziah=matziah,
            local_status=status,
            transferred_quest_id=stored_external.get("transferred_quest_id") if stored_external else None,
        )
        return transform_external_quest_with_metadata(
            {**external_quest, "status": external_status},
            status_override=status,
            metadata=saved_external,
        )

    current_quest = get_quest(quest_id)
    if current_quest is None:
        return None

    if _should_sync_external_status(current_quest):
        external_status = map_local_status_to_external(status)
        if current_quest.get("sync_source") != "local-fallback":
            sync_external_status(str(current_quest.get("sync_name", "")), status)
        sync_external_id = current_quest.get("sync_external_id")
        if sync_external_id:
            update_external_quest_status(sync_external_id, external_status, status)

    current_status = str(current_quest.get("status") or "")
    today = datetime.now().strftime("%Y-%m-%d")
    if status in FINISHED_STATUSES and current_status not in FINISHED_STATUSES:
        return move_quest(quest_id, "finished_quests", {"status": status, "finished_date": today})

    if status not in FINISHED_STATUSES and current_status in FINISHED_STATUSES:
        return move_quest(quest_id, "open_quests", {"status": status, "finished_date": None})

    if status in FINISHED_STATUSES:
        return update_quest(
            quest_id,
            {
                "status": status,
                "finished_date": current_quest.get("finished_date") or today,
            },
        )
    return update_quest(quest_id, {"status": status})


def update_quest_priority(quest_id: str, priority: str):
    if quest_id.startswith("external:"):
        external_quest = find_external_quest(quest_id)
        if external_quest is None:
            return None

        stored_external = get_external_quest(quest_id)
        matziah = _normalize_matziah(
            stored_external.get("matziah") if stored_external else None,
            default="N",
        )
        next_payload = {**external_quest, "priority": priority}
        if priority != "deadline":
            next_payload["deadline_at"] = None

        saved_external = save_external_quest(
            quest_id,
            next_payload,
            matziah=matziah,
            local_status=stored_external.get("local_status") if stored_external else None,
            transferred_quest_id=stored_external.get("transferred_quest_id") if stored_external else None,
        )
        return transform_external_quest_with_metadata(
            next_payload,
            status_override=stored_external.get("local_status") if stored_external else None,
            metadata=saved_external,
        )

    if priority != "deadline":
        return update_quest(quest_id, {"priority": priority, "deadline_at": None})
    return update_quest(quest_id, {"priority": priority})


def update_quest_fields(quest_id: str, fields: dict):
    allowed_fields = {
        "title",
        "status",
        "priority",
        "ft",
        "assigned_user",
        "group",
        "year",
        "date",
        "deadline_at",
        "notes",
        "model_folder",
        "model_simulations",
        "target_type",
        "country",
        "zarhan_notes",
        "user_priority",
        "duo_to_use",
        "ground_point",
        "solve_strategy",
        "entry_date",
        "finished_date",
    }
    update_data = {k: v for k, v in fields.items() if k in allowed_fields}
    if not update_data:
        return None

    if quest_id.startswith("external:"):
        external_quest = find_external_quest(quest_id)
        if external_quest is None:
            return None

        stored_external = get_external_quest(quest_id)
        matziah = _normalize_matziah(
            stored_external.get("matziah") if stored_external else external_quest.get("matziah"),
            default="N",
        )
        next_payload = dict(external_quest)
        field_mapping = {
            "title": "name",
            "priority": "priority",
            "assigned_user": "opener",
            "group": "group",
            "year": "year",
            "date": "relevancy:Date",
            "deadline_at": "deadline_at",
            "notes": "notes",
            "model_simulations": "model_name",
            "ft": "ft",
            "target_type": "target_type",
            "country": "country",
            "zarhan_notes": "zarhan_notes",
            "user_priority": "user_priority",
            "duo_to_use": "duo_to_use",
            "ground_point": "ground_point",
            "solve_strategy": "solve_strategy",
            "entry_date": "entry_date",
            "finished_date": "finished_date",
        }
        for key, value in update_data.items():
            if key == "status":
                next_payload["status"] = map_local_status_to_external(str(value))
                continue
            mapped_key = field_mapping.get(key)
            if mapped_key:
                next_payload[mapped_key] = value

        status_override = (
            str(update_data["status"])
            if "status" in update_data
            else stored_external.get("local_status") if stored_external else None
        )
        saved_external = save_external_quest(
            quest_id,
            next_payload,
            matziah=matziah,
            local_status=status_override,
            transferred_quest_id=stored_external.get("transferred_quest_id") if stored_external else None,
        )
        return transform_external_quest_with_metadata(
            next_payload,
            status_override=status_override,
            metadata=saved_external,
        )

    next_status = update_data.pop("status", None)
    if next_status is not None:
        updated_status = update_quest_status(quest_id, str(next_status))
        if updated_status is None:
            return None
        # finished_date is system-managed when status changes between open/finished flows.
        update_data.pop("finished_date", None)

    if update_data:
        return update_quest(quest_id, update_data)

    if next_status is not None:
        return get_quest(quest_id)

    return None


def get_saved_quest_sort(group: str, view: str):
    return []


def save_saved_quest_sort(group: str, view: str, quest_ids: list[str]):
    return [str(quest_id) for quest_id in quest_ids]
