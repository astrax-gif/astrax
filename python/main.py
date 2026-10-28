"""Quote API. Run locally:  g++ -O2 -shared -fPIC -o libquote.so native/quote.cpp
                           pip install -r requirements.txt
                           uvicorn main:app --reload --port 8001"""
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import engine

app = FastAPI(title="Website quote API")

origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


class QuoteIn(BaseModel):
    plan: int = Field(ge=0, le=2)                 # 0 Basic, 1 Editable, 2 Fully Dynamic
    extra_pages: int = Field(0, ge=0, le=50)
    integrations: int = Field(0, ge=0, le=20)
    extra_gateways: int = Field(0, ge=0, le=5)
    rush: bool = False


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/quote")
def quote(body: QuoteIn):
    try:
        return engine.quote(body.plan, body.extra_pages, body.integrations, body.extra_gateways, body.rush)
    except engine.QuoteError as e:
        raise HTTPException(status_code=400, detail=str(e))
