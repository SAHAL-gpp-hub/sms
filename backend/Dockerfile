FROM python:3.11-slim

WORKDIR /app
ENV PYTHONPATH=/app

# Install system dependencies for WeasyPrint (PDF generation)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements.txt &&\
    pip install --no-cache-dir -r requirements-dev.txt

# Copy all backend code
COPY . .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]