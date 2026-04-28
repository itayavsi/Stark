from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, geometry, quests, shapefiles, users
from services.db import get_connection
from services.migrations import run_migrations

app = FastAPI(title="GIS App API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(quests.router, prefix="/quests", tags=["quests"])
app.include_router(geometry.router, prefix="/geometry", tags=["geometry"])
app.include_router(shapefiles.router, prefix="/shapefiles", tags=["shapefiles"])
app.include_router(users.router, prefix="/users", tags=["users"])


@app.on_event("startup")
def startup():
    run_migrations()

@app.get("/")
def root():
    return {"status": "GIS App running", "version": "1.0.0"}


@app.get("/health/db")
def db_health():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS ok;")
                row = cur.fetchone()
        return {"status": "ok", "database": "connected", "ok": row["ok"] == 1}
    except Exception as exc:
        return {"status": "error", "database": "disconnected", "detail": str(exc)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
