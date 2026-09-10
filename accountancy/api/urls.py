from rest_framework.routers import DefaultRouter

from accountancy.api.views import DealerViewSet, TaskViewSet

router = DefaultRouter()
router.register("dealers", DealerViewSet, basename="dealer")
router.register("tasks", TaskViewSet, basename="task")

urlpatterns = router.urls
