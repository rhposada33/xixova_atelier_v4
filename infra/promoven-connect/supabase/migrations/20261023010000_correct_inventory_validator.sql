create or replace function private.valid_unit(v jsonb,p_import boolean default false) returns boolean language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(v)<>'object' or not (v ?& array['code','floor','type','bedrooms','bathrooms','parkingSpaces','areaM2','status','published'])
    or exists(select 1 from jsonb_object_keys(v) k where k not in ('code','floor','type','bedrooms','bathrooms','parkingSpaces','areaM2','priceBRL','status','published','expectedVersion','sourceLine'))
    or (not p_import and (v ? 'expectedVersion' or v ? 'sourceLine'))
    or (select count(*) from jsonb_object_keys(v)) > (case when p_import then 12 else 10 end)
    or upper(v->>'code') !~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'
    or char_length(btrim(v->>'type')) not between 1 and 80
    or v->>'status' not in ('available','reserved','sold','unavailable')
    or v->>'published' not in ('true','false')
    or v->>'floor' !~ '^(0|[1-9][0-9]{0,2})$' or (v->>'floor')::integer>500
    or v->>'bedrooms' !~ '^(0|[1-9][0-9]?)$' or (v->>'bedrooms')::integer>30
    or v->>'bathrooms' !~ '^(0|[1-9][0-9]?)$' or (v->>'bathrooms')::integer>30
    or v->>'parkingSpaces' !~ '^(0|[1-9][0-9]?)$' or (v->>'parkingSpaces')::integer>30
    or v->>'areaM2' !~ '^[0-9]{1,9}\.[0-9]{3}$' or (v->>'areaM2')::numeric<=0
    or (v->>'priceBRL' is not null and (v->>'priceBRL' !~ '^[0-9]{1,12}\.[0-9]{2}$' or (v->>'priceBRL')::numeric>999999999999.99))
    or (p_import and (not (v ? 'expectedVersion') or (v->>'expectedVersion' is not null and (v->>'expectedVersion' !~ '^[0-9]{1,10}$' or (v->>'expectedVersion')::bigint>2147483647)))) then return false;
  end if;
  return true;
exception when others then return false;
end; $$;

