"""Validate release CSVs against the committed Git LFS manifest (stdlib only)."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import sys


def validate(data_dir, manifest):
    files = json.loads(Path(manifest).read_text(encoding='utf-8'))['files']
    if not files:
        raise ValueError('manifest has no files')
    result = {}
    base = Path(data_dir).resolve()
    for name, expected in files.items():
        path = (base / name).resolve()
        if not path.is_relative_to(base):
            raise ValueError(f'{name}: path outside data directory')
        digest = hashlib.sha256()
        size = 0
        with path.open('rb') as stream:
            first = stream.read(1024)
            if first.startswith(b'version https://git-lfs.github.com/spec/v1'):
                raise ValueError(f'{name}: Git LFS pointer; fetch actual data with git lfs pull')
            digest.update(first)
            size += len(first)
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
                size += len(chunk)
        if not size:
            raise ValueError(f'{name}: empty file')
        if size != expected['size']:
            raise ValueError(f"{name}: size expected {expected['size']}, actual {size}")
        if digest.hexdigest() != expected['sha256']:
            raise ValueError(f"{name}: sha256 expected {expected['sha256']}, actual {digest.hexdigest()}")
        with path.open(encoding=expected.get('encoding', 'utf-8-sig'), newline='') as stream:
            rows = csv.reader(stream)
            header = next(rows, [])
            missing = sorted(set(expected['requiredColumns']) - set(header))
            if missing:
                raise ValueError(f'{name}: missing required columns {missing}')
            if not any(any(cell.strip() for cell in row) for row in rows):
                raise ValueError(f'{name}: no data row')
        result[name] = {'size': size, 'sha256': digest.hexdigest()}
    return {'files': result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', required=True)
    parser.add_argument('--manifest', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(validate(args.data_dir, args.manifest)))
    except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
        print(f'Data validation failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
