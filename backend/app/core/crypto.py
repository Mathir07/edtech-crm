import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet
from app.core.config import settings

def _get_fernet() -> Fernet:
    """Derives a deterministic 32-byte urlsafe base64 key from SECRET_KEY."""
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)

def encrypt_secret(plaintext: Optional[str]) -> Optional[str]:
    """Encrypts plaintext string at rest. Returns base64 ciphertext string."""
    if not plaintext:
        return None
    fernet = _get_fernet()
    encrypted = fernet.encrypt(plaintext.encode("utf-8"))
    return encrypted.decode("utf-8")

def decrypt_secret(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypts ciphertext string at rest. Returns original plaintext."""
    if not ciphertext:
        return None
    try:
        fernet = _get_fernet()
        decrypted = fernet.decrypt(ciphertext.encode("utf-8"))
        return decrypted.decode("utf-8")
    except Exception:
        return None
