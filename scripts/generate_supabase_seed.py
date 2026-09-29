#!/usr/bin/env python3
"""Genera el seed SQL revisable desde el fixture temporal de Escobar."""
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FIXTURE=ROOT/"xixova/data/escobar_inventory.json"
OUTPUT=ROOT/"supabase/seed.sql"
ORG="00000000-0000-4000-8000-000000000001"
PROJECT="00000000-0000-4000-8000-000000000002"
BUILDING="00000000-0000-4000-8000-000000000003"
STAMP="2026-09-12T00:00:00Z"
q=lambda value:"null" if value is None else "'"+str(value).replace("'","''")+"'"
floor_id=lambda floor:f"00000000-0000-4000-8{floor:03d}-000000000000"
unit_id=lambda code:f"00000000-0000-4001-8000-{int(code):012d}"
type_id=lambda final,upper:f"00000000-0000-4000-8000-{100+final+(4 if upper else 0):012d}"

def render()->str:
    units=json.loads(FIXTURE.read_text(encoding="utf-8"))
    if len(units)!=72:raise ValueError("El fixture debe contener 72 unidades")
    lines=["-- Generado por scripts/generate_supabase_seed.py. No editar manualmente.","begin;",
      f"insert into public.organizations(id,name,slug,status,created_at,updated_at) values ('{ORG}','Escobar','escobar','active','{STAMP}','{STAMP}') on conflict(id) do update set name=excluded.name,slug=excluded.slug,status=excluded.status,updated_at=excluded.updated_at;",
      f"insert into public.projects(id,organization_id,name,slug,description,status,timezone,north_offset_degrees,theme_config,default_unit_code,published_at,created_at,updated_at) values ('{PROJECT}','{ORG}','Escobar Residences','escobar-residences','Inventário demonstrativo do Escobar Residences.','published','America/Sao_Paulo',0,'{{}}','1203','{STAMP}','{STAMP}','{STAMP}') on conflict(id) do update set name=excluded.name,slug=excluded.slug,status=excluded.status,default_unit_code=excluded.default_unit_code,published_at=excluded.published_at,updated_at=excluded.updated_at;",
      f"insert into public.buildings(id,project_id,name,code,model_path,floor_count,default_camera_config,created_at,updated_at) values ('{BUILDING}','{PROJECT}','Torre A','tower-a','building/xixova-building.glb',18,'{{}}','{STAMP}','{STAMP}') on conflict(id) do update set model_path=excluded.model_path,floor_count=excluded.floor_count,updated_at=excluded.updated_at;",
      "insert into public.floors(id,building_id,number,label,created_at) values"]
    lines.append(",\n".join(f"('{floor_id(floor)}','{BUILDING}',{floor},'Andar {floor}','{STAMP}')" for floor in range(1,19))+" on conflict(id) do update set label=excluded.label;")
    types={}
    for unit in units:
      final=int(unit["code"])%100;upper=unit["floor"]>16;types[(final,upper)]=unit
    lines.append("insert into public.unit_types(id,project_id,name,bedrooms,suites,private_area_m2,total_area_m2,interior_project_id,created_at,updated_at) values")
    type_rows=[]
    for (final,upper),unit in sorted(types.items()):
      name=f"Final {final:02d}"+(" Cobertura" if upper else "")
      type_rows.append(f"('{type_id(final,upper)}','{PROJECT}',{q(name)},{unit['bedrooms']},{unit['suites']},{unit['privateAreaM2']},{unit['totalAreaM2']},{q(unit.get('interiorProjectId'))},'{STAMP}','{STAMP}')")
    lines.append(",\n".join(type_rows)+" on conflict(id) do update set private_area_m2=excluded.private_area_m2,total_area_m2=excluded.total_area_m2,updated_at=excluded.updated_at;")
    lines.append("insert into public.units(id,project_id,building_id,floor_id,unit_type_id,code,status,price_brl,parking_spaces,orientation,view_type,sun_exposure,model_object_id,published,reserved_until,created_at,updated_at) values")
    rows=[]
    for unit in units:
      final=int(unit["code"])%100;sun="morning" if unit["orientation"] in ("east","northeast","southeast") else "afternoon";reserved=STAMP if unit["status"]=="reserved" else None
      rows.append(f"('{unit_id(unit['code'])}','{PROJECT}','{BUILDING}','{floor_id(unit['floor'])}','{type_id(final,unit['floor']>16)}',{q(unit['code'])},{q(unit['status'])},{unit['priceBRL']},{unit['parkingSpaces']},{q(unit['orientation'])},{q(unit['viewType'])},{q(sun)},{q(unit['modelObjectId'])},true,{q(reserved)},'{STAMP}','{STAMP}')")
    lines.append(",\n".join(rows)+" on conflict(id) do update set status=excluded.status,price_brl=excluded.price_brl,published=excluded.published,reserved_until=excluded.reserved_until,updated_at=excluded.updated_at;")
    lines.extend(["commit;",""])
    return "\n".join(lines)

if __name__=="__main__":OUTPUT.write_text(render(),encoding="utf-8")
