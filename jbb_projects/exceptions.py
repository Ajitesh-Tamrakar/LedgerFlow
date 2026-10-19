"""DRF exception handler: map known operational failures to clean responses.

Without this, e.g. an SMTP outage would surface as an unhandled 500 that
crashes the gunicorn worker mid-request.
"""
import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def exception_handler(exc, context):
    # Import lazily so module load stays cheap and import cycles are impossible.
    from accountancy.otp import EmailSendError

    if isinstance(exc, EmailSendError):
        logger.warning('Email delivery failed for %s', context.get('request'))
        return Response(
            {'detail': 'Email service is unreachable right now. '
                       'Please try again in a few minutes.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return drf_exception_handler(exc, context)
