#!/usr/bin/env python3
"""Static handoff checks. No live service calls, schema or runtime claims."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
TOKEN_PATTERN = re.compile(r'\b\d{8,12}:[A-Za-z0-9_-]{30,}\b')
REQUIRED_DOCS = (
    '00-execution-contract', '01-vision', '02-design-system',
    '03-storefront-spec', '04-admin-spec', '05-rbac',
    '06-data-model-and-api', '07-prompt-pack', '08-roadmap-stack-qa',
    '09-audit-and-gaps', '10-critical-flows', '11-data-api-security-contract',
    '12-acceptance-and-traceability', '13-handoff-and-master-prompt',
    '14-owner-addendum', '15-wholesale-spec', '16-brand-and-catalog',
    '17-integrations-and-launch', '18-full-scope-and-legacy-map',
    '19-package-verification', '20-final-owner-decisions',
    'decisions', 'backlog',
)
REQUIRED = ['README.md', 'START-HERE.md', 'AGENTS.md', '.env.example',
            'skills/kiya-builder/SKILL.md', 'prompts/BUILD-KIYA.md',
            'config/brand.json', 'config/integrations.json',
            'config/catalog.json', 'config/wholesale-policy.example.json',
            'assets/brand/tokens.css'] + [f'docs/{n}.md' for n in REQUIRED_DOCS]


def validate(root: Path) -> list[str]:
    errors = []
    for folder, count in {'preview home': 5, 'preview panel': 17,
                          'screenshot home': 5, 'screenshot panel': 16}.items():
        ext = '*.html' if folder.startswith('preview') else '*.png'
        found = len(list((root / folder).glob(ext)))
        if found != count:
            errors.append(f'{folder}: expected {count}, got {found}')
    for name in REQUIRED:
        if not (root / name).is_file():
            errors.append(f'Missing: {name}')
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        if path.name.startswith('.env') and path.name != '.env.example':
            errors.append(f'Unsafe environment file: {path.relative_to(root)}')
        if path.suffix not in ('.md', '.html', '.json', '.css', '.example'):
            continue
        text = path.read_text(encoding='utf-8')
        if TOKEN_PATTERN.search(text):
            errors.append(f'Credential-shaped string: {path.relative_to(root)} (value withheld)')
        if path.suffix == '.md':
            text = re.sub(r'```.*?```', '', text, flags=re.S)
            for link in re.findall(r'\]\(([^)]+)\)', text):
                url = urlsplit(link.strip().strip('<>'))
                if url.scheme or url.netloc or not url.path:
                    continue
                target = path.parent / unquote(url.path)
                if not target.exists():
                    errors.append(f'Broken link in {path.relative_to(root)}: {link}')
    configs = {}
    for path in (root / 'config').glob('*.json'):
        try:
            configs[path.stem] = json.loads(path.read_text())
        except (ValueError, OSError) as exc:
            errors.append(f'Invalid JSON: {path.name} ({type(exc).__name__})')
    brand = configs.get('brand', {})
    if brand.get('nameEn') != 'KIYA' or brand.get('siteUrl') != 'https://kiyaco24.ir':
        errors.append('Brand identity mismatch')
    for key, asset in brand.get('assets', {}).items():
        if not (root / asset).is_file():
            errors.append(f'Missing brand asset: {key}')
    policy = configs.get('wholesale-policy.example', {})
    if policy.get('priceVisibility') != 'APPROVED_PARTNER_ONLY':
        errors.append('Wholesale privacy policy mismatch')
    if policy.get('enabled') is not True or policy.get('status') != 'OWNER_CONFIRMED_DEFAULTS':
        errors.append('Wholesale defaults must match owner confirmation')
    if any(type(policy.get(key)) is not int or policy[key] != 1 for key in ('minPacksPerLine', 'minOrderPacks', 'packStep')):
        errors.append('Wholesale minimum must be one pack with step one')
    if policy.get('minOrderAmountToman') != '0' or policy.get('minOrderUnits') is not None:
        errors.append('Wholesale must not impose extra amount or unit minimums')
    if policy.get('publicChannelWholesalePricesAllowed') is not False:
        errors.append('Public channel wholesale price leak policy')
    categories = configs.get('catalog', {}).get('categories', [])
    restricted = next((c for c in categories if c['slug'] == 'vape-pod'), {})
    if restricted.get('status') != 'OUT_OF_BUILD_SCOPE':
        errors.append('Nicotine sales must remain outside build scope')
    clothing = next((c for c in categories if c['slug'] == 'clothing'), {})
    underwear = next((c for c in categories if c['slug'] == 'underwear'), {})
    if clothing.get('status') != 'EXCLUDED' or underwear.get('status') != 'DRAFT_READY':
        errors.append('Catalog must exclude clothing and include underwear')
    services = configs.get('integrations', {}).get('services', [])
    if any(s.get('status') in ('CONNECTED', 'HEALTHY') for s in services):
        errors.append('Static integration config cannot claim live connectivity')
    for name in ('AUTH_SECRET', 'TELEGRAM_BOT_TOKEN', 'SMS_API_KEY',
                 'S3_SECRET_ACCESS_KEY', 'ZARINPAL_MERCHANT_ID', 'META_ACCESS_TOKEN'):
        env = root / '.env.example'
        if env.exists() and not re.search(rf'^{name}=\s*$', env.read_text(), re.M):
            errors.append(f'Env template must have blank {name}')
    return errors


def main() -> int:
    errors = validate(ROOT)
    if errors:
        print('\n'.join(errors))
        return 1
    print('PASS: required documents/skill/prompt/config, 22 HTML previews, 21 screenshots,')
    print('      Markdown file links, brand assets, confirmed/private one-pack wholesale policy,')
    print('      catalog scope flags, placeholder secrets and bot-token pattern check.')
    print('NOT TESTED: browser behavior, Prisma, backend, live integrations, payments, RBAC or production security.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
