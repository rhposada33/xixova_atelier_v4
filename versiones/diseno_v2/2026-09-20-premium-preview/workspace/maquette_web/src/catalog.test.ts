import {describe,expect,it} from "vitest";
import type {CatalogManifest} from "./contracts";
import {selectionFromURL} from "./catalog";

const catalog:CatalogManifest={
  schema:1,
  defaultProject:"garden_house_18",
  projects:[
    {id:"garden_house_18",name:"Garden House",variant:"lujo",floors:[6,8],units:["01","04"],scene:"projects/garden/scene.json",manifest:"",thumbnail:"",bytes:1},
    {id:"terraza_luz",name:"Terraza Luz",variant:"editorial",floors:[8],units:["02"],scene:"projects/terraza/scene.json",manifest:"",thumbnail:"",bytes:1},
  ],
};

describe("selección del catálogo",()=>{
  it("usa los valores predeterminados",()=>{
    const value=selectionFromURL(catalog,"");
    expect(value.project.id).toBe("garden_house_18");
    expect(value).toMatchObject({floor:6,unit:"601"});
  });
  it("restaura una selección compartida",()=>{
    const value=selectionFromURL(catalog,"?maqueta=terraza_luz&piso=8&unidad=802");
    expect(value.project.id).toBe("terraza_luz");
    expect(value).toMatchObject({floor:8,unit:"802"});
  });
  it("ignora un proyecto desconocido",()=>{
    expect(selectionFromURL(catalog,"?maqueta=inexistente").project.id).toBe("garden_house_18");
  });
});
