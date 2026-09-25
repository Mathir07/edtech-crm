"""
Storage Abstraction Layer (Phase 2B Foundation)
Provides a unified interface for private CRM object storage, supporting:
- LocalStorageBackend for offline development and testing
- ProductionStorageBackend contract for cloud object stores (Cloudflare R2, AWS S3, Vercel Blob)
- Factory dependency get_storage_backend() for FastAPI dependency injection
"""

import io
import os
import re
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, BinaryIO, Dict, Optional, Set, Tuple

from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.file_security import sanitize_filename, validate_uploaded_file


class StorageResult(BaseModel):
    """Metadata result returned after successfully storing an object."""
    key: str
    filename: str
    content_type: str
    size: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StorageBackend(ABC):
    """
    Abstract Base Class defining the contract for private CRM object storage.
    All attachments (bugs, tickets, communications, receipts) must adhere
    to this interface.
    """

    @abstractmethod
    def upload(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: Optional[str] = None,
        prefix: str = "",
        max_size_bytes: int = 15 * 1024 * 1024,
        allowed_extensions: Optional[Set[str]] = None,
    ) -> StorageResult:
        """
        Validates, sanitizes, and persists binary file data under a unique object key.
        Returns a StorageResult with the assigned key and file metadata.
        """
        pass

    @abstractmethod
    def get_stream(self, key: str) -> Tuple[BinaryIO, str, int]:
        """
        Retrieves a readable binary stream for the specified object key.
        Returns (stream, content_type, size).
        Raises FileNotFoundError if the object does not exist.
        """
        pass

    @abstractmethod
    def read_bytes(self, key: str) -> bytes:
        """
        Reads and returns the complete binary content of the specified object.
        Raises FileNotFoundError if the object does not exist.
        """
        pass

    @abstractmethod
    def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        """
        Generates a pre-signed, temporary download URL for secure direct client access.
        """
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        """
        Deletes the object with the specified key.
        Returns True if deleted, False if the object did not exist.
        """
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """
        Returns True if an object exists at the specified key, False otherwise.
        """
        pass


class LocalStorageBackend(StorageBackend):
    """
    Local filesystem storage backend for local development and unit tests.
    Serverless-safe:
    - Does NOT create directories at import time.
    - Only creates destination subdirectories on demand when upload() is invoked.
    - Strictly prevents path traversal attacks by validating resolved paths against base_dir.
    """

    def __init__(self, base_dir: Optional[str] = None):
        if base_dir:
            self.base_dir = os.path.abspath(base_dir)
        else:
            # Default to 'storage' relative to backend root
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self.base_dir = os.path.abspath(os.path.join(backend_root, settings.STORAGE_LOCAL_DIR))

    def _resolve_path(self, key: str) -> str:
        """
        Resolves a storage key to an absolute local filesystem path.
        Enforces path traversal protection.
        """
        if not key or not isinstance(key, str):
            raise ValueError("Storage key must be a non-empty string.")

        # Disallow null bytes and explicit traversal sequences
        if "\0" in key or ".." in key.replace("\\", "/").split("/"):
            raise ValueError(f"Path traversal detected in key: {key}")

        # Disallow leading slashes, absolute paths, or Windows drive specifications
        if key.startswith(("/", "\\")) or (len(key) > 1 and key[1] == ":"):
            raise ValueError(f"Path traversal detected: absolute paths are not permitted in key: {key}")

        parts = [p for p in key.replace("\\", "/").split("/") if p and p != "."]
        target_path = os.path.abspath(os.path.join(self.base_dir, *parts))

        # Security check: must reside inside base_dir
        if not target_path.startswith(self.base_dir + os.sep) and target_path != self.base_dir:
            raise ValueError(f"Path traversal detected: {key} resolves outside storage root.")

        return target_path

    def upload(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: Optional[str] = None,
        prefix: str = "",
        max_size_bytes: int = 15 * 1024 * 1024,
        allowed_extensions: Optional[Set[str]] = None,
    ) -> StorageResult:
        if not isinstance(file_bytes, (bytes, bytearray)):
            raise ValueError("file_bytes must be bytes or bytearray.")

        safe_filename = validate_uploaded_file(
            filename=filename,
            file_bytes_len=len(file_bytes),
            max_size_bytes=max_size_bytes,
            allowed_extensions=allowed_extensions,
        )

        effective_content_type = content_type or "application/octet-stream"

        # Build clean prefix
        clean_prefix = re.sub(r"[^a-zA-Z0-9_\-\/]", "_", prefix.strip("/"))
        unique_id = uuid.uuid4().hex[:12]
        file_key_name = f"{unique_id}_{safe_filename}"

        if clean_prefix:
            key = f"{clean_prefix}/{file_key_name}"
        else:
            key = file_key_name

        target_path = self._resolve_path(key)

        # On-demand directory creation (never at module import time)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

        with open(target_path, "wb") as f:
            f.write(file_bytes)

        return StorageResult(
            key=key,
            filename=safe_filename,
            content_type=effective_content_type,
            size=len(file_bytes),
        )

    def get_stream(self, key: str) -> Tuple[BinaryIO, str, int]:
        target_path = self._resolve_path(key)
        if not os.path.isfile(target_path):
            raise FileNotFoundError(f"Storage object not found: {key}")

        size = os.path.getsize(target_path)
        with open(target_path, "rb") as f:
            data = f.read()
        stream = io.BytesIO(data)
        ext = os.path.splitext(target_path)[1].lower()
        content_type_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".csv": "text/csv",
            ".json": "application/json",
            ".zip": "application/zip",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")
        return stream, content_type, size

    def read_bytes(self, key: str) -> bytes:
        target_path = self._resolve_path(key)
        if not os.path.isfile(target_path):
            raise FileNotFoundError(f"Storage object not found: {key}")
        with open(target_path, "rb") as f:
            return f.read()

    def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        if not self.exists(key):
            raise FileNotFoundError(f"Storage object not found: {key}")
        return f"/api/v1/storage/{key}?expires={expires_in}"

    def delete(self, key: str) -> bool:
        try:
            target_path = self._resolve_path(key)
            if os.path.isfile(target_path):
                os.remove(target_path)
                return True
            return False
        except (FileNotFoundError, ValueError):
            return False

    def exists(self, key: str) -> bool:
        try:
            target_path = self._resolve_path(key)
            return os.path.isfile(target_path)
        except ValueError:
            return False


class ProductionStorageBackend(StorageBackend):
    """
    Production Object Storage Backend for S3/R2-compatible storage
    (Cloudflare R2, AWS S3, etc.).

    Fails explicitly if invoked without required production cloud credentials,
    preventing silent fallback to ephemeral serverless container filesystem.
    """

    def __init__(
        self,
        provider: str = "s3",
        bucket_name: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        region: str = "auto",
        public_url_prefix: Optional[str] = None,
        client: Optional[Any] = None,
    ):
        self.provider = provider
        self.bucket_name = bucket_name or settings.STORAGE_BUCKET_NAME
        self.endpoint_url = endpoint_url or settings.STORAGE_ENDPOINT_URL
        self.access_key_id = access_key_id or settings.STORAGE_ACCESS_KEY_ID
        self.secret_access_key = secret_access_key or settings.STORAGE_SECRET_ACCESS_KEY
        self.region = region or settings.STORAGE_REGION or "auto"
        self.public_url_prefix = public_url_prefix or settings.STORAGE_PUBLIC_URL_PREFIX
        self._client = client

        self._validate_contract()

    def _validate_contract(self) -> None:
        """Verifies that production credentials exist when production backend is selected."""
        missing = []
        if not self.bucket_name:
            missing.append("STORAGE_BUCKET_NAME")
        if not self.access_key_id:
            missing.append("STORAGE_ACCESS_KEY_ID")
        if not self.secret_access_key:
            missing.append("STORAGE_SECRET_ACCESS_KEY")

        if missing:
            raise RuntimeError(
                f"Production storage backend '{self.provider}' configured, but required "
                f"credentials are missing: {', '.join(missing)}. "
                "Refusing silent fallback to local filesystem in production."
            )

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client

        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            raise RuntimeError(
                "boto3 is required for S3/R2-compatible production storage backend. "
                "Ensure boto3 is installed."
            )

        # Cloudflare R2 and S3-compatible configuration
        config = Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
            s3={"addressing_style": "path"},
        )

        kwargs: Dict[str, Any] = {
            "service_name": "s3",
            "aws_access_key_id": self.access_key_id,
            "aws_secret_access_key": self.secret_access_key,
            "region_name": self.region if self.region != "auto" else "us-east-1",
            "config": config,
        }
        if self.endpoint_url:
            kwargs["endpoint_url"] = self.endpoint_url

        self._client = boto3.client(**kwargs)
        return self._client

    @staticmethod
    def _guess_content_type(filename: str) -> str:
        ext = os.path.splitext(filename)[1].lower()
        content_type_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".log": "text/plain",
            ".csv": "text/csv",
            ".json": "application/json",
            ".zip": "application/zip",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        return content_type_map.get(ext, "application/octet-stream")

    def upload(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: Optional[str] = None,
        prefix: str = "",
        max_size_bytes: int = 15 * 1024 * 1024,
        allowed_extensions: Optional[Set[str]] = None,
    ) -> StorageResult:
        if not isinstance(file_bytes, (bytes, bytearray)):
            raise ValueError("file_bytes must be bytes or bytearray.")

        safe_filename = validate_uploaded_file(
            filename=filename,
            file_bytes_len=len(file_bytes),
            max_size_bytes=max_size_bytes,
            allowed_extensions=allowed_extensions,
        )

        effective_content_type = content_type or self._guess_content_type(safe_filename)

        clean_prefix = re.sub(r"[^a-zA-Z0-9_\-\/]", "_", prefix.strip("/"))
        unique_id = uuid.uuid4().hex[:12]
        file_key_name = f"{unique_id}_{safe_filename}"

        if clean_prefix:
            key = f"{clean_prefix}/{file_key_name}"
        else:
            key = file_key_name

        client = self._get_client()
        try:
            client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_bytes,
                ContentType=effective_content_type,
            )
        except Exception as e:
            # Mask internal credentials / details from error message
            raise RuntimeError(
                f"Failed to persist object to production storage bucket: {type(e).__name__}"
            )

        return StorageResult(
            key=key,
            filename=safe_filename,
            content_type=effective_content_type,
            size=len(file_bytes),
            created_at=datetime.now(timezone.utc),
        )

    def get_stream(self, key: str) -> Tuple[BinaryIO, str, int]:
        client = self._get_client()
        try:
            resp = client.get_object(Bucket=self.bucket_name, Key=key)
            body = resp["Body"]
            data = body.read() if hasattr(body, "read") else bytes(body)
            stream = io.BytesIO(data)
            content_type = resp.get("ContentType") or self._guess_content_type(key)
            size = resp.get("ContentLength") or len(data)
            return stream, content_type, size
        except Exception as e:
            err_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
            if err_code in ("NoSuchKey", "404") or "NoSuchKey" in str(e) or "404" in str(e):
                raise FileNotFoundError(f"Storage object not found: {key}")
            raise FileNotFoundError(f"Storage object not found or inaccessible: {key}")

    def read_bytes(self, key: str) -> bytes:
        stream, _, _ = self.get_stream(key)
        return stream.read()

    def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        if not self.exists(key):
            raise FileNotFoundError(f"Storage object not found: {key}")

        client = self._get_client()
        try:
            url = client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires_in,
            )
            return url
        except Exception as e:
            raise RuntimeError(f"Failed to generate presigned URL: {type(e).__name__}")

    def delete(self, key: str) -> bool:
        if not self.exists(key):
            return False
        client = self._get_client()
        try:
            client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception:
            return False

    def exists(self, key: str) -> bool:
        client = self._get_client()
        try:
            client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception:
            return False


def get_storage_backend() -> StorageBackend:
    """
    Factory dependency returning the active StorageBackend based on application configuration.
    - In development/test environments (default): returns LocalStorageBackend.
    - In production with object storage configured: returns ProductionStorageBackend.
    """
    backend_type = getattr(settings, "STORAGE_BACKEND", "local").lower()

    if backend_type == "local":
        return LocalStorageBackend()
    elif backend_type in ("s3", "r2", "blob"):
        return ProductionStorageBackend(provider=backend_type)
    else:
        raise ValueError(
            f"Unsupported STORAGE_BACKEND: '{backend_type}'. "
            "Supported options are: 'local', 's3', 'r2', 'blob'."
        )
