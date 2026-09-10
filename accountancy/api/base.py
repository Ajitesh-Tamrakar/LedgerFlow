"""The authorization layer.

Authentication (who you are) is done upstream by JWTAuthentication, which sets
request.user. This module is where that becomes authorization: every endpoint
built on it is confined to the caller's own Business.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.viewsets import ModelViewSet


class HasBusiness(BasePermission):
    """Reject an authenticated user whose account has no Business -- e.g. a
    superuser made with `createsuperuser`, which skips registration."""

    message = "This account is not linked to a business."

    def has_permission(self, request, view):
        # getattr(..., None) swallows the DoesNotExist: Django makes a missing
        # reverse-one-to-one raise a subclass of AttributeError for exactly this.
        return getattr(request.user, "business", None) is not None


class BusinessScopedMixin:
    """Shared by every business-owned endpoint -- viewset or not."""

    permission_classes = [IsAuthenticated, HasBusiness]

    @property
    def business(self):
        return self.request.user.business

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["business"] = self.business
        return context


class BusinessScopedViewSet(BusinessScopedMixin, ModelViewSet):
    """Plain CRUD resources: Dealer, Bill, Payment, Task.

    Child sets `queryset`, `serializer_class`, `filterset_class`.
    PUT and DELETE are off here by default -- corrections go through PATCH.
    Task re-enables DELETE with its own `http_method_names`.
    """

    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return super().get_queryset().filter(business=self.business)

    def perform_create(self, serializer):
        serializer.save(business=self.business)
