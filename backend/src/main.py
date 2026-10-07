from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api import (
    admin,
    audit_log,
    auth,
    billing,
    dashboard,
    dispatches,
    notifications,
    org,
    parties,
    plans,
    purchase_orders,
    reports,
)
from src.core.config import settings
from src.core.middleware import RequestLoggingMiddleware

app = FastAPI(title="OrderFlow API", version="0.1.0")

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router)
app.include_router(org.router)
app.include_router(parties.router)
app.include_router(purchase_orders.router)
app.include_router(dispatches.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(notifications.router)
app.include_router(billing.router)
app.include_router(plans.router)
app.include_router(audit_log.router)
app.include_router(admin.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
