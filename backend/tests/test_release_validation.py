import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


class DataValidationTests(unittest.TestCase):
    def invoke(self, content, columns=None, size=None, digest=None, encoding='utf-8-sig'):
        fixture_base = ROOT/'backend/tests/__pycache__/release-fixtures'
        fixture_base.mkdir(parents=True, exist_ok=True)
        folder = pathlib.Path(tempfile.mkdtemp(prefix='gene-data-test-', dir=fixture_base))
        (folder/'sample.csv').write_bytes(content)
        manifest = {'files': {'sample.csv': {
            'size': len(content) if size is None else size,
            'sha256': digest or hashlib.sha256(content).hexdigest(),
            'requiredColumns': columns or ['COSMIC_ID'],
            'encoding': encoding,
        }}}
        (folder/'manifest.json').write_text(json.dumps(manifest))
        return subprocess.run([
            sys.executable, '-B', str(ROOT/'scripts/validate-data.py'),
            '--data-dir', str(folder), '--manifest', str(folder/'manifest.json'),
        ], capture_output=True, text=True)

    def test_valid_data_json(self):
        result = self.invoke(b'COSMIC_ID,value\n1,2\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIsInstance(json.loads(result.stdout), dict)

    def test_gbk_data(self):
        result = self.invoke('COSMIC_ID,value\n1,中文\n'.encode('gbk'), encoding='gbk')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_pointer(self):
        result = self.invoke(b'version https://git-lfs.github.com/spec/v1\n')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('LFS', result.stderr)

    def test_rejects_empty(self):
        result = self.invoke(b'')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('empty', result.stderr)

    def test_rejects_size(self):
        result = self.invoke(b'COSMIC_ID\n1\n', size=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('size', result.stderr)

    def test_rejects_hash(self):
        result = self.invoke(b'COSMIC_ID\n1\n', digest='0'*64)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('sha256', result.stderr)

    def test_rejects_columns(self):
        result = self.invoke(b'wrong\n1\n')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('COSMIC_ID', result.stderr)

    def test_rejects_header_only(self):
        result = self.invoke(b'COSMIC_ID\n')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('row', result.stderr)


class PythonValidationTests(unittest.TestCase):
    def setUp(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('release_python_check', ROOT/'scripts/check-python.py')
        self.checker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.checker)
        folder = ROOT/'backend/tests/__pycache__/release-fixtures'
        folder.mkdir(parents=True, exist_ok=True)
        self.lock = pathlib.Path(tempfile.mkdtemp(prefix='python-lock-', dir=folder))/'test.lock'
        self.lock.write_text('Flask==2.2.5 --hash=sha256:' + '0'*64 + '\n')

    def check_with(self, version='2.2.5', pip_result=None, machine='win-amd64'):
        from unittest.mock import patch
        if pip_result is None:
            pip_result = subprocess.CompletedProcess([], 0, '', '')
        with patch.object(self.checker.platform, 'python_version', return_value='3.11.9'), \
             patch.object(self.checker.sys, 'platform', 'win32'), \
             patch.object(self.checker.struct, 'calcsize', return_value=8), \
             patch('sysconfig.get_platform', return_value=machine), \
             patch.object(self.checker.importlib.metadata, 'version', side_effect=version if isinstance(version, Exception) else None, return_value=version), \
             patch.object(self.checker.subprocess, 'run', return_value=pip_result), \
             patch.object(self.checker.importlib, 'import_module'):
            return self.checker.check(self.lock)

    def test_rejects_windows_arm64(self):
        with self.assertRaisesRegex(ValueError, 'expected Windows x64.*win-arm64'):
            self.check_with(machine='win-arm64')

    def test_offline_wheel_hash_mismatch(self):
        import zipfile
        folder = self.lock.parent
        wheel = folder/'release_test-0.0.1-py3-none-any.whl'
        with zipfile.ZipFile(wheel, 'w') as archive:
            archive.writestr('release_test/__init__.py', '')
            archive.writestr('release_test-0.0.1.dist-info/METADATA',
                             'Metadata-Version: 2.1\nName: release-test\nVersion: 0.0.1\n')
            archive.writestr('release_test-0.0.1.dist-info/WHEEL',
                             'Wheel-Version: 1.0\nGenerator: release-test\nRoot-Is-Purelib: true\nTag: py3-none-any\n')
            archive.writestr('release_test-0.0.1.dist-info/RECORD', '')
        self.lock.write_text('release-test==0.0.1 --hash=sha256:' + '0'*64 + '\n')
        result = subprocess.run([
            sys.executable, '-B', '-m', 'pip', 'install', '--dry-run',
            '--ignore-installed', '--no-index', '--find-links', str(folder),
            '--require-hashes', '--only-binary=:all:', '-r', str(self.lock),
        ], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DO NOT MATCH THE HASHES', result.stderr)
        self.assertIn(hashlib.sha256(wheel.read_bytes()).hexdigest(), result.stderr)

    def test_normal_lock_success(self):
        result = self.check_with()
        self.assertEqual(result, {'pythonVersion': '3.11.9', 'packages': {'Flask': '2.2.5'}})

    def test_missing_package(self):
        missing = self.checker.importlib.metadata.PackageNotFoundError('Flask')
        with self.assertRaisesRegex(ValueError, 'Flask expected 2.2.5, actual missing'):
            self.check_with(version=missing)

    def test_pip_check_failure(self):
        result = subprocess.CompletedProcess([], 1, 'dependency conflict', '')
        with self.assertRaisesRegex(ValueError, 'pip check expected success, actual: dependency conflict'):
            self.check_with(pip_result=result)

    def test_drift_reports_expected_and_actual(self):
        self.lock.write_text('Flask==0.0.0 --hash=sha256:' + '0'*64 + '\n')
        result = subprocess.run([
            sys.executable, '-B', str(ROOT/'scripts/check-python.py'),
            '--lock', str(self.lock),
        ], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('expected', result.stderr)
        self.assertIn('actual', result.stderr)
        self.assertEqual(result.stdout, '')


if __name__ == '__main__':
    unittest.main()
