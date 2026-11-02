#!/bin/sh

# Start Django server
python manage.py migrate
python seed.py

# [SEC-C3] daphne instead of the runserver development server
daphne -b 0.0.0.0 -p ${PORT:-8000} backend.asgi:application