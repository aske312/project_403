import bcrypt

MAX_BCRYPT_PASSWORD_BYTES = 72


def encode_bcrypt_password(password):
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > MAX_BCRYPT_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_BCRYPT_PASSWORD_BYTES} bytes.")

    return password_bytes


def hash_password(password):
    return bcrypt.hashpw(encode_bcrypt_password(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password, password_hash):
    try:
        password_bytes = encode_bcrypt_password(password)
    except ValueError:
        return False

    return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))
