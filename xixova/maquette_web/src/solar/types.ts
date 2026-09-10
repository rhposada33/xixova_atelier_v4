export type SolarCalibrationStatus='verified'|'demo_unverified';
export type SolarObstacle={id:string;type:'box'|'cylinder'|'wall';category:'internal_architecture'|'external_structure'|'vegetation';position:[number,number,number];dimensions:[number,number,number];rotationDegrees?:number};
export type ProjectSolarConfig={enabled:boolean;calibrationStatus:SolarCalibrationStatus;location:{latitude:number;longitude:number;timezone:string};building:{northOffsetDegrees:number;groundElevationMeters?:number};unit?:{floorNumber?:number;elevationMeters?:number};exposureThreshold?:number;environment?:{obstacles?:SolarObstacle[]}};
export type SolarPosition={azimuthDegrees:number;elevationDegrees:number;direction:[number,number,number];sunrise:Date;solarNoon:Date;sunset:Date;daylight:boolean};
export type RoomSolarData={id:string;nombre:string;solarSamples:[number,number,number][]};
export type RoomSunlightResult={roomId:string;directSunlight:boolean;exposureRatio:number;illuminatedSamples:number;totalSamples:number};

export function validateSolarConfig(value:unknown):string[]{
 const c=value as ProjectSolarConfig,errors:string[]=[];
 if(!c||typeof c!=='object')return['Configuración solar ausente.'];
 if(typeof c.enabled!=='boolean')errors.push('enabled debe ser booleano.');
 if(!c.location||c.location.latitude < -90||c.location.latitude > 90)errors.push('Latitud fuera de -90° a 90°.');
 if(!c.location||c.location.longitude < -180||c.location.longitude > 180)errors.push('Longitud fuera de -180° a 180°.');
 try{new Intl.DateTimeFormat('es',{timeZone:c.location?.timezone}).format()}catch{errors.push('Zona horaria IANA desconocida.');}
 if(!c.building||!Number.isFinite(c.building.northOffsetDegrees)||c.building.northOffsetDegrees < -360||c.building.northOffsetDegrees > 360)errors.push('Orientación fuera de -360° a 360°.');
 if((c.unit?.elevationMeters??0)<0)errors.push('La elevación de la unidad no puede ser negativa.');
 if((c.exposureThreshold??.2)<=0||(c.exposureThreshold??.2)>1)errors.push('El umbral de exposición debe estar entre 0 y 1.');
 return errors;
}
