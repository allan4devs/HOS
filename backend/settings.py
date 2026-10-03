import os

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "stateless-planner-no-auth-or-sessions"
)
DEBUG = os.environ.get("DJANGO_DEBUG") == "1"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", ".vercel.app", "testserver"]
ROOT_URLCONF = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"
INSTALLED_APPS = []
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]
USE_TZ = False
APPEND_SLASH = False
DATA_UPLOAD_MAX_MEMORY_SIZE = 65536
SECURE_CONTENT_TYPE_NOSNIFF = True
