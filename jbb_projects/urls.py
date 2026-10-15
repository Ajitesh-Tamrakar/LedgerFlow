from django.contrib import admin
from django.urls import include, path, re_path

from jbb_projects import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('dj_rest_auth.urls')),
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    path('api/auth/otp/', include('accountancy.auth_urls')),
    path('api/', include('accountancy.api.urls')),

    # Uploaded bill files (MEDIA_URL)
    path('bill_imgs/<path:path>', views.serve_media),

    # React SPA catch-all -- must stay LAST. Excludes api/admin/media so
    # unknown API routes still 404 as before; every other path (/, /bills,
    # /payments, /login, ...) serves the built index.html.
    re_path(r'^(?!api/|admin/|bill_imgs/).*$', views.spa_index),
]
