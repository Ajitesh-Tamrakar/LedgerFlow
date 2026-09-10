from rest_framework import serializers

from accountancy.models import Dealer


class DealerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dealer
        fields = [
            "id", "name", "gstin", "opening_balance", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        # Dealer has a DB-level unique(business, name). `business` isn't a field
        # on this serializer, so DRF can't build that check itself -- do it here,
        # using the business the view put into the context.
        business = self.context["business"]
        clash = Dealer.objects.filter(business=business, name=value)
        if self.instance is not None:            # PATCH: ignore the row being edited
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("You already have a dealer with this name.")
        return value
