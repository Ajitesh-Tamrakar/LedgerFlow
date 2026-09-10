from rest_framework.routers import DefaultRouter

from accountancy.api.views import DealerViewSet

router = DefaultRouter()
router.register("dealers", DealerViewSet, basename="dealer")

urlpatterns = router.urls
