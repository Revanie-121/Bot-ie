import unittest
from app.models import (
    normalize_and_validate_asin,
    build_canonical_amazon_url,
    validate_amazon_music_url,
    CreateDownloadJobRequest,
    JobMetadataPayload,
)
from app.auth import create_jwt_token, verify_jwt_token
from app.services.downloader import validate_output_directory, build_lucidadl_cli_args
from app.services.telegram_bot import parse_telegram_command


class TestSonoraBackend(unittest.TestCase):
    def test_asin_validation_and_normalization(self):
        self.assertEqual(normalize_and_validate_asin("b08x9k2m1p"), "B08X9K2M1P")
        with self.assertRaises(ValueError):
            normalize_and_validate_asin("SHORT")

    def test_canonical_url_builder(self):
        self.assertEqual(
            build_canonical_amazon_url("b08x9k2m1p", "track"),
            "https://music.amazon.com/tracks/B08X9K2M1P",
        )
        self.assertEqual(
            build_canonical_amazon_url("b08x9k2m1p", "album"),
            "https://music.amazon.com/albums/B08X9K2M1P",
        )

    def test_url_validator_preserves_source_url(self):
        src = "https://music.amazon.com/albums/B08ALBUM00?trackAsin=B08TRACK11"
        res = validate_amazon_music_url(src)
        self.assertEqual(res["asin"], "B08TRACK11")
        self.assertEqual(res["entity_type"], "track")
        self.assertEqual(res["canonical_url"], "https://music.amazon.com/tracks/B08TRACK11")
        self.assertEqual(res["source_url"], src)

    def test_output_directory_security(self):
        self.assertEqual(validate_output_directory("/sdcard/Music"), "/sdcard/Music")
        with self.assertRaises(ValueError):
            validate_output_directory("/sdcard/Music/../../etc")
        with self.assertRaises(ValueError):
            validate_output_directory("/root/secret")

    def test_lucidadl_cli_args_no_shell(self):
        args = build_lucidadl_cli_args(
            "/usr/local/bin/lucidadl",
            "track",
            "https://music.amazon.com/tracks/B08X9K2M1P",
            "/sdcard/Music",
            "flac",
        )
        self.assertEqual(
            args,
            [
                "/usr/local/bin/lucidadl",
                "track",
                "https://music.amazon.com/tracks/B08X9K2M1P",
                "--output",
                "/sdcard/Music",
                "--format",
                "flac",
                "--no-tui",
            ],
        )

    def test_jwt_roundtrip(self):
        token = create_jwt_token("operator_01", role="admin", telegram_chat_id="10092")
        payload = verify_jwt_token(token)
        self.assertEqual(payload["sub"], "operator_01")
        self.assertEqual(payload["role"], "admin")

    def test_telegram_command_parser(self):
        dl = parse_telegram_command("/dl https://music.amazon.com/tracks/B08X9K2M1P flac")
        self.assertTrue(dl["valid"])
        self.assertEqual(dl["action"], "download")
        self.assertEqual(dl["asin"], "B08X9K2M1P")


if __name__ == "__main__":
    unittest.main()
