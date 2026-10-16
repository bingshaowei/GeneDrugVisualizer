"""Read-only release Python environment validation (stdlib only)."""
import argparse
import contextlib
import importlib
import importlib.metadata
import io
import json
from pathlib import Path
import platform
import re
import struct
import subprocess
import sys
import sysconfig

sys.dont_write_bytecode = True


def check(lock):
    errors = []
    actual_python = platform.python_version()
    if actual_python != '3.11.9':
        errors.append(f'Python expected 3.11.9, actual {actual_python}')
    if sys.platform != 'win32' or struct.calcsize('P') != 8 or sysconfig.get_platform() != 'win-amd64':
        errors.append(f'Platform expected Windows x64, actual {sys.platform} {sysconfig.get_platform()} {struct.calcsize("P") * 8}-bit')
    packages = {}
    pins = []
    for line in Path(lock).read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'([A-Za-z0-9_.-]+)==([^ ]+) --hash=sha256:([a-f0-9]{64})', line)
        if not match:
            raise ValueError(f'Invalid lock entry: {line}')
        pins.append(match.groups()[:2])
    if not pins:
        raise ValueError('Lock contains no packages')
    for name, expected in pins:
        try:
            actual = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            actual = 'missing'
        packages[name] = actual
        if actual != expected:
            errors.append(f'{name} expected {expected}, actual {actual}')
    result = subprocess.run([sys.executable, '-B', '-m', 'pip', 'check'], capture_output=True, text=True)
    if result.returncode:
        errors.append('pip check expected success, actual: ' + (result.stderr + result.stdout).strip())
    for module in ('flask', 'pandas'):
        try:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                importlib.import_module(module)
        except Exception as error:
            errors.append(f'{module} import expected success, actual {error}')
    if errors:
        raise ValueError('\n'.join(errors) + '\nUse a fresh checkout to create a clean release environment; existing environment was not modified.')
    return {'pythonVersion': actual_python, 'packages': packages}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lock', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(check(args.lock)))
    except (OSError, ValueError) as error:
        print(f'Python validation failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
