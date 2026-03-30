from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, geometry, quests, shapefiles, users
from services.db import init_db

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
    init_db()

@app.get("/")
def root():
    return {"status": "GIS App running", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
