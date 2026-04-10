import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import embed, extract, knowledge_vector, parse, search, upsert, url

app = FastAPI(title="MindFlow AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse.router, tags=["parse"])
app.include_router(url.router, tags=["url"])
app.include_router(embed.router, tags=["embed"])
app.include_router(upsert.router, tags=["upsert"])
app.include_router(search.router, tags=["search"])
app.include_router(extract.router, tags=["extract"])
app.include_router(knowledge_vector.router, tags=["knowledge"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "mindflow-ai-service"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
