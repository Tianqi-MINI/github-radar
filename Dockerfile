FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RADAR_HOST=0.0.0.0

WORKDIR /app
COPY . .

EXPOSE 8080

# $PORT is injected by Render, Cloud Run and most PaaS providers.
CMD ["sh", "-c", "python -m server.app --host 0.0.0.0 --port ${PORT:-8080}"]
