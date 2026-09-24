import os
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from backend.game.service import GameError, GameService
from backend.models import AnswerRequest, ContextRequest, CountryList, ErrorResponse, GameResponse, Settings
from backend.repositories.countries import ROOT, Countries


def create_app(service: GameService | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not getattr(app.state, "game", None):
            load_dotenv(ROOT / ".env", override=False)
            keys = [key.strip() for key in os.getenv("SPEEDFLAGS_KEYS", "").split(",") if key.strip()]
            app.state.game = GameService(Countries(), keys)
        yield

    app = FastAPI(
        title="speedFlags API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    if service:
        app.state.game = service

    @app.middleware("http")
    async def headers(request: Request, call_next):
        # The hosting proxy also limits request bodies; reject oversized declared payloads early.
        try:
            oversized = int(request.headers.get("content-length", "0")) > 80_000
        except ValueError:
            oversized = True
        if oversized:
            return JSONResponse(
                {"error": {"code": "too_large", "message": "Request body is too large."}}, status_code=413
            )
        response = await call_next(request)
        response.headers["X-Request-ID"] = uuid.uuid4().hex
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not request.url.path.startswith("/api/"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
            )
        if request.url.path.startswith(("/flags/", "/assets/")) and response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif request.url.path == "/":
            response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    @app.exception_handler(GameError)
    async def game_error(request: Request, exc: GameError):
        return JSONResponse({"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        return JSONResponse(
            {"error": {"code": "invalid_request", "message": "Check the submitted fields and try again."}},
            status_code=422,
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse(
            {
                "error": {
                    "code": "not_found" if exc.status_code == 404 else "http_error",
                    "message": "Route not found." if exc.status_code == 404 else "Request not allowed.",
                }
            },
            status_code=exc.status_code,
        )

    errors = {status: {"model": ErrorResponse} for status in (400, 401, 409, 410, 422)}

    @app.get("/api/health")
    def health(request: Request):
        return {"status": "ok", "dataset_version": request.app.state.game.countries.version}

    @app.get("/api/v1/countries", response_model=CountryList)
    def countries(request: Request, response: Response):
        response.headers["Cache-Control"] = "public, max-age=300"
        data = request.app.state.game.countries
        return CountryList(
            version=data.version,
            countries=[
                {"id": r["id"], "name": r["name"], "aliases": [r["official"], *r["aliases"]]} for r in data.rows
            ],
        )

    @app.post("/api/v1/games", response_model=GameResponse, responses=errors)
    def create(settings: Settings, request: Request):
        return request.app.state.game.create(settings)

    @app.post("/api/v1/games/{game_id}/start", response_model=GameResponse, responses=errors)
    def start(game_id: str, body: ContextRequest, request: Request):
        return request.app.state.game.start(game_id, body.token)

    @app.post("/api/v1/games/{game_id}/answers", response_model=GameResponse, responses=errors)
    def answer(game_id: str, body: AnswerRequest, request: Request):
        return request.app.state.game.answer(game_id, body)

    @app.post("/api/v1/games/{game_id}/sync", response_model=GameResponse, responses=errors)
    def sync(game_id: str, body: ContextRequest, request: Request):
        service = request.app.state.game
        state = service.decode(body.token, game_id)
        service.expire(state)
        return service.response(state)

    @app.post("/api/v1/games/{game_id}/finish", response_model=GameResponse, responses=errors)
    def finish(game_id: str, body: ContextRequest, request: Request):
        return request.app.state.game.finish(game_id, body.token)

    # API misses must never fall through to the SPA shell.
    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def api_missing(path: str):
        raise HTTPException(404)

    assets = ROOT / "frontend/public/flags"
    app.mount("/flags", StaticFiles(directory=assets), name="flags")
    dist = ROOT / "frontend/dist"
    app.mount("/assets", StaticFiles(directory=dist / "assets", check_dir=False), name="assets")
    app.frontend("/", directory=str(dist), check_dir=False)
    return app


app = create_app()
