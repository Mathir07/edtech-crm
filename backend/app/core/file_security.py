import os
import re
from typing import Optional, Set
from fastapi import HTTPException, status

DEFAULT_ALLOWED_EXTENSIONS: Set[str] = {
    ".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".log", ".json", ".zip", ".csv", ".docx", ".xlsx"
}

DISALLOWED_EXTENSIONS: Set[str] = {
    ".exe", ".bat", ".cmd", ".sh", ".py", ".pyw", ".php", ".phtml", ".pl", ".cgi", 
    ".js", ".mjs", ".html", ".htm", ".vbs", ".dll", ".so", ".bin", ".jar", ".war",
    ".jsp", ".asp", ".aspx"
}

def sanitize_filename(filename: str) -> str:
    """
    Sanitizes an uploaded filename by stripping path traversal characters,
    directory separators, and non-safe characters.
    """
    if not filename:
        return "attachment"
    
    # Strip directory paths
    base = os.path.basename(filename)
    
    # Remove path traversal tokens and null bytes
    base = base.replace("\0", "").replace("..", "")
    
    # Keep only alphanumeric, hyphen, underscore, dot
    clean = re.sub(r"[^a-zA-Z0-9_\.\-]", "_", base)
    
    # Ensure it's not empty and does not start with a dot
    clean = clean.lstrip(".")
    if not clean:
        clean = "attachment"
        
    return clean

def validate_uploaded_file(
    filename: str,
    file_bytes_len: int,
    max_size_bytes: int = 10 * 1024 * 1024,
    allowed_extensions: Optional[Set[str]] = None,
) -> str:
    """
    Validates file size, extension whitelist, and returns sanitized filename.
    Raises HTTPException(400) if validation fails.
    """
    if file_bytes_len > max_size_bytes:
        max_mb = max_size_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit ({max_mb}MB)."
        )

    safe_name = sanitize_filename(filename)
    _, ext = os.path.splitext(safe_name)
    ext_lower = ext.lower()

    if ext_lower in DISALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext_lower}' is strictly forbidden for security reasons."
        )

    allowed = allowed_extensions or DEFAULT_ALLOWED_EXTENSIONS
    if ext_lower not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext_lower}'. Allowed types: {', '.join(sorted(allowed))}"
        )

    return safe_name
