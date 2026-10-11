FROM python:3.12-slim

WORKDIR /app

# src/ must be present before the install: pyproject.toml finds its packages
# there, and setuptools refuses to build without it.
COPY pyproject.toml alembic.ini ./
COPY src ./src
RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn src.main:app --host 0.0.0.0 --port 8000"]
