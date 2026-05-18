import base64
import hashlib
import unittest

from app.message_cipher import (
    LEGACY_MESSAGE_PREFIX,
    MESSAGE_PREFIX,
    _key_material,
    _xor_bytes,
    decrypt_message_body,
    encrypt_message_body,
)


class MessageCipherTests(unittest.TestCase):
    def test_encrypt_decrypt_round_trip_uses_random_payloads(self):
        text = "\u041f\u0440\u0438\u0432\u0435\u0442, Project 403"

        first = encrypt_message_body(text)
        second = encrypt_message_body(text)

        self.assertTrue(first.startswith(MESSAGE_PREFIX))
        self.assertTrue(second.startswith(MESSAGE_PREFIX))
        self.assertNotEqual(first, second)
        self.assertEqual(decrypt_message_body(first), text)
        self.assertEqual(decrypt_message_body(second), text)

    def test_legacy_v1_payloads_remain_readable(self):
        text = "legacy message"
        raw = text.encode("utf-8")
        salt = hashlib.sha256(raw + _key_material()).digest()[:12]
        encrypted = _xor_bytes(raw, salt)
        payload = base64.urlsafe_b64encode(salt + encrypted).decode("ascii")

        self.assertEqual(decrypt_message_body(f"{LEGACY_MESSAGE_PREFIX}{payload}"), text)

    def test_tampered_v2_payload_is_rejected(self):
        encrypted = encrypt_message_body("secret")
        tampered = encrypted[:-2] + ("AA" if not encrypted.endswith("AA") else "BB")

        self.assertEqual(decrypt_message_body(tampered), "[message unavailable]")


if __name__ == "__main__":
    unittest.main()
