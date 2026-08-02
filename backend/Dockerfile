FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /django
ENV PYTHONPATH=/django

RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    gfortran \
    dos2unix \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000