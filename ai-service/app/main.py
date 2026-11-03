import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import chat, health, knowledge, prompt_studio
from app.config import get_settings
from app.observability import (
    REQUEST_ID_HEADER,
    configure_logging,
    install_request_id_middleware,
    request_id_var,
)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="OrderPilot ai-service",
        version=settings.version,
        description="LangGraph sales-ordering agent, knowledge search and Prompt Studio.",
        docs_url="/ai/docs",
        openapi_url="/ai/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER, "X-LLM-Provider", "X-LLM-Fallback"],
    )
    install_request_id_middleware(app)

    for module in (health, chat, knowledge, prompt_studio):
        app.include_router(module.router)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        logging.getLogger("orderpilot").exception("unhandled_error")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal error", "request_id": request_id_var.get()},
        )

    return app


app = create_app()
