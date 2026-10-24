#!/usr/bin/env python3
"""Local, disposable Connect migration rehearsal. Never resets the source DB.

The platform schema is taken from the installed local Supabase version, without
data or role passwords. Connect is removed ONLY from a networkless disposable
container, then all migrations run transactionally with a checksum journal.
This tests a clean Connect schema, not a fresh remote Supabase installation.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[3]
BASE = ROOT / 'infra/promoven-connect'
SOURCE = 'supabase_db_promoven_connect_local'
NAME = 'connect-migration-check-' + uuid.uuid4().hex[:12]
OUT = BASE / 'staging/.local' / NAME
OUT.mkdir(parents=True, mode=0o700)


def run(args, data=None):
    p = subprocess.run(args, input=data, capture_output=True)
    if p.returncode:
        # Schema/test diagnostics contain synthetic data only; keep them private.
        (OUT / 'failure.log').write_bytes(p.stdout + p.stderr)
        raise RuntimeError('local migration check failed; see private failure.log')
    return p.stdout


def sql(database, query):
    assert NAME.startswith('connect-migration-check-') and database in ('clean', 'incremental', 'postgres')
    return run(['docker', 'exec', '-i', NAME, 'psql', '-X', '-h', '/tmp', '-p', '55432',
                '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'], query.encode()).decode()


files = sorted((BASE / 'supabase/migrations').glob('*.sql'))
assert files and len({f.name[:14] for f in files}) == len(files)
assert all(re.fullmatch(r'\d{14}_[a-z0-9_]+\.sql', f.name) for f in files)
started = time.monotonic()
try:
    image = run(['docker', 'inspect', SOURCE, '--format', '{{.Config.Image}}']).decode().strip()
    roles = run(['docker', 'exec', SOURCE, 'pg_dumpall', '-U', 'postgres', '--roles-only', '--no-role-passwords']).decode()
    roles = '\n'.join(x for x in roles.splitlines() if not re.match(r'(CREATE|ALTER) ROLE postgres\b', x))
    roles = re.sub(r' GRANTED BY [^;]*', '', roles)
    schema = run(['docker', 'exec', SOURCE, 'pg_dump', '-U', 'postgres', '--schema-only', 'postgres'])
    run(['docker', 'run', '-d', '--name', NAME, '--network', 'none', '--user', 'postgres',
         '--entrypoint', 'bash', image, '-c',
         'initdb -D /tmp/check-db -A trust >/tmp/init.log && pg_ctl -D /tmp/check-db -o "-k /tmp -p 55432" -l /tmp/pg.log start && sleep infinity'])
    for _ in range(40):
        if subprocess.run(['docker', 'exec', NAME, 'pg_isready', '-h', '/tmp', '-p', '55432'], capture_output=True).returncode == 0:
            break
        time.sleep(0.5)
    sql('postgres', roles)
    reports = []
    for database in ('clean', 'incremental'):
        sql('postgres', f'create database {database}')
        sql(database, schema.decode())
        # No data, no real credentials, no external services. Platform baseline only.
        sql(database, '''drop schema public cascade; drop schema private cascade;
          drop schema supabase_migrations cascade;
          drop owned by connect_proxy, connect_mail_worker, connect_privacy_worker;
          drop role connect_proxy, connect_mail_worker, connect_privacy_worker;
          create schema public authorization postgres;
          grant usage on schema public to anon, authenticated, service_role;
          create schema rehearsal;
          create table rehearsal.applied(name text primary key, sha256 text not null);
        ''')
        def apply(batch):
            applied = 0
            for file in batch:
                digest = hashlib.sha256(file.read_bytes()).hexdigest()
                existing = sql(database, f"select sha256 from rehearsal.applied where name='{file.name}'").strip()
                if existing:
                    assert existing == digest, 'applied migration changed'
                    continue
                sql(database, 'begin;\n' + file.read_text() +
                    f"\ninsert into rehearsal.applied values('{file.name}','{digest}');\ncommit;")
                applied += 1
            return applied
        if database == 'incremental':
            split = next(i for i, f in enumerate(files) if f.name.startswith('20261023150000'))
            apply(files[:split])
            sql(database, """insert into auth.users(id,aud,role,email) values
              ('00000000-0000-4000-8000-000000000701','authenticated','authenticated','migration-synthetic@example.invalid');
              insert into public.platform_admins(user_id) values('00000000-0000-4000-8000-000000000701');
              begin;
              set local role authenticated;
              set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000701';
              select public.connect_create_organization('Migration synthetic','migration-synthetic');
              commit;""")
            apply(files[split:])
            assert sql(database, "select count(*) from public.organizations where slug='migration-synthetic'").strip() == '1'
        else:
            apply(files)
        assert apply(files) == 0, 'operational rerun must skip applied checksums'
        checks = 0
        for test in sorted((BASE / 'supabase/tests/database').glob('*.sql')):
            result = sql(database, 'set search_path=public,extensions;\n' + test.read_text())
            (OUT / f'{database}-{test.name}.log').write_text(result)
            assert not re.search(r'^not ok|Looks like you failed', result, re.M), test.name
            checks += len(re.findall(r'^ok \d+', result, re.M))
        assert checks >= 341
        reports.append({'database': database, 'migrations': len(files), 'sqlAssertions': checks,
                        'checksumRerunSkipped': len(files), 'syntheticSentinelPreserved': database == 'incremental'})
        sql('postgres', f'drop database {database}')
    evidence = {'status': 'PASS', 'scope': 'local-disposable', 'platformImage': image,
                'baseline': 'installed Supabase schema only; Connect schemas dropped in disposable container',
                'results': reports, 'seconds': round(time.monotonic() - started, 2)}
    (OUT / 'result.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
finally:
    subprocess.run(['docker', 'rm', '-f', NAME], capture_output=True)
