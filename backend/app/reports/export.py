import csv
import io
from typing import List, Dict, Any
from fastapi.responses import Response

def generate_csv_response(filename: str, headers: List[str], rows: List[List[Any]]) -> Response:
    """
    Generates a clean RFC-4180 compliant CSV file response for browser download.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    for r in rows:
        # Convert all fields cleanly to string / primitive
        clean_row = [str(col) if col is not None else "" for col in r]
        writer.writerow(clean_row)

    csv_content = output.getvalue()
    output.close()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache",
        },
    )
