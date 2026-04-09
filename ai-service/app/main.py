import os

from fastapi import FastAPI

app = FastAPI(title="MindFlow AI Service")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "mindflow-ai-service"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
