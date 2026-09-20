import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import atlasURL from "./assets/garden-material-atlas.png?url";

// A separate, metre-based architectural contract. North is +Y; the entire plate is 18 × 13 m.
const rect = (
  id: string,
  nombre: string,
  x: number,
  y: number,
  w: number,
  h: number,
  covered = true,
) => ({
  id,
  nombre,
  contorno: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ],
  centro: [x + w / 2, y + h / 2, 0.15],
  area_m2: +(w * h).toFixed(2),
  altura: 2.7,
  cubierto: covered,
  solarSamples: [
    [x + w / 2, y + h / 2, 0.8],
    [x + 0.3, y + 0.3, 0.8],
    [x + w - 0.3, y + 0.3, 0.8],
    [x + w - 0.3, y + h - 0.3, 0.8],
  ],
});
const opening = (
  id: string,
  distancia: number,
  ancho = 0.85,
  tipo = "puerta",
) => ({ id, distancia, ancho, tipo, alto: 2.2, antepecho: 0 });
const wall = (
  id: string,
  a: number[],
  b: number[],
  aberturas: any[] = [],
  exterior = false,
) => ({ id, a, b, aberturas, exterior, espesor: 0.17, altura: 2.7 });
export function gardenData(baseSolar: any) {
  const espacios = [
    rect("sala_comedor", "Sala comedor", 4.5, 2.4, 7.5, 3.6),
    rect("cocina", "Cocina gourmet", 0, 2.4, 4.5, 3.6),
    rect("suite_principal", "Suite principal", 12, 4.8, 3.6, 3.8),
    rect("suite_2", "Suite 2", 4, 9.2, 3.8, 3.8),
    rect("suite_3", "Suite 3", 9.5, 9.2, 3.8, 3.8),
    rect("oficina", "Oficina", 4.1, 6, 3.5, 2.1),
    rect("sala_tv", "Sala de TV", 7.6, 6, 4.4, 2.5),
    rect("vestidor", "Vestidor principal", 12, 8.6, 1.8, 2.4),
    rect("bano_principal", "Baño principal", 13.8, 8.6, 1.8, 2.4),
    rect("bano_2", "Baño suite 2", 7.8, 9.2, 1.7, 3.8),
    rect("bano_3", "Baño suite 3", 13.3, 11, 2.3, 2),
    rect("bano_social", "Baño social", 2.3, 6, 1.8, 2.1),
    rect("lavanderia", "Lavandería", 0, 6, 2.3, 2.1),
    rect("despensa", "Despensa", 0, 8.1, 2.3, 1.1),
    rect("vestibulo", "Vestíbulo", 2.3, 8.1, 1.7, 3),
    rect("circulacion", "Circulación", 4, 8.1, 3.6, 1.1),
    rect("pasillo", "Distribuidor privado", 7.6, 8.5, 4.4, 0.7),
    rect("terraza_frente", "Terraza · estar exterior", 0, 0, 12, 2.4, false),
    rect("terraza_gourmet", "Terraza gourmet", 12, 0, 6, 4.8, false),
    rect(
      "terraza_lateral",
      "Terraza · jardín lateral",
      15.6,
      4.8,
      2.4,
      8.2,
      false,
    ),
  ];
  const paredes = [
    wall(
      "sur_cocina",
      [0, 2.4],
      [4.5, 2.4],
      [opening("vidrio_cocina", 0.25, 4, "ventana")],
      true,
    ),
    wall(
      "sur_social",
      [4.5, 2.4],
      [12, 2.4],
      [opening("corredera_social", 0.2, 7.1, "ventana")],
      true,
    ),
    wall(
      "sur_suite",
      [12, 4.8],
      [15.6, 4.8],
      [opening("vidrio_principal", 0.2, 3.2, "ventana")],
      true,
    ),
    wall(
      "este_social",
      [12, 2.4],
      [12, 4.8],
      [opening("salida_terraza", 0.25, 1.9, "ventana")],
      true,
    ),
    wall(
      "este_suite",
      [15.6, 4.8],
      [15.6, 13],
      [
        opening("ventana_lateral", 0.3, 2.8, "ventana"),
        opening("ventana_bano", 5.2, 1.1, "ventana"),
      ],
      true,
    ),
    wall(
      "norte",
      [4, 13],
      [15.6, 13],
      [
        opening("ventana_suite2", 0.25, 3.25, "ventana"),
        opening("ventana_suite3", 5.75, 3.1, "ventana"),
      ],
      true,
    ),
    wall(
      "oeste_cocina",
      [0, 2.4],
      [0, 9.2],
      [opening("acceso_servicio", 5.85, 0.8)],
      true,
    ),
    wall(
      "entrada_oeste",
      [2.3, 9.2],
      [2.3, 11.1],
      [opening("acceso_principal", 0.3, 1)],
      true,
    ),
    wall("entrada_norte", [2.3, 11.1], [4, 11.1], [], true),
    wall("suite2_oeste", [4, 9.2], [4, 13], [], true),
    wall(
      "lavanderia_sur",
      [0, 6],
      [4.1, 6],
      [
        opening("puerta_lavanderia", 0.9, 0.85),
        opening("puerta_social", 2.7, 0.8),
      ],
    ),
    wall(
      "lavanderia_division",
      [2.3, 6],
      [2.3, 9.2],
      [opening("puerta_despensa", 2.35, 0.7)],
    ),
    wall(
      "lavanderia_norte",
      [0, 8.1],
      [2.3, 8.1],
      [opening("paso_despensa", 0.8, 0.8)],
    ),
    wall("despensa_norte", [0, 9.2], [2.3, 9.2], [], true),
    wall("oficina_oeste", [4.1, 6], [4.1, 8.1]),
    wall(
      "oficina_sur",
      [4.1, 6],
      [7.6, 6],
      [opening("puerta_oficina", 0.3, 0.95)],
    ),
    wall("oficina_norte", [4, 8.1], [7.6, 8.1]),
    wall("tv_oeste", [7.6, 6], [7.6, 8.5]),
    wall("tv_sur", [7.6, 6], [12, 6], [opening("puerta_tv", 0.3, 1.1)]),
    wall("tv_norte", [7.6, 8.5], [12, 8.5], [opening("paso_tv", 2.9, 0.9)]),
    wall(
      "principal_oeste",
      [12, 4.8],
      [12, 11],
      [opening("puerta_principal", 3.1, 0.8)],
    ),
    wall(
      "principal_norte",
      [12, 8.6],
      [15.6, 8.6],
      [
        opening("puerta_vestidor", 0.35, 0.8),
        opening("puerta_bano_principal", 2.1, 0.8),
      ],
    ),
    wall("vestidor_bano", [13.8, 8.6], [13.8, 11]),
    wall(
      "vestidor_norte",
      [12, 11],
      [15.6, 11],
      [opening("puerta_bano3", 1.7, 0.75)],
    ),
    wall(
      "suites_sur",
      [4, 9.2],
      [12, 9.2],
      [opening("puerta_suite2", 2.5, 0.85), opening("puerta_suite3", 6, 0.85)],
    ),
    wall(
      "suite2_bano",
      [7.8, 9.2],
      [7.8, 13],
      [opening("puerta_bano2", 0.3, 0.8)],
    ),
    wall("suite3_bano2", [9.5, 9.2], [9.5, 13]),
    wall(
      "suite3_bano3",
      [13.3, 11],
      [13.3, 13],
      [opening("puerta_privada3", 0.2, 0.8)],
    ),
  ];
  return {
    proyecto: "garden_house_18",
    nombre: "Garden House",
    variante: "lujo_contemporaneo",
    configuracion: {},
    espacios,
    paredes,
    aberturas: paredes.flatMap((w) =>
      w.aberturas.map((o) => ({ ...o, pared: w.id })),
    ),
    elementos: [],
    puntos_interes: [],
    activos_glb: false,
    solar: baseSolar
      ? {
          ...baseSolar,
          building: { ...baseSolar.building, northOffsetDegrees: 0 },
          unit: { floorNumber: 8, elevationMeters: 24 },
        }
      : undefined,
  };
}

export function gardenDetails(
  world: THREE.Scene,
  options: { surfaces?: boolean; furniture?: boolean } = {},
) {
  const group = new THREE.Group();
  group.name = "Garden House · 18 × 13 m";
  world.add(group);
  const loader = new THREE.TextureLoader();
  const texture = (url: string, repeat = 1, normal = false) => {
    const t = loader.load(url, () => {
      const r = (window as any).__XIXOVA_MAQUETA__;
      r?.invalidate();
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    if (!normal) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const mat = (color: string, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const atlas = (x: number, y: number) => {
    const t = texture(atlasURL);
    t.repeat.set(0.496, 0.496);
    t.offset.set(x + 0.002, y + 0.002);
    return t;
  };
  const oak = new THREE.MeshStandardMaterial({
    color: "#ffe9bf",
    map: atlas(0, 0.5),
    roughness: 0.38,
  });
  const linen = new THREE.MeshStandardMaterial({
    color: "#fffdf7",
    map: atlas(0.5, 0.5),
    roughness: 0.9,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: "#fff3dd",
    map: atlas(0, 0),
    roughness: 0.32,
  });
  const dark = mat("#35423f", 0.3, 0.42),
    olive = mat("#7b8758"),
    white = mat("#fffdf6", 0.2),
    brass = mat("#c49b43", 0.22, 0.76),
    terra = mat("#bc8d52", 0.72),
    leafA = mat("#355f2d", 0.64),
    leafB = mat("#86a848", 0.68),
    leafC = mat("#234a2e", 0.72),
    rug = linen.clone();
  rug.color.set("#f7ead4");
  rug.map = atlas(0.5, 0);
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    m: THREE.Material,
    r = 0,
  ) => {
    const n = new THREE.Mesh(
      r
        ? new RoundedBoxGeometry(w, d, h, 3, r)
        : new THREE.BoxGeometry(w, d, h),
      m,
    );
    n.position.set(x, y, z);
    n.castShadow = n.receiveShadow = true;
    group.add(n);
    return n;
  };
  const cyl = (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    m: THREE.Material,
  ) => {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 24), m);
    n.rotation.x = Math.PI / 2;
    n.position.set(x, y, z);
    n.castShadow = n.receiveShadow = true;
    group.add(n);
    return n;
  };
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#98d8e6",
    transparent: true,
    opacity: 0.42,
    roughness: 0.04,
    metalness: 0.04,
    transmission: 0.25,
    clearcoat: 0.8,
    clearcoatRoughness: 0.08,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 20),
    new THREE.ShadowMaterial({ color: "#806f55", opacity: 0.18 }),
  );
  shadow.position.set(8.9, 6.15, -0.245);
  shadow.receiveShadow = true;
  group.add(shadow);
  const footprint = new THREE.Shape(
    [
      [0, 0],
      [18, 0],
      [18, 13],
      [4, 13],
      [4, 11.1],
      [2.3, 11.1],
      [2.3, 9.2],
      [0, 9.2],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const slab = new THREE.Mesh(
    new THREE.ExtrudeGeometry(footprint, { depth: 0.26, bevelEnabled: false }),
    stone,
  );
  slab.position.z = -0.25;
  slab.receiveShadow = slab.castShadow = true;
  group.add(slab);
  // Individually laid boards and stone slabs give the material a readable architectural scale.
  for (const r of gardenData(null).espacios) {
    const [a, b, , d] = r.contorno;
    const wet = /bano|lavanderia|despensa|terraza|vestibulo/.test(r.id);
    const dx = wet ? 0.8 : 1.5,
      dy = wet ? 0.8 : 0.19;
    for (let y = a[1]; y < d[1] - 0.01; y += dy)
      for (let x = a[0]; x < b[0] - 0.01; x += dx) {
        const w = Math.min(dx, b[0] - x),
          h = Math.min(dy, d[1] - y);
        box(
          x + w / 2,
          y + h / 2,
          0.13,
          w - 0.003,
          h - 0.003,
          0.025,
          wet ? stone : oak,
        );
      }
  }
  const surfaceNodes = new Set(group.children);
  const cushion = (
    x: number,
    y: number,
    z: number,
    c: THREE.Material,
    rotation = 0,
  ) => {
    const n = box(x, y, z, 0.38, 0.26, 0.14, c, 0.055);
    n.rotation.z = rotation;
    n.rotation.x = 0.08;
    return n;
  };
  const chair = (x: number, y: number, rotation = 0) => {
    const g = new THREE.Group();
    const start = group.children.length;
    box(0, 0, 0.49, 0.55, 0.55, 0.13, linen, 0.055);
    box(0, 0.24, 0.75, 0.57, 0.1, 0.48, linen, 0.06);
    for (const sx of [-0.22, 0.22])
      for (const sy of [-0.2, 0.2]) box(sx, sy, 0.28, 0.035, 0.035, 0.4, oak);
    const parts = group.children.slice(start);
    parts.forEach((n) => g.add(n));
    g.position.set(x, y, 0);
    g.rotation.z = rotation;
    group.add(g);
  };
  const table = (x: number, y: number, w: number, d: number) => {
    box(x, y, 0.82, w, d, 0.09, oak, 0.08);
    for (const sx of [-w * 0.36, w * 0.36])
      for (const sy of [-d * 0.3, d * 0.3])
        box(x + sx, y + sy, 0.45, 0.08, 0.08, 0.72, dark);
    for (let i = 0; i < 3; i++) {
      chair(x - w * 0.34 + i * w * 0.34, y - d / 2 - 0.35, Math.PI);
      chair(x - w * 0.34 + i * w * 0.34, y + d / 2 + 0.35);
    }
    cyl(x, y, 0.92, 0.17, 0.13, stone);
  };
  const sofa = (x: number, y: number, w = 2.7, rotation = 0) => {
    const g = new THREE.Group();
    const start = group.children.length;
    box(0, 0, 0.29, w, 0.92, 0.25, oak, 0.035);
    box(0, 0.39, 0.76, w, 0.19, 0.86, linen, 0.075);
    for (const side of [-1, 1])
      box(side * (w / 2 - 0.08), 0, 0.63, 0.19, 1, 0.57, linen, 0.06);
    for (let i = 0; i < 3; i++) {
      box(
        -w / 3 + (i * w) / 3,
        -0.04,
        0.53,
        w / 3 - 0.08,
        0.77,
        0.25,
        linen,
        0.08,
      );
      const p = box(
        -w / 3 + (i * w) / 3,
        0.22,
        0.87,
        0.45,
        0.18,
        0.4,
        i === 1 ? linen : olive,
        0.06,
      );
      p.rotation.x = 0.18;
      p.rotation.y = (i - 1) * 0.15;
    }
    group.children.slice(start).forEach((n) => g.add(n));
    g.position.set(x, y, 0);
    g.rotation.z = rotation;
    group.add(g);
  };
  const bed = (x: number, y: number, w = 1.8) => {
    box(x, y, 0.18, w + 0.6, 2.8, 0.04, rug);
    box(x, y, 0.37, w, 2.1, 0.38, oak, 0.06);
    box(x, y, 0.63, w, 2.05, 0.25, linen, 0.09);
    box(x, y + 1, 0.82, w + 0.15, 0.13, 1.15, linen, 0.04);
    box(x, y - 0.21, 0.79, w - 0.02, 1.45, 0.12, linen, 0.04);
    box(x, y - 0.62, 0.87, w, 0.55, 0.055, olive, 0.02);
    for (const side of [-1, 1]) {
      box(
        x + side * w * 0.24,
        y + 0.64,
        0.84,
        w * 0.43,
        0.46,
        0.18,
        linen,
        0.07,
      );
      box(
        x + side * (w / 2 + 0.26),
        y + 0.67,
        0.46,
        0.43,
        0.48,
        0.62,
        oak,
        0.025,
      );
      cyl(x + side * (w / 2 + 0.26), y + 0.67, 0.86, 0.12, 0.24, white);
      cyl(x + side * (w / 2 + 0.26), y + 0.67, 1, 0.08, 0.035, brass);
    }
  };
  const wardrobe = (x: number, y: number, w: number, d = 0.48) => {
    box(x, y, 0.66, w, d, 1.1, oak);
    for (let i = 0; i < w / 0.12; i++)
      box(
        x - w / 2 + i * 0.12,
        y - d / 2 - 0.01,
        0.67,
        0.025,
        0.025,
        1.05,
        brass,
      );
    box(x, y, 0.14, w + 0.06, d + 0.03, 0.05, dark);
  };
  const bath = (x: number, y: number, w: number, h: number) => {
    box(x + w / 2, y + h - 0.3, 0.77, w - 0.2, 0.48, 0.2, oak, 0.02);
    box(x + w / 2, y + h - 0.3, 0.91, w - 0.12, 0.56, 0.08, stone, 0.01);
    box(x + w / 2, y + h - 0.3, 0.98, 0.46, 0.34, 0.12, white, 0.07);
    if (w > 2) box(x + w / 2 + 0.5, y + h - 0.3, 0.985, 0.38, 0.3, 0.1, white, 0.07);
    box(x + w / 2, y + h - 0.32, 1.045, 0.3, 0.22, 0.005, dark, 0.035);
    box(x + w / 2, y + h - 0.58, 1.18, w - 0.32, 0.035, 0.34, glass);
    cyl(x + w / 2, y + h - 0.1, 1.08, 0.025, 0.25, brass);
    box(x + 0.42, y + 0.48, 0.41, 0.43, 0.64, 0.48, white, 0.14);
    box(x + 0.42, y + 0.71, 0.62, 0.44, 0.17, 0.6, white, 0.04);
    box(x + w - 0.48, y + 0.52, 0.2, 0.8, 0.9, 0.06, stone);
    box(x + w - 0.88, y + 0.55, 0.73, 0.014, 1.04, 1.05, glass);
    box(x + w - 0.88, y + 1.06, 0.74, 0.025, 0.025, 1.14, dark);
    box(x + w - 0.46, y + 1.02, 0.82, 0.42, 0.032, 1.05, glass);
    cyl(x + w - 0.42, y + 0.52, 0.245, 0.055, 0.01, dark);
  };
  bed(5.9, 11.3, 1.75);
  bed(11.25, 11.4, 1.8);
  bed(13.82, 6.65, 1.85);
  wardrobe(5.85, 9.55, 3);
  wardrobe(11, 9.55, 2.45);
  wardrobe(12.32, 9.85, 0.48, 1.85);
  wardrobe(12.92, 10.68, 1.4);
  wardrobe(5.15, 12.52, 1.35, 0.38);
  wardrobe(10.55, 12.55, 1.45, 0.38);
  wardrobe(14.92, 9.75, 1.05, 0.38);
  bath(7.8, 9.2, 1.7, 3.8);
  bath(13.3, 11, 2.3, 2);
  bath(13.8, 8.6, 1.8, 2.4);
  bath(2.3, 6, 1.8, 2.1);
  box(9.2, 4.2, 0.17, 4.1, 3.1, 0.035, rug);
  sofa(9.3, 4.98, 2.95);
  sofa(8.02, 3.75, 2.2, Math.PI / 2);
  box(9.55, 3.67, 0.54, 1.05, 0.85, 0.16, oak, 0.06);
  chair(10.9, 3.45, -0.4);
  for (const p of [
    [8.6, 5.2, 0.82],
    [9.35, 5.25, 0.86],
    [8.02, 3.35, 0.4],
    [10.05, 4.85, -0.25],
  ])
    cushion(p[0], p[1], 0.91, olive, p[2]);
  cyl(9.55, 3.67, 0.67, 0.15, 0.025, brass);
  table(5.75, 4.15, 1.05, 2.15);
  for (const y of [3.55, 4.75]) for (const x of [5.45, 6.05]) cyl(x, y, 0.96, 0.06, 0.05, brass);
  box(9.85, 7.22, 0.17, 3.2, 1.9, 0.04, rug);
  sofa(10.8, 7.35, 1.8, -Math.PI / 2);
  cyl(9.65, 7.1, 0.55, 0.4, 0.12, oak);
  box(7.82, 7.25, 0.58, 0.25, 1.75, 0.7, oak);
  box(7.85, 7.25, 1.12, 0.07, 1.45, 0.78, dark);
  box(5.8, 7.3, 0.85, 1.9, 0.7, 0.09, oak, 0.04);
  for (const s of [-0.8, 0.8]) box(5.8 + s, 7.3, 0.47, 0.06, 0.6, 0.75, dark);
  chair(5.8, 6.7, Math.PI);
  box(5.8, 7.4, 0.94, 0.48, 0.3, 0.05, dark);
  box(5.8, 7.58, 1.14, 0.5, 0.04, 0.38, dark);
  wardrobe(7.25, 7.15, 0.45, 1.5);
  // Gourmet kitchen with quartz island, integrated hob and four stools.
  box(0.36, 4.2, 0.59, 0.61, 3.2, 0.88, oak);
  box(0.36, 4.2, 1.06, 0.68, 3.25, 0.075, stone);
  box(2, 5.63, 0.59, 3.8, 0.58, 0.88, oak);
  box(2, 5.63, 1.06, 3.8, 0.64, 0.075, stone);
  box(2.5, 4.05, 0.56, 2.4, 1.05, 0.82, oak, 0.025);
  box(2.5, 4.05, 1.03, 2.6, 1.18, 0.11, stone, 0.035);
  box(2.4, 4.05, 1.1, 0.64, 0.58, 0.025, dark);
  for (const x of [2.22, 2.56])
    for (const y of [3.89, 4.19]) cyl(x, y, 1.12, 0.105, 0.01, brass);
  for (let i = 0; i < 4; i++) {
    cyl(1.6 + i * 0.58, 3.12, 0.69, 0.22, 0.085, oak);
    cyl(1.6 + i * 0.58, 3.12, 0.43, 0.027, 0.49, dark);
  }
  box(0.34, 3.2, 1.11, 0.43, 0.6, 0.025, dark, 0.04);
  box(3.85, 5.65, 0.85, 0.58, 0.62, 1.4, dark, 0.03);
  box(0.95, 5.58, 1.16, 0.34, 0.34, 0.025, dark, 0.02);
  box(3.35, 3.55, 0.98, 0.45, 0.32, 0.025, white, 0.03);
  for (const y of [6.55, 7.35]) {
    box(0.55, y, 0.64, 0.72, 0.65, 0.95, white, 0.03);
    const n = cyl(0.93, y, 0.66, 0.24, 0.035, dark);
    n.rotation.y = Math.PI / 2;
  }
  wardrobe(1.7, 8.65, 0.45, 0.78);
  sofa(7.2, 1.42, 2.8);
  chair(5.35, 1.05, 0.8);
  chair(9.05, 1.05, -0.8);
  for (const p of [
    [6.65, 1.55, 0.25],
    [7.35, 1.55, -0.2],
    [7.9, 1.5, 0.15],
  ])
    cushion(p[0], p[1], 0.88, olive, p[2]);
  box(7.2, 1.02, 0.16, 4.3, 1.65, 0.035, rug);
  cyl(7.2, 0.75, 0.52, 0.46, 0.09, oak);
  table(14.8, 2.3, 2.2, 1.05);
  for (const x of [14.15, 14.8, 15.45]) {
    box(x, 2.3, 1.01, 0.18, 0.1, 0.08, leafB, 0.03);
    cyl(x, 2.3, 0.95, 0.1, 0.08, terra);
  }
  box(17.4, 2.4, 0.62, 0.7, 2.3, 0.95, oak);
  box(17.4, 2.4, 1.12, 0.75, 2.35, 0.08, stone);
  box(17.4, 2.9, 1.18, 0.54, 0.8, 0.06, dark);
  for (let i = 0; i < 8; i++)
    box(17.4, 2.58 + i * 0.085, 1.22, 0.5, 0.014, 0.018, brass);
  chair(16.8, 6.4, -Math.PI / 2);
  chair(16.8, 8.1, -Math.PI / 2);
  chair(16.78, 9.65, -Math.PI / 2);
  box(16.85, 7.25, 0.16, 1.12, 2.75, 0.035, rug);
  cyl(16.8, 7.2, 0.57, 0.26, 0.07, stone);
  const furnitureNodes = group.children.filter((node) => !surfaceNodes.has(node));
  furnitureNodes.forEach((node) => (node.userData.gardenFurniture = true));
  // Fine framed glass runs around both terrace edges and through the full-height sliders.
  const rail = (ax: number, ay: number, bx: number, by: number, h = 1) => {
    const len = Math.hypot(bx - ax, by - ay),
      a = Math.atan2(by - ay, bx - ax);
    const pane = box(
      (ax + bx) / 2,
      (ay + by) / 2,
      h / 2 + 0.16,
      len,
      0.018,
      h,
      glass,
    );
    pane.rotation.z = a;
    for (const z of [0.18, h + 0.16]) {
      const n = box((ax + bx) / 2, (ay + by) / 2, z, len, 0.034, 0.035, dark);
      n.rotation.z = a;
    }
    for (let i = 0; i <= Math.ceil(len / 1.2); i++)
      box(
        ax + ((bx - ax) * i) / Math.ceil(len / 1.2),
        ay + ((by - ay) * i) / Math.ceil(len / 1.2),
        h / 2 + 0.16,
        0.035,
        0.035,
        h,
        dark,
      );
  };
  rail(0, 0.08, 17.92, 0.08);
  rail(17.92, 0.08, 17.92, 13);
  rail(15.6, 13, 17.92, 13);
  rail(0.12, 0.08, 0.12, 2.4);
  rail(0.3, 2.4, 11.8, 2.4, 0.8);
  rail(12.2, 4.8, 15.4, 4.8, 0.8);
  rail(15.6, 5.1, 15.6, 8.2, 0.8);
  rail(4.25, 13, 7.5, 13, 0.75);
  rail(9.75, 13, 12.85, 13, 0.75);
  // Open leaves and fine swing arcs make the circulation and both accesses legible.
  const data = gardenData(null);
  for (const w of data.paredes)
    for (const o of w.aberturas) {
      if (o.tipo !== "puerta") continue;
      const a = Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]),
        x = w.a[0] + Math.cos(a) * o.distancia,
        y = w.a[1] + Math.sin(a) * o.distancia;
      const n = box(
        x + (Math.cos(a + 1) * o.ancho) / 2,
        y + (Math.sin(a + 1) * o.ancho) / 2,
        0.66,
        o.ancho,
        0.045,
        1.04,
        oak,
      );
      n.rotation.z = a + 1;
      const pts = [];
      for (let i = 0; i <= 24; i++)
        pts.push(
          new THREE.Vector3(
            x + Math.cos(a + i / 24) * o.ancho,
            y + Math.sin(a + i / 24) * o.ancho,
            0.18,
          ),
        );
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: "#a08d6b" }),
        ),
      );
    }

  // Reuse the locally cached botanical model; each mesh is instanced across the planting plan.
  const spray = (x: number, y: number, s = 0.45) => {
    cyl(x, y, 0.2, s * 0.18, 0.32, terra);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const n = box(
        x + Math.cos(a) * s * 0.17,
        y + Math.sin(a) * s * 0.17,
        0.42 + s * 0.12,
        s * 0.11,
        s * 0.42,
        s * 0.055,
        i % 2 ? leafA : leafB,
        0.05,
      );
      n.rotation.z = a;
      n.rotation.x = 0.45;
    }
  };
  const palm = (x: number, y: number, s = 0.85) => {
    cyl(x, y, 0.28, s * 0.13, 0.55, terra);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      const leaf = box(
        x + Math.cos(a) * s * 0.28,
        y + Math.sin(a) * s * 0.28,
        0.78 + (i % 3) * 0.055,
        s * 0.16,
        s * 0.78,
        s * 0.08,
        i % 3 ? leafA : leafC,
        0.08,
      );
      leaf.rotation.z = a;
      leaf.rotation.x = 0.55;
    }
  };
  const planterRun = (ax: number, ay: number, bx: number, by: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1),
        x = ax + (bx - ax) * t,
        y = ay + (by - ay) * t;
      i % 3 === 0 ? palm(x, y, 0.62 + (i % 2) * 0.16) : spray(x, y, 0.36 + (i % 2) * 0.12);
    }
  };
  for (const p of [
    [0.35, 1.55, 0.52],
    [1.1, 1.7, 0.42],
    [2.1, 1.7, 0.46],
    [3.3, 1.68, 0.4],
    [4.45, 1.62, 0.44],
    [10.6, 1.65, 0.42],
    [11.55, 1.55, 0.48],
    [16.5, 1.05, 0.62],
    [16.95, 3.65, 0.52],
    [16.85, 5.35, 0.5],
    [16.9, 9.2, 0.55],
    [16.9, 11.1, 0.58],
    [15.55, 12.1, 0.48],
    [14.9, 5.2, 0.36],
    [11.65, 5.3, 0.38],
    [10.6, 6.1, 0.32],
    [8.65, 5.7, 0.28],
    [6.9, 7.9, 0.28],
    [5.75, 4.15, 0.22],
    [9.5, 3.7, 0.22],
  ])
    spray(p[0], p[1], p[2]);
  planterRun(0.25, 0.48, 4.65, 0.48, 7);
  planterRun(10.25, 0.5, 12.0, 0.5, 4);
  planterRun(15.95, 4.9, 15.95, 12.3, 8);
  planterRun(16.85, 12.35, 17.6, 12.35, 3);
  for (const p of [
    [0.5, 12.35, 0.95],
    [1.35, 12.45, 0.72],
    [2.35, 12.42, 0.66],
    [16.9, 0.75, 0.78],
    [17.25, 2.95, 0.66],
    [17.18, 5.9, 0.8],
    [17.18, 8.45, 0.7],
    [17.15, 10.95, 0.86],
  ])
    palm(p[0], p[1], p[2]);
  if (options.surfaces === false)
    surfaceNodes.forEach((node) => group.remove(node));
  if (options.furniture === false)
    furnitureNodes.forEach((node) => group.remove(node));
  return group;
}
