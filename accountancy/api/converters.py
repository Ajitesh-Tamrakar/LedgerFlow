from datetime import date


class DateConverter:
    """URL segment <date:x> -> a datetime.date. A non-ISO segment fails the
    regex, so /api/cashbook/by-date/banana/ is a clean 404, not a 500."""

    regex = r"\d{4}-\d{2}-\d{2}"

    def to_python(self, value):
        return date.fromisoformat(value)

    def to_url(self, value):
        return value.isoformat()
