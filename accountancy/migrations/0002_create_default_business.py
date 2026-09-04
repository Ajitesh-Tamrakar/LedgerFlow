from django.conf import settings
from django.db import migrations


def create_default_business(apps, schema_editor):
    """TEMPORARY bootstrap until real auth/registration exists.
    Creates one default User + Business so every business= FK has
    somewhere to point via views.get_current_business()."""
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Business = apps.get_model('accountancy', 'Business')
    if not Business.objects.exists():
        user, _ = User.objects.get_or_create(username='owner')
        Business.objects.create(name='Default Business', owner=user)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accountancy', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_default_business, noop_reverse),
    ]
