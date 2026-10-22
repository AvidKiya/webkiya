"""Regression tests for static package validation, not the future webshop."""
from pathlib import Path
import json
import shutil
import tempfile
import unittest
from validate_package import ROOT, validate


class PackageChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name) / 'file'
        shutil.copytree(ROOT, cls.root, ignore=shutil.ignore_patterns('__pycache__'))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def mutate(self, relative, text, expected):
        path = self.root / relative
        original = path.read_text()
        try:
            path.write_text(text)
            self.assertTrue(any(expected in e for e in validate(self.root)))
        finally:
            path.write_text(original)

    def test_valid_bundle(self):
        self.assertEqual(validate(self.root), [])

    def test_broken_link(self):
        self.mutate('README.md', '[bad](missing.md)', 'Broken link')

    def test_secret_detection_redacts_value(self):
        # Deliberately synthetic, built at runtime; never an actual bot token.
        token = '1234567890' + ':' + 'X' * 35
        path = self.root / 'README.md'
        old = path.read_text()
        try:
            path.write_text(token)
            errors = validate(self.root)
            self.assertTrue(any('Credential-shaped' in e for e in errors))
            self.assertTrue(all(token not in e for e in errors))
        finally:
            path.write_text(old)

    def test_wholesale_privacy(self):
        p = self.root / 'config/wholesale-policy.example.json'
        data = json.loads(p.read_text()); data['publicChannelWholesalePricesAllowed'] = True
        self.mutate(str(p.relative_to(self.root)), json.dumps(data), 'price leak')

    def test_no_fake_integration_health(self):
        p = self.root / 'config/integrations.json'
        data = json.loads(p.read_text()); data['services'][0]['status'] = 'HEALTHY'
        self.mutate(str(p.relative_to(self.root)), json.dumps(data), 'live connectivity')

    def test_missing_asset(self):
        p = self.root / 'config/brand.json'
        data = json.loads(p.read_text()); data['assets']['logoLight'] = 'missing.png'
        self.mutate(str(p.relative_to(self.root)), json.dumps(data), 'Missing brand asset')

    def test_nonempty_secret_placeholder(self):
        p = self.root / '.env.example'
        self.mutate('.env.example', p.read_text().replace('AUTH_SECRET=', 'AUTH_SECRET=do-not-ship'), 'blank AUTH_SECRET')

    def test_one_pack_minimum(self):
        p = self.root / 'config/wholesale-policy.example.json'
        data = json.loads(p.read_text()); data['minPacksPerLine'] = 2
        self.mutate(str(p.relative_to(self.root)), json.dumps(data), 'minimum must be one')

    def test_no_extra_amount_minimum(self):
        p = self.root / 'config/wholesale-policy.example.json'
        data = json.loads(p.read_text()); data['minOrderAmountToman'] = '1000000'
        self.mutate(str(p.relative_to(self.root)), json.dumps(data), 'extra amount')

    def test_final_clothing_scope(self):
        p = self.root / 'config/catalog.json'
        data = json.loads(p.read_text())
        next(c for c in data['categories'] if c['slug'] == 'underwear')['status'] = 'PENDING_OWNER'
        self.mutate(str(p.relative_to(self.root)), json.dumps(data), 'include underwear')

    def test_invalid_config(self):
        self.mutate('config/brand.json', '{broken', 'Invalid JSON')


if __name__ == '__main__':
    unittest.main()
