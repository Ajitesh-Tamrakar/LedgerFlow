"""Project-level views: serving the built SPA and uploaded media, so a
single container needs no second web server (nginx)."""

from mimetypes import guess_type

from django.conf import settings
from django.http import FileResponse, Http404


def spa_index(request):
    """Catch-all for the React SPA: any non-API route serves the built
    index.html (collected into STATIC_ROOT from frontend/dist); the client
    router then takes over."""
    index = settings.STATIC_ROOT / "index.html"
    if not index.is_file():
        raise Http404("The frontend has not been built (frontend/dist).")
    return FileResponse(index.open("rb"), content_type="text/html")


def serve_media(request, path):
    """Serve uploaded bill files under MEDIA_URL."""
    full = settings.MEDIA_ROOT / path
    if not full.is_file():
        raise Http404
    content_type, _ = guess_type(str(full))
    return FileResponse(full.open("rb"), content_type=content_type or "application/pdf")
