from datetime import date, datetime, timedelta
from typing import Optional, Tuple
import calendar

def safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safe division preventing ZeroDivisionError, returning rounded 2 decimal places."""
    if not denominator or denominator == 0:
        return default
    return round((numerator / denominator) * 100.0, 2)


def is_date_overdue(d, today: date) -> bool:
    """Safely checks if a date or datetime is strictly before today."""
    if not d:
        return False
    val = d.date() if hasattr(d, "hour") else d
    return val < today


def get_date_range_preset(preset: Optional[str], custom_start: Optional[date] = None, custom_end: Optional[date] = None) -> Tuple[Optional[date], Optional[date], str]:
    """
    Resolves human preset date ranges to absolute date_from and date_to dates.
    Presets:
    TODAY, YESTERDAY, THIS_WEEK, LAST_WEEK, THIS_MONTH, LAST_MONTH, THIS_QUARTER, LAST_QUARTER, THIS_YEAR, LAST_YEAR, ALL_TIME, CUSTOM
    """
    today = date.today()
    if not preset or preset.upper() == "ALL_TIME":
        return custom_start, custom_end, "All Time"

    p = preset.upper().strip()

    if p == "TODAY":
        return today, today, "Today"

    elif p == "YESTERDAY":
        y = today - timedelta(days=1)
        return y, y, "Yesterday"

    elif p == "THIS_WEEK":
        # Monday to Sunday
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        return start, end, "This Week"

    elif p == "LAST_WEEK":
        start = today - timedelta(days=today.weekday() + 7)
        end = start + timedelta(days=6)
        return start, end, "Last Week"

    elif p == "THIS_MONTH":
        start = date(today.year, today.month, 1)
        _, last_day = calendar.monthrange(today.year, today.month)
        end = date(today.year, today.month, last_day)
        return start, end, "This Month"

    elif p == "LAST_MONTH":
        if today.month == 1:
            year = today.year - 1
            month = 12
        else:
            year = today.year
            month = today.month - 1
        _, last_day = calendar.monthrange(year, month)
        return date(year, month, 1), date(year, month, last_day), "Last Month"

    elif p == "THIS_QUARTER":
        quarter = (today.month - 1) // 3 + 1
        start_month = (quarter - 1) * 3 + 1
        end_month = start_month + 2
        _, last_day = calendar.monthrange(today.year, end_month)
        return date(today.year, start_month, 1), date(today.year, end_month, last_day), f"Q{quarter} {today.year}"

    elif p == "LAST_QUARTER":
        quarter = (today.month - 1) // 3 + 1
        if quarter == 1:
            l_quarter = 4
            year = today.year - 1
        else:
            l_quarter = quarter - 1
            year = today.year
        start_month = (l_quarter - 1) * 3 + 1
        end_month = start_month + 2
        _, last_day = calendar.monthrange(year, end_month)
        return date(year, start_month, 1), date(year, end_month, last_day), f"Q{l_quarter} {year}"

    elif p == "THIS_YEAR":
        return date(today.year, 1, 1), date(today.year, 12, 31), f"Year {today.year}"

    elif p in ["LAST_30_DAYS", "30_DAYS"]:
        return today - timedelta(days=30), today, "Last 30 Days"

    elif p in ["LAST_90_DAYS", "90_DAYS"]:
        return today - timedelta(days=90), today, "Last 90 Days"

    elif p == "CUSTOM":
        label = "Custom Period"
        if custom_start and custom_end:
            label = f"{custom_start.isoformat()} to {custom_end.isoformat()}"
        elif custom_start:
            label = f"Since {custom_start.isoformat()}"
        elif custom_end:
            label = f"Up to {custom_end.isoformat()}"
        return custom_start, custom_end, label

    return custom_start, custom_end, "Selected Range"
