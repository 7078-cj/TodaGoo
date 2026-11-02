#!/bin/sh

# Start Django server
python manage.py migrate
python seed.py

python manage.py runserver 0.0.0.0:8000