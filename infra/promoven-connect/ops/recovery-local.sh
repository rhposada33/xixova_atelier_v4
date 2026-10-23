#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")"
run="connect-recovery-$(date +%s)"
backup="artifacts/$run"
mkdir -p "$backup"
start=$SECONDS
docker exec supabase_storage_promoven_connect_local sh -c 'cd /mnt && find . -type f -exec sha256sum {} + | sort' > "$backup/storage-files.sha256"
# Fixed source only. No URL or database target is accepted from callers.
docker exec supabase_db_promoven_connect_local pg_dumpall -U postgres --roles-only --no-role-passwords > "$backup/roles.sql"
docker exec supabase_db_promoven_connect_local pg_dump -U postgres -Fc postgres > "$backup/database.dump"
docker exec supabase_storage_promoven_connect_local tar -C /mnt -cf - . > "$backup/storage.tar"
docker exec supabase_db_promoven_connect_local psql -U postgres -Atc "select bucket_id,name,metadata->>'size' from storage.objects order by bucket_id,name" > "$backup/storage-inventory.txt"
(cd "$backup" && sha256sum roles.sql database.dump storage.tar storage-inventory.txt > SHA256SUMS && sha256sum -c SHA256SUMS)
image=$(docker inspect supabase_db_promoven_connect_local --format '{{.Config.Image}}')
# No published ports; no existing volumes mounted. Only this generated container can be removed.
docker run -d --name "$run" --network none --user postgres --entrypoint bash "$image" -c 'initdb -D /tmp/recovery-db -A trust >/tmp/init.log && pg_ctl -D /tmp/recovery-db -o "-k /tmp -p 55432" -l /tmp/pg.log start && sleep infinity' > /dev/null
trap 'docker rm -f "$run" >/dev/null' EXIT
for i in $(seq 1 40); do if docker exec "$run" pg_isready -h /tmp -p 55432 >/dev/null 2>&1; then break; fi; sleep 1; done
sed '/^CREATE ROLE postgres;$/d; /^ALTER ROLE postgres /d; s/ GRANTED BY [^;]*//g' "$backup/roles.sql" | docker exec -i "$run" psql -h /tmp -p 55432 -U postgres -v ON_ERROR_STOP=1 > "$backup/roles-restore.log"
docker exec -i "$run" pg_restore -h /tmp -p 55432 -U postgres -d postgres --exit-on-error < "$backup/database.dump" > "$backup/restore.log" 2>&1
docker exec "$run" mkdir /tmp/restored-storage
docker exec -i "$run" tar -C /tmp/restored-storage -xf - < "$backup/storage.tar"
docker exec "$run" sh -c 'cd /tmp/restored-storage && find . -type f -exec sha256sum {} + | sort' > "$backup/restored-files.sha256"
diff "$backup/storage-files.sha256" "$backup/restored-files.sha256"
for sql in ../supabase/tests/database/*.sql; do
 docker exec -e PGOPTIONS="-c search_path=public,extensions" -i "$run" psql -h /tmp -p 55432 -U postgres -v ON_ERROR_STOP=1 < "$sql" >> "$backup/rls-tests.log"
done
if grep -q 'not ok' "$backup/rls-tests.log"; then echo 'Restored SQL tests failed'; exit 1; fi
for container in supabase_db_promoven_connect_local "$run"; do
 if [[ "$container" == "$run" ]]; then args=(-h /tmp -p 55432); else args=(); fi
 docker exec "$container" psql "${args[@]}" -U postgres -Atc "select 'projects',count(*) from public.projects union all select 'units',count(*) from public.units union all select 'leads',count(*) from public.leads union all select 'assets',count(*) from storage.objects union all select 'rls',count(*) from pg_class where relrowsecurity" > "$backup/$container-counts.txt"
done
diff "$backup/supabase_db_promoven_connect_local-counts.txt" "$backup/$run-counts.txt"
printf 'restore_seconds=%s\ncontainer=%s\n' "$((SECONDS-start))" "$run" > "$backup/result.txt"
cat "$backup/result.txt"
