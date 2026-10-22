#!/usr/bin/env python3
"""Create a validated, self-contained ZIP; no live credentials or Git history."""
import argparse
import hashlib
from pathlib import Path
import sys
import zipfile
from validate_package import ROOT, validate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.is_relative_to(ROOT):
        parser.error('Output must be outside the input file/ folder')
    errors = validate(ROOT)
    if errors:
        print('\n'.join(errors)); return 1
    files = []
    for p in sorted(ROOT.rglob('*')):
        if not p.is_file() or '__pycache__' in p.parts or p.suffix == '.pyc':
            continue
        if p.is_symlink():
            raise ValueError('Symlinks are not allowed in handoff')
        if p.name.startswith('.env') and p.name != '.env.example':
            raise ValueError('Environment files must not be packaged')
        files.append(p)
    manifest = '\n'.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  KIYA/{p.relative_to(ROOT).as_posix()}' for p in files) + '\n'
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for p in files:
            archive.write(p, f'KIYA/{p.relative_to(ROOT).as_posix()}')
        archive.writestr('SHA256SUMS.txt', manifest)
    with zipfile.ZipFile(output) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError('Archive CRC validation failed')
    print(f'PASS: {len(files)} files + SHA256 manifest; ZIP CRC checked: {output}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
