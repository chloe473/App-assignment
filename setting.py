# ==============================================================================
# setting.py
# Authentication, sessions, profiles, privacy, and private quiz statistics.
# Account records are stored as JSON in backend/data for this coursework prototype.
# ==============================================================================

# Import standard-library security/storage helpers and FastAPI request primitives.
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
import time
from pathlib import Path

from fastapi import APIRouter, Cookie, HTTPException, Query, Response, status
from pydantic import BaseModel, Field


# Create the router that owns account and Settings API endpoints.
router = APIRouter()


# Keep persistent account data beside the existing CSV while protecting direct access.
DATA_DIR = Path(__file__).parent / "data"
USERS_FILE = DATA_DIR / "users.json"
SESSION_COOKIE = "noongar_session"
SESSION_TTL_SECONDS = 60 * 30
RESET_TTL_SECONDS = 60 * 15
VERIFICATION_TTL_SECONDS = 60 * 60 * 24
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 60 * 15


# Define defaults copied into each account instead of shared between users.
DEFAULT_SETTINGS = {
    "dailyReminder": False,
    "dailyWordGoal": 10,
    "questionsPerQuiz": 10,
    "dataCollection": True,
    "publicProfile": False,
    "shareStatistics": False,
}


# Define request bodies used by authentication, profile, and settings routes.
class RegisterPayload(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)


class LoginPayload(BaseModel):
    email: str
    password: str


class ForgotPasswordPayload(BaseModel):
    email: str


class ResetPasswordPayload(BaseModel):
    token: str
    password: str = Field(min_length=10, max_length=128)


class VerifyEmailPayload(BaseModel):
    token: str


class ProfilePayload(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=5, max_length=254)


class SettingsPayload(BaseModel):
    dailyReminder: bool = False
    dailyWordGoal: int = Field(default=10, ge=1, le=100)
    questionsPerQuiz: int = Field(default=10, ge=5, le=20)
    dataCollection: bool = True
    publicProfile: bool = False
    shareStatistics: bool = False


class DeleteAccountPayload(BaseModel):
    password: str


# Read the JSON database while recovering safely from a first-run or empty file.
def read_users():
    if not USERS_FILE.exists():
        return {}
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


# Persist users atomically with restrictive permissions where the OS supports them.
def write_users(users):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary_file = USERS_FILE.with_suffix(".tmp")
    temporary_file.write_text(json.dumps(users, indent=2), encoding="utf-8")
    os.replace(temporary_file, USERS_FILE)
    try:
        USERS_FILE.chmod(0o600)
    except OSError:
        pass


# Validate email syntax locally without adding an email-validator dependency.
def validate_email(email):
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return email.lower().strip()


# Validate password strength before hashing so weak credentials never enter storage.
def validate_password(password):
    if len(password) < 10 or not any(char.isdigit() for char in password) or not any(
        not char.isalnum() for char in password
    ):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 10 characters and include a number and special character.",
        )


# Hash passwords with salted scrypt so plaintext credentials are never persisted.
def hash_password(password, salt=None):
    salt_bytes = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt_bytes, n=2**14, r=8, p=1
    )
    return f"scrypt${salt_bytes.hex()}${digest.hex()}"


# Compare submitted passwords against stored hashes without leaking timing information.
def verify_password(password, stored_hash):
    try:
        algorithm, salt_hex, digest_hex = stored_hash.split("$", 2)
        if algorithm != "scrypt":
            return False
        candidate = hash_password(password, bytes.fromhex(salt_hex)).split("$", 2)[2]
        return hmac.compare_digest(candidate, digest_hex)
    except (ValueError, TypeError):
        return False


# Store only a SHA-256 digest of random tokens in the database.
def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# Apply common security headers to authentication and private-data responses.
def secure_headers(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"


# Send verification or reset tokens when SMTP is configured; local development stays token-based.
def send_token_email(recipient, subject, token, purpose):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM", smtp_user)
    if not all((smtp_host, smtp_user, smtp_password, sender)):
        return False
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(f"Your Noongar Vocabulary {purpose} token is:\n\n{token}\n\nThis token expires soon.")
    with smtplib.SMTP_SSL(smtp_host, int(os.getenv("SMTP_PORT", "465"))) as smtp:
        smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)
    return True


# Create an expiring HttpOnly cookie; HTTPS_ONLY=1 enables Secure deployment cookies.
def set_session_cookie(response, token):
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=os.getenv("HTTPS_ONLY", "0") == "1",
        samesite="lax",
    )


# Resolve the authenticated user and refresh inactivity expiry for each protected call.
def current_user(session_token):
    if not session_token:
        raise HTTPException(status_code=401, detail="Please log in first.")
    users = read_users()
    now = int(time.time())
    token_hash = hash_token(session_token)
    for user in users.values():
        session = user.get("session")
        if session and hmac.compare_digest(session.get("tokenHash", ""), token_hash):
            if session.get("expiresAt", 0) < now:
                user.pop("session", None)
                write_users(users)
                raise HTTPException(status_code=401, detail="Your session has expired.")
            session["expiresAt"] = now + SESSION_TTL_SECONDS
            write_users(users)
            if not user.get("emailVerified"):
                raise HTTPException(status_code=403, detail="Please verify your email first.")
            return user, users
    raise HTTPException(status_code=401, detail="Invalid session.")


# Return a safe user representation without hashes, tokens, sessions, or private statistics.
def public_user(user):
    return {
        "name": user["name"],
        "email": user["email"],
        "emailVerified": user.get("emailVerified", False),
        "settings": user.get("settings", DEFAULT_SETTINGS.copy()),
    }


# Register an account and return a development token until an email provider is configured.
@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterPayload, response: Response):
    """Create an account with a strong hashed password and email verification token."""
    validate_password(payload.password)
    email = validate_email(payload.email)
    users = read_users()
    if email in users:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    verification_token = secrets.token_urlsafe(32)
    users[email] = {
        "name": payload.name.strip(),
        "email": email,
        "passwordHash": hash_password(payload.password),
        "emailVerified": False,
        "verificationTokenHash": hash_token(verification_token),
        "verificationExpiresAt": int(time.time()) + VERIFICATION_TTL_SECONDS,
        "settings": DEFAULT_SETTINGS.copy(),
        "proficiency": {},
        "loginFailures": 0,
        "lockedUntil": 0,
    }
    write_users(users)
    send_token_email(email, "Verify your Noongar Vocabulary account", verification_token, "email verification")
    secure_headers(response)
    result = {"message": "Account created. Verify your email before logging in."}
    if os.getenv("APP_ENV", "development") == "development":
        result["developmentVerificationToken"] = verification_token
    return result


# Verify the token sent to the user's email before protected account actions are enabled.
@router.post("/api/auth/verify-email")
def verify_email(payload: VerifyEmailPayload, response: Response):
    """Activate an account using a time-limited email verification token."""
    users = read_users()
    now = int(time.time())
    for user in users.values():
        if hmac.compare_digest(user.get("verificationTokenHash", ""), hash_token(payload.token)) and user.get("verificationExpiresAt", 0) >= now:
            user["emailVerified"] = True
            user.pop("verificationTokenHash", None)
            user.pop("verificationExpiresAt", None)
            write_users(users)
            secure_headers(response)
            return {"message": "Email verified. You can now log in."}
    raise HTTPException(status_code=400, detail="Invalid or expired verification token.")


# Authenticate credentials, enforce lockout protection, and issue an expiring session cookie.
@router.post("/api/auth/login")
def login(payload: LoginPayload, response: Response):
    """Log in with rate-limited credentials and an HttpOnly session token."""
    users = read_users()
    email = validate_email(payload.email)
    user = users.get(email)
    now = int(time.time())
    if user and user.get("lockedUntil", 0) > now:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    if not user or not verify_password(payload.password, user.get("passwordHash", "")):
        if user:
            user["loginFailures"] = user.get("loginFailures", 0) + 1
            if user["loginFailures"] >= MAX_LOGIN_ATTEMPTS:
                user["lockedUntil"] = now + LOCKOUT_SECONDS
            write_users(users)
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.get("emailVerified"):
        raise HTTPException(status_code=403, detail="Please verify your email first.")
    token = secrets.token_urlsafe(32)
    user["session"] = {"tokenHash": hash_token(token), "expiresAt": now + SESSION_TTL_SECONDS}
    user["loginFailures"] = 0
    user["lockedUntil"] = 0
    write_users(users)
    set_session_cookie(response, token)
    secure_headers(response)
    return {"user": public_user(user)}


# Revoke the active session and remove the browser cookie on logout.
@router.post("/api/auth/logout")
def logout(response: Response, noongar_session: str | None = Cookie(default=None)):
    """Clear the authenticated session without deleting the account."""
    if noongar_session:
        users = read_users()
        token_hash = hash_token(noongar_session)
        for user in users.values():
            if user.get("session", {}).get("tokenHash") == token_hash:
                user.pop("session", None)
        write_users(users)
    response.delete_cookie(SESSION_COOKIE)
    secure_headers(response)
    return {"message": "Logged out."}


# Return the current account only after the HttpOnly session has been validated.
@router.get("/api/auth/me")
def me(response: Response, noongar_session: str | None = Cookie(default=None)):
    """Return the authenticated user's safe profile."""
    user, _ = current_user(noongar_session)
    secure_headers(response)
    return {"user": public_user(user)}


# Issue a short-lived reset token without revealing whether an email address exists.
@router.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordPayload, response: Response):
    """Prepare a tokenized password reset; production email delivery belongs here."""
    users = read_users()
    email = validate_email(payload.email)
    dev_token = None
    if email in users:
        token = secrets.token_urlsafe(32)
        users[email]["resetTokenHash"] = hash_token(token)
        users[email]["resetExpiresAt"] = int(time.time()) + RESET_TTL_SECONDS
        write_users(users)
        send_token_email(email, "Reset your Noongar Vocabulary password", token, "password reset")
        dev_token = token
    secure_headers(response)
    result = {"message": "If the account exists, a reset link has been sent."}
    if os.getenv("APP_ENV", "development") == "development" and dev_token:
        result["developmentResetToken"] = dev_token
    return result


# Replace a password only when the submitted reset token is valid and unexpired.
@router.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordPayload, response: Response):
    """Reset a password with a one-time, time-limited token."""
    validate_password(payload.password)
    users = read_users()
    now = int(time.time())
    for user in users.values():
        if hmac.compare_digest(user.get("resetTokenHash", ""), hash_token(payload.token)) and user.get("resetExpiresAt", 0) >= now:
            user["passwordHash"] = hash_password(payload.password)
            user.pop("resetTokenHash", None)
            user.pop("resetExpiresAt", None)
            user.pop("session", None)
            write_users(users)
            secure_headers(response)
            return {"message": "Password reset. Please log in again."}
    raise HTTPException(status_code=400, detail="Invalid or expired reset token.")


# Update the authenticated user's profile without exposing another user's account data.
@router.put("/api/profile")
def update_profile(payload: ProfilePayload, response: Response, noongar_session: str | None = Cookie(default=None)):
    """Update the current user's name and email profile."""
    user, users = current_user(noongar_session)
    new_email = validate_email(payload.email)
    if new_email != user["email"] and new_email in users:
        raise HTTPException(status_code=409, detail="That email is already in use.")
    users.pop(user["email"])
    user["name"] = payload.name.strip()
    user["email"] = new_email
    users[new_email] = user
    write_users(users)
    secure_headers(response)
    return {"user": public_user(user)}


# Read private preferences for the authenticated account.
@router.get("/api/settings")
def get_settings(response: Response, noongar_session: str | None = Cookie(default=None)):
    """Return settings belonging only to the current user."""
    user, _ = current_user(noongar_session)
    secure_headers(response)
    return user.get("settings", DEFAULT_SETTINGS.copy())


# Save validated preferences to the authenticated account.
@router.put("/api/settings")
def update_settings(payload: SettingsPayload, response: Response, noongar_session: str | None = Cookie(default=None)):
    """Update private learning and privacy settings for the current user."""
    user, users = current_user(noongar_session)
    user["settings"] = payload.model_dump()
    write_users(users)
    secure_headers(response)
    return user["settings"]


# Return proficiency only for the authenticated account that owns it.
@router.get("/api/profile/statistics")
def get_user_statistics(response: Response, noongar_session: str | None = Cookie(default=None)):
    """Return private proficiency data from the current user's previous quizzes."""
    user, _ = current_user(noongar_session)
    secure_headers(response)
    return {"proficiency": user.get("proficiency", {})}


# Persist one bounded word score under the authenticated account after a quiz answer.
@router.post("/api/profile/statistics/proficiency")
def update_proficiency(
    noongar: str,
    value: int = Query(ge=0, le=5),
    response: Response = None,
    noongar_session: str | None = Cookie(default=None),
):
    """Persist a clamped proficiency value without trusting a client user id."""
    user, users = current_user(noongar_session)
    user.setdefault("proficiency", {})[noongar] = max(0, min(5, value))
    write_users(users)
    if response:
        secure_headers(response)
    return {"noongar": noongar, "value": user["proficiency"][noongar]}


# Permanently delete the account and all associated profile, session, and proficiency data.
@router.delete("/api/account")
def delete_account(payload: DeleteAccountPayload, response: Response, noongar_session: str | None = Cookie(default=None)):
    """Erase the current account only after password re-authentication."""
    user, users = current_user(noongar_session)
    if not verify_password(payload.password, user.get("passwordHash", "")):
        raise HTTPException(status_code=403, detail="Password confirmation failed.")
    users.pop(user["email"], None)
    write_users(users)
    response.delete_cookie(SESSION_COOKIE)
    secure_headers(response)
    return {"message": "Account and associated data permanently deleted."}


# Provide the privacy policy text required by the account privacy controls.
@router.get("/api/privacy-policy")
def privacy_policy():
    """Describe storage, access, sharing, and deletion rights for this prototype."""
    return {
        "title": "Noongar Vocabulary Privacy Policy",
        "text": "Your account stores your name, email, password hash, settings, sessions, and quiz proficiency. Proficiency is private and accessible only after login. You can disable optional data collection, turn off sharing, request a reset, or permanently delete your account and associated data.",
    }
