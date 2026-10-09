import sys
from contextlib import asynccontextmanager
from urllib.parse import urlparse

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
from src.core.migrate import run_migrations


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Bring the schema to head before this process serves anything.

    Nothing else in the pipeline owns that ordering -- see
    src/core/migrate.py for why, and for how to turn this off if a separate
    release phase ever takes it over.

    Skipped under pytest, deliberately and defensively. Constructing a
    TestClient runs this lifespan, and `settings.database_url` is read from
    backend/.env, which on a developer machine may well point at the hosted
    database -- so without this guard a test run connects to production and
    runs `alembic upgrade head` against it. tests/conftest.py also turns
    auto_migrate off; this is the second lock on the same door, because the
    cost of a test migrating production is far higher than the cost of a
    redundant check.
    """
    if "pytest" not in sys.modules:
        run_migrations()
    yield


app = FastAPI(title="OrderFlow API", version="0.1.0", lifespan=lifespan)

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
    """Liveness, plus which database host this process is pointed at.

    The host alone -- never the user, password, or database name. It is here so
    a test run can refuse to write fabricated organizations into a production
    database, the same check `seed_landing_demo.py` makes before seeding.
    Knowing the hostname of a database you cannot reach is not a disclosure
    worth the risk of a suite silently populating real customer data.
    """
    return {
        "status": "ok",
        "database_host": urlparse(settings.database_url).hostname,
    }
