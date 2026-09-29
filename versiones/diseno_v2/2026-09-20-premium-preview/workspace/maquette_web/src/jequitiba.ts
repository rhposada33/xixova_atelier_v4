import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneData } from './contracts';

/** Original furnishings, in metres and Z-up, aligned to the 12 m plan. */
export function jequitibaInterior(world: THREE.Scene, data: SceneData) {
  const root = new THREE.Group();
  root.name = 'Jequitibá · tropical contemporâneo';
  world.add(root);
  const mat = (color: string, roughness = .65, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const oak = mat('#947253', .53), walnut = mat('#644b39', .56);
  const linen = new THREE.MeshPhysicalMaterial({ color: '#e7dfcf', roughness: .92, sheen: .65, sheenColor: '#fff8e8', sheenRoughness: .86 });
  const white = new THREE.MeshPhysicalMaterial({ color: '#f4f0e7', roughness: .9, sheen: .4, sheenRoughness: .9 });
  const olive = mat('#737760', .94), clay = mat('#a77460', .9);
  const stone = new THREE.MeshPhysicalMaterial({ color: '#d7cbbb', roughness: .34, clearcoat: .18, clearcoatRoughness: .4 });
  const dark = mat('#303d38', .43);
  const brass = mat('#a58b57', .28, .7), black = mat('#242c29', .4, .45);
  const oakJoint = mat('#aa9277', .85);
  const mirror = new THREE.MeshPhysicalMaterial({ color: '#dce3dc', metalness: .95, roughness: .065, clearcoat: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cad9d2', transparent: true, opacity: .16, roughness: .08, metalness: .12, depthWrite: false, side: THREE.DoubleSide });
  const glow = new THREE.MeshStandardMaterial({ color: '#fff1d5', emissive: '#ffd89c', emissiveIntensity: .6 });
  const geometries = new Map<string, THREE.BufferGeometry>();
  const box = (g: THREE.Group, x: number, y: number, z: number, w: number, d: number, h: number, material: THREE.Material, radius = 0) => {
    const key = [w, d, h, radius].join(':');
    let geo = geometries.get(key);
    if (!geo) { geo = radius ? new RoundedBoxGeometry(w, d, h, 2, radius) : new THREE.BoxGeometry(w, d, h); geometries.set(key, geo); }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  const cylinder = (g: THREE.Group, x: number, y: number, z: number, r: number, h: number, material: THREE.Material, bottom = r) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, bottom, h, 24), material);
    mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  const group = (x: number, y: number, angle = 0, id?: string) => {
    const g = new THREE.Group(); g.position.set(x, y, .105); g.rotation.z = angle;
    if (id) { const item = data.elementos.find(i => i.id === id); g.userData = { ...item, id, type: 'objeto' }; }
    root.add(g); return g;
  };
  const rug = (g: THREE.Group, w: number, d: number, material: THREE.Material = linen) => {
    box(g, 0, 0, .018, w, d, .025, material, .035);
    for (const side of [-1, 1]) box(g, 0, side * (d / 2 - .08), .034, w - .12, .015, .004, oak);
  };
  const vase = (g: THREE.Group, x: number, y: number, z: number, s = 1) => {
    cylinder(g, x, y, z + .10 * s, .075 * s, .20 * s, clay, .10 * s);
    cylinder(g, x, y, z + .22 * s, .045 * s, .07 * s, clay);
    for (let i = 0; i < 3; i++) {
      const stem = cylinder(g, x + (i - 1) * .028, y, z + .4 * s, .003, .35 * s, olive);
      stem.rotation.y = (i - 1) * .22;
    }
  };
  const plantMatrices: THREE.Matrix4[][] = [[], [], []];
  const temp = new THREE.Object3D();
  const plant = (x: number, y: number, s = 1) => {
    const g = group(x, y); cylinder(g, 0, 0, .22 * s, .22 * s, .44 * s, stone, .17 * s);
    cylinder(g, 0, 0, .445 * s, .195 * s, .012, walnut);
    for (let j = 0; j < 9; j++) {
      const a = j * 2.399, reach = (.22 + j % 3 * .085) * s, height = (.83 + j % 4 * .2) * s;
      const stem = cylinder(g, Math.cos(a) * reach * .45, Math.sin(a) * reach * .45, height * .5 + .2 * s, .007 * s, height - .25 * s, olive);
      stem.rotation.x += Math.sin(a) * .28; stem.rotation.y = Math.cos(a) * .28;
      temp.position.set(x + Math.cos(a) * reach, y + Math.sin(a) * reach, height + .105);
      temp.scale.set(.14 * s, .36 * s, .025 * s); temp.rotation.set(.3 * Math.sin(a), .35, a);
      temp.updateMatrix(); plantMatrices[j % 3].push(temp.matrix.clone());
    }
  };
  const chair = (parent: THREE.Group, x: number, y: number, angle: number, outdoor = false) => {
    const g = new THREE.Group(); g.position.set(x, y, 0); g.rotation.z = angle; parent.add(g);
    for (const a of [-1, 1]) for (const b of [-1, 1]) box(g, a * .21, b * .21, .23, .035, .035, .46, oak, .009);
    box(g, 0, 0, .47, .52, .52, .105, outdoor ? olive : linen, .045);
    box(g, 0, .24, .74, .53, .07, .45, oak, .03);
    box(g, 0, .20, .75, .46, .06, .30, outdoor ? olive : linen, .028);
  };
  const sofa = (g: THREE.Group, width: number, material: THREE.Material = linen) => {
    box(g, 0, 0, .20, width - .12, .86, .14, walnut, .025);
    box(g, 0, .36, .64, width, .22, .74, material, .08);
    for (const s of [-1, 1]) box(g, s * (width / 2 - .09), -.015, .48, .18, .93, .47, material, .07);
    const n = 3, w = (width - .4) / n;
    for (let i = 0; i < n; i++) {
      box(g, (i - 1) * w, -.06, .42, w - .025, .74, .25, material, .06);
      const cushion = box(g, (i - 1) * w, .19, .77, .42, .15, .43, i === 1 ? clay : olive, .06);
      cushion.rotation.x = -.14; cushion.rotation.y = (i - 1) * .09;
    }
  };

  // The continuous slab also covers circulation between the named room polygons.
  box(root, 6, 5.9, -.035, 12.16, 11.96, .22, stone, .025);
  box(root, 3.75, 6.85, .094, 2.10, 4.90, .02, mat('#e5dfd2', .72));
  // Fine oak board joints and large-format stone joints establish believable scale.
  const joints = new THREE.Group(); root.add(joints);
  for (const [y0, y1, x1] of [[0, 2.95, 10.83], [2.95, 6.1, 10.83], [6.1, 9.31, 10.3]]) {
    for (let y = y0 + .18; y < y1; y += .19) box(joints, (6.3 + x1) / 2, y, .131, x1 - 6.3, .004, .002, oakJoint);
    for (let x = 6.9; x < x1; x += 1.1) for (let y = y0 + .095; y < y1; y += .38) box(joints, x, y, .132, .004, .18, .002, oakJoint);
  }
  for (let x = 1.2; x < 6.3; x += 1.2) box(joints, x, 2.2, .131, .008, 4.4, .003, stone);
  for (let y = 1.2; y < 4.4; y += 1.2) box(joints, 3.15, y, .131, 6.3, .008, .003, stone);

  // Social area: floating upholstery, two stone tables and a six-place dining set.
  const living = group(2.05, 2.0); rug(living, 3.25, 3.25);
  sofa(group(2.05, 3.05, 0, 'sofa_linho'), 2.8);
  const coffee = group(2.1, 1.75);
  cylinder(coffee, -.28, 0, .24, .45, .40, oak); cylinder(coffee, -.28, 0, .465, .59, .07, stone);
  cylinder(coffee, .52, -.25, .18, .26, .29, walnut); cylinder(coffee, .52, -.25, .35, .39, .06, stone);
  box(coffee, -.30, -.12, .52, .30, .22, .035, olive); vase(coffee, -.37, .13, .51, .65);
  const console = group(2.1, .29);
  box(console, 0, 0, .31, 3.25, .42, .42, oak, .03);
  for (let i = 0; i < 28; i++) box(console, -1.48 + i * .11, .218, .32, .014, .013, .32, walnut);
  box(console, 0, -.03, .93, 1.45, .045, .79, black, .02);
  vase(console, 1.12, 0, .53);
  const dining = group(4.8, 2.35, 0, 'mesa_jantar');
  box(dining, 0, 0, .77, 1.12, 2.0, .085, oak, .14);
  for (const y of [-.60, .60]) box(dining, 0, y, .39, .65, .14, .70, walnut, .025);
  for (const side of [-1, 1]) for (const y of [-.64, 0, .64]) chair(dining, side * .88, y, -side * Math.PI / 2);
  vase(dining, 0, 0, .82, 1.0);
  // Ceramic place settings, napkins and slim bronze cutlery give the dining
  // composition a residential scale without introducing external model assets.
  for (const side of [-1, 1]) for (const y of [-.64, 0, .64]) {
    cylinder(dining, side * .34, y, .82, .14, .014, white);
    cylinder(dining, side * .34, y, .832, .10, .01, stone);
    box(dining, side * .34, y, .845, .085, .13, .008, olive, .008);
    box(dining, side * .34, y + .185, .825, .016, .17, .008, brass, .003);
  }
  for (const y of [-.57, .57]) {
    cylinder(dining, 0, y, 2.04, .28, .18, linen, .37);
    cylinder(dining, 0, y, 1.95, .30, .018, glow);
    cylinder(dining, 0, y, 2.4, .009, .6, brass);
  }
  plant(.45, 3.90, 1.15);

  // Kitchen and service cabinetry, stone backsplash, handles and fitted appliances.
  const kitchen = group(.46, 6.18, 0, 'cozinha_marcenaria');
  box(kitchen, 0, 0, .46, .68, 3.14, .86, oak, .018);
  box(kitchen, 0, 0, .92, .73, 3.2, .06, stone, .012);
  box(kitchen, -.26, 0, 1.2, .035, 3.18, .54, stone);
  for (let i = 0; i < 5; i++) {
    box(kitchen, .348, -1.24 + i * .62, .47, .02, .59, .78, i === 0 ? black : oak, .006);
    box(kitchen, .368, -1.24 + i * .62, .72, .023, .23, .015, brass);
  }
  box(kitchen, 0, -.95, .96, .50, .60, .025, black, .025);
  for (const y of [-1.1, -.80]) for (const x of [-.13, .13]) cylinder(kitchen, x, y, .982, .085, .006, dark);
  box(kitchen, 0, .53, .96, .47, .61, .018, dark, .055);
  cylinder(kitchen, -.19, .91, 1.10, .018, .3, brass);
  box(kitchen, -.095, .91, 1.24, .21, .025, .025, brass, .008);
  box(kitchen, -.08, 0, 1.91, .48, 3.15, .64, linen, .02);
  box(kitchen, .18, 0, 1.57, .025, 3.02, .025, glow);
  const island = group(2.15, 6.0);
  box(island, 0, 0, .45, .70, 2.15, .86, dark, .02);
  box(island, 0, 0, .93, .83, 2.28, .08, stone, .025);
  vase(island, 0, .67, .98, .7);
  const service = group(1.25, 8.65);
  box(service, 0, 0, .46, 1.95, .61, .88, linen, .025);
  box(service, 0, 0, .94, 2.03, .67, .06, stone);
  const washer = cylinder(service, -.55, -.32, .47, .23, .025, black);
  washer.rotation.set(0, 0, 0);

  const bed = (x: number, y: number, width: number, id: string, accent: THREE.Material) => {
    const g = group(x, y, 0, id); rug(g, width + .85, 2.65);
    box(g, 0, 0, .23, width + .08, 2.03, .23, oak, .055);
    box(g, 0, .01, .44, width, 2.0, .27, white, .10);
    box(g, 0, .9, .77, width + .18, .16, 1.27, linen, .07);
    box(g, 0, -.17, .60, width + .035, 1.49, .085, linen, .05);
    box(g, 0, -.62, .66, width + .06, .51, .04, accent, .022);
    // Folded duvet edge and fine seams remain legible when zooming into a suite.
    box(g, 0, .37, .655, width - .04, .12, .07, white, .025);
    for (const s of [-1, 1]) box(g, s * (width / 2 - .025), -.18, .643, .012, 1.37, .008, white, .004);
    for (const s of [-1, 1]) {
      const pillow = box(g, s * width * .245, .59, .66, width * .43, .44, .16, white, .075); pillow.rotation.z = s * .06;
      const night = s * (width / 2 + .27);
      box(g, night, .70, .32, .40, .43, .50, oak, .035);
      cylinder(g, night, .7, .72, .025, .27, brass);
      cylinder(g, night, .7, .89, .15, .22, linen, .19);
      cylinder(g, night, .7, .775, .14, .012, glow);
    }
    return g;
  };
  bed(8.55, 1.50, 1.60, 'cama_suite_3', clay);
  bed(8.55, 4.62, 1.60, 'cama_suite_2', olive);
  bed(8.32, 7.79, 1.83, 'cama_principal', olive);
  for (const y of [1.45, 4.55, 7.75]) {
    const wardrobe = group(10.04, y);
    box(wardrobe, 0, 0, .465, .49, 2.12, .93, linen, .015);
    const upperCase = box(wardrobe, 0, 0, 1.615, .49, 2.12, 1.37, linen, .015);
    upperCase.userData.jequitibaWardrobeUpper = true; upperCase.visible = false;
    const cap = box(wardrobe, 0, 0, .928, .49, 2.12, .012, oak);
    cap.userData.jequitibaWardrobeCap = true;
    for (let i = 0; i < 4; i++) {
      box(wardrobe, -.255, -.79 + i * .53, .485, .016, .505, .89, oak, .004);
      const upperDoor = box(wardrobe, -.255, -.79 + i * .53, 1.595, .016, .505, 1.33, oak, .004);
      upperDoor.userData.jequitibaWardrobeUpper = true; upperDoor.visible = false;
      box(wardrobe, -.27, -.66 + i * .53, .72, .022, .015, .30, brass);
    }
  }

  // Continuous terrace: teak seating, planted corners and a transparent guardrail.
  const terrace = group(3.85, 10.6, 0, 'mesa_terraco');
  cylinder(terrace, 0, 0, .39, .22, .72, oak); cylinder(terrace, 0, 0, .78, .70, .075, stone);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; chair(terrace, Math.sin(a) * 1.0, Math.cos(a) * 1.0, -a, true); }
  vase(terrace, 0, 0, .83, .8);
  sofa(group(8.05, 10.85), 2.2, olive);
  const outside = group(8.1, 9.98); cylinder(outside, 0, 0, .25, .43, .06, oak); cylinder(outside, 0, 0, .12, .16, .24, oak);
  plant(.6, 11.1, 1.3); plant(10.9, 10.9, 1.4); plant(10.9, 9.8, .85);
  const rail = group(6, 11.72);
  box(rail, 0, 0, .55, 11.8, .022, 1.05, glass);
  box(rail, 0, 0, 1.10, 11.86, .035, .035, brass);
  for (let i = 0; i < 10; i++) box(rail, -5.9 + i * 1.31, 0, .57, .028, .04, 1.1, brass);
  // A slim track marks the sliding opening without blocking the aerial view.
  const track = group(6, 9.31); box(track, 0, 0, .025, 11.8, .12, .035, brass);

  for (const y of [3.95, 6.05, 8.25]) {
    const bath = group(11.43, y);
    box(bath, .26, .05, .44, .48, 1.05, .67, oak, .015);
    box(bath, .24, .05, .81, .56, 1.1, .055, stone, .01);
    cylinder(bath, .21, .05, .89, .19, .11, white);
    cylinder(bath, .38, .05, .99, .014, .26, brass);
    box(bath, .30, .05, 1.11, .18, .026, .022, brass, .008);
    // Thin bronze-framed mirrors and folded towels complete the wet-room joinery.
    box(bath, .52, .05, 1.48, .025, .77, .83, brass, .045);
    box(bath, .502, .05, 1.48, .012, .73, .79, mirror, .038);
    box(bath, .20, -.31, .86, .26, .22, .06, linen, .02);
    box(bath, .20, -.31, .90, .24, .20, .035, white, .012);
    box(bath, -.28, -.45, .24, .36, .56, .44, white, .15);
    box(bath, -.28, -.22, .48, .35, .16, .45, white, .055);
    box(bath, 0, .78, .83, 1.02, .013, 1.62, glass);
    box(bath, 0, .78, 1.64, 1.03, .022, .022, brass);
  }
  const leafGeometry = new THREE.SphereGeometry(1, 10, 6);
  plantMatrices.forEach((matrices, i) => {
    const leaves = new THREE.InstancedMesh(leafGeometry, mat(['#395543', '#59745a', '#7d8d61'][i], .79), matrices.length);
    matrices.forEach((m, j) => leaves.setMatrixAt(j, m)); leaves.castShadow = leaves.receiveShadow = true; root.add(leaves);
  });
  // Merge repeated cabinet details, board joints and cushions within each selectable
  // object. The furniture keeps its identity while reducing WebGL draw overhead.
  const groups: THREE.Group[] = [];
  root.traverse(node => { if (node instanceof THREE.Group) groups.push(node); });
  for (const g of groups) {
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of g.children) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material) || child.userData.jequitibaWardrobeCap || child.userData.jequitibaWardrobeUpper) continue;
      const bucket = buckets.get(child.material) ?? []; bucket.push(child); buckets.set(child.material, bucket);
    }
    for (const [material, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(mesh => {
        mesh.updateMatrix();
        // Rounded and primitive geometries do not consistently expose UV/index
        // attributes. These authored, texture-free material buckets only need
        // positions and normals, so normalize before merging.
        const source = mesh.geometry.clone();
        const part = source.index ? source.toNonIndexed() : source;
        part.deleteAttribute('uv');
        return part.applyMatrix4(mesh.matrix);
      });
      const merged = mergeGeometries(parts); parts.forEach(part => part.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = mesh.receiveShadow = true;
      meshes.forEach(old => g.remove(old)); g.add(mesh);
    }
  }
  const used = new Set<THREE.BufferGeometry>();
  root.traverse(node => { if (node instanceof THREE.Mesh) used.add(node.geometry); });
  geometries.forEach(geometry => { if (!used.has(geometry)) geometry.dispose(); });
  return root;
}
