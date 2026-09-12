import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import "./style.css";
import {
  validateSolarConfig,
  type RoomSunlightResult,
} from "./solar/types";
import { SunlightAnalyzer } from "./solar/analyzer";
import { SolarLightController } from "./solar/light";
import { SolarEngine } from "./solar/engine";
import { useSolarSimulation } from "./solar/state";
import { SolarControls } from "./solar/SolarControls";
import { editorialDetails } from "./editorial";
import { gardenDetails } from "./garden";
import type { CatalogManifest, CatalogProject, SceneData, SceneElement, WallMode } from "./contracts";
import { loadCatalog, loadScene, selectionFromURL, updateSelection } from "./catalog";
import "./atelier.css";
const runtime: { current: any } = { current: null };
const color = (c: string) =>
  c.includes("cama")
    ? "#c9b79e"
    : c.includes("planta")
      ? "#6d8059"
      : c.includes("luz")
        ? "#d5a75f"
        : "#a7825d";
function proxy(item: SceneElement) {
  const [w, d, h] = item.dimensiones,
    g = new THREE.Group(),
    m = new THREE.MeshStandardMaterial({
      color: color(item.categoria),
      roughness: 0.72,
    }),
    add = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      const n = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
      n.position.set(x, y, z);
      n.castShadow = n.receiveShadow = true;
      g.add(n);
    };
  if (item.categoria.toLowerCase().includes("planta")) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.34, w * 0.42, h * 0.42, 18),
      new THREE.MeshStandardMaterial({ color: "#8f6847", roughness: 0.82 }),
    );
    pot.position.z = h * 0.21;
    pot.castShadow = pot.receiveShadow = true;
    g.add(pot);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(
        new THREE.IcosahedronGeometry(w * 0.22, 1),
        m,
      );
      const a = i * 2.4;
      leaf.position.set(
        Math.cos(a) * w * 0.18,
        Math.sin(a) * d * 0.18,
        h * (0.56 + (i % 3) * 0.1),
      );
      leaf.scale.set(0.55, 1, 0.42);
      leaf.rotation.set(0.4, a * 0.2, a);
      leaf.castShadow = true;
      g.add(leaf);
    }
  } else if (item.categoria.includes("asiento")) {
    add(0, 0, h * 0.35, w, d, h * 0.35);
    add(0, d * 0.38, h * 0.7, w, d * 0.18, h * 0.65);
  } else if (item.categoria.includes("mesa")) {
    add(0, 0, h, w, d, 0.08);
    add(0, 0, h * 0.48, w * 0.35, d * 0.35, h * 0.9);
  } else if (item.categoria.includes("cama")) {
    add(0, 0, h * 0.3, w, d, h * 0.45);
    add(0, d * 0.45, h * 0.7, w, 0.1, h);
  } else add(0, 0, h / 2, w, d, h);
  g.position.set(item.posicion[0], item.posicion[1], item.posicion[2]);
  g.rotation.z = (item.rotacion * Math.PI) / 180;
  g.userData = { ...item, type: "objeto" };
  return g;
}
function obstacle(v: any) {
  const geometry =
      v.type === "cylinder"
        ? new THREE.CylinderGeometry(
            v.dimensions[0] / 2,
            v.dimensions[0] / 2,
            v.dimensions[2],
            16,
          )
        : new THREE.BoxGeometry(...v.dimensions),
    material = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
    }),
    mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(v.position[0], v.position[1], v.position[2]);
  if (v.type === "cylinder") mesh.rotation.x = Math.PI / 2;
  mesh.rotation.z = ((v.rotationDegrees || 0) * Math.PI) / 180;
  return mesh;
}
function solarPath(
  engine: SolarEngine,
  date: string,
  center: THREE.Vector3,
  radius: number,
) {
  const group = new THREE.Group(),
    points: THREE.Vector3[] = [];
  for (let m = 0; m < 1440; m += 15) {
    const p = engine.calculate(date, m);
    if (p.daylight)
      points.push(
        center
          .clone()
          .add(new THREE.Vector3(...p.direction).multiplyScalar(radius)),
      );
  }
  if (points.length > 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points),
      line = new THREE.Line(
        geometry,
        new THREE.LineDashedMaterial({
          color: "#c99a3b",
          dashSize: 0.12,
          gapSize: 0.1,
          transparent: true,
          opacity: 0.42,
        }),
      );
    line.computeLineDistances();
    group.add(line);
  }
  const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 20, 12),
      new THREE.MeshBasicMaterial({ color: "#efbd4e" }),
    ),
    halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 20, 12),
      new THREE.MeshBasicMaterial({
        color: "#f3cf76",
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
  marker.userData.currentSun = true;
  marker.add(halo);
  group.add(marker);
  group.userData = {
    date,
    solarPath: true,
    marker,
    radius,
    center: center.clone(),
  };
  return group;
}
function Viewer({
  data,
  selected,
  onSelect,
  wallMode,
  labels,
  solar,
  onExposure,
}: {
  data: SceneData;
  selected: string;
  onSelect: (id: string) => void;
  wallMode: WallMode;
  labels: boolean;
  solar: any;
  onExposure: (v: RoomSunlightResult[]) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    labelsHost = useRef<HTMLDivElement>(null),
    last = useRef(0),
    pending = useRef<number | undefined>(undefined);
  useEffect(() => {
    let disposed = false,
      needsRender = true,
      lastDraw = 0,
      lastMode = "",
      lastLabels = labels;
    const loadTimers: number[] = [];
    const el = host.current!,
      labelRoot = labelsHost.current!,
      world = new THREE.Scene();
    world.background = new THREE.Color(
      data.proyecto === "garden_house_18" ? "#f7f2e8" : "#f2efe6",
    );
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100),
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: false,
      });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.93;
    el.prepend(renderer.domElement);
    const pts = data.espacios.flatMap((r) => r.contorno),
      bounds = new THREE.Box3();
    pts.forEach((p: number[]) =>
      bounds.expandByPoint(new THREE.Vector3(p[0], p[1], 0)),
    );
    const center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3()),
      radius = Math.max(size.x, size.y),
      frustum = radius * (data.proyecto === "garden_house_18" ? 0.47 : 0.59);
    camera.position.set(
      center.x + radius * (data.proyecto === "garden_house_18" ? -0.1 : 0.9),
      center.y - radius * (data.proyecto === "garden_house_18" ? 0.76 : 1.15),
      radius * (data.proyecto === "garden_house_18" ? 2.16 : 1.3),
    );
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(
      center.x,
      center.y,
      data.proyecto === "garden_house_18" ? 0.35 : 0.8,
    );
    controls.enableDamping = true;
    controls.addEventListener("change", () => (needsRender = true));
    controls.minPolarAngle = data.proyecto === "garden_house_18" ? 0.08 : 0.45;
    controls.maxPolarAngle = 1.18;
    controls.minZoom = 0.72;
    controls.maxZoom = 4;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    const ambient = new THREE.HemisphereLight("#fff7e7", "#8d8675", 1.15);
    world.add(ambient);
    world.environmentIntensity = 0.35;
    const editorialSun = editorialDetails(world, data);
    if (data.proyecto === "garden_house_18") {
      gardenDetails(world, { surfaces: false, furniture: true });
      // The textured scene is already lit by the editorial sun and hemisphere.
      // Avoid a synchronous PMREM render during first paint on large plans.
      world.environmentIntensity = 0.55;
      ambient.intensity = 3.35;
      editorialSun.intensity = 3.75;
      editorialSun.position.set(-7, -6, 24);
      editorialSun.target.position.set(9, 6, 0);
      renderer.toneMappingExposure = 1.38;
    }
    const walls: THREE.Mesh[] = [],
      blockers: THREE.Object3D[] = [],
      selectables: THREE.Object3D[] = [],
      objects = new Map<string, THREE.Object3D>(),
      floors = new Map<string, THREE.MeshStandardMaterial>(),
      proceduralArchitecture: THREE.Object3D[] = [];
    data.espacios.forEach((room, i) => {
      const shape = new THREE.Shape(
          room.contorno.map((p: number[]) => new THREE.Vector2(p[0], p[1])),
        ),
        material = new THREE.MeshStandardMaterial({
          color:
            data.proyecto === "garden_house_18"
              ? room.cubierto === false
                ? "#e9dcca"
                : i % 2
                  ? "#ecdabd"
                  : "#f2e4cb"
              : i % 2
                ? "#dccab0"
                : "#eadfca",
          roughness: 0.86,
          emissive: "#d5a138",
          emissiveIntensity: 0,
        }),
        floor = new THREE.Mesh(
          new THREE.ExtrudeGeometry(shape, {
            depth: 0.12,
            bevelEnabled: true,
            bevelSize: 0.025,
            bevelThickness: 0.025,
            bevelSegments: 2,
          }),
          material,
        );
      floor.position.z = -0.02;
      floor.receiveShadow = true;
      floor.userData = { ...room, type: "espacio" };
      world.add(floor);
      proceduralArchitecture.push(floor);
      floors.set(room.id, material);
      selectables.push(floor);
      objects.set(room.id, floor);
      const label = document.createElement("button");
      label.className = "label";
      label.textContent = room.nombre;
      label.dataset.id = room.id;
      label.onclick = () => onSelect(room.id);
      labelRoot.append(label);
    });
    const practicals: THREE.PointLight[] = [];
    (data.luces || []).forEach((x: any) => {
      const lamp = new THREE.PointLight("#ffd2a1", 0, 4.5, 2);
      lamp.position.set(x.posicion[0], x.posicion[1], x.posicion[2]);
      lamp.castShadow = false;
      lamp.visible = false;
      world.add(lamp);
      practicals.push(lamp);
    });
    const proxyRoots = new Map<string, THREE.Object3D>();
    data.paredes.forEach((w) => {
      const dx = w.b[0] - w.a[0],
        dy = w.b[1] - w.a[1],
        len = Math.hypot(dx, dy),
        angle = Math.atan2(dy, dx),
        segments: THREE.Mesh[] = [];
      let cursor = 0;
      const part = (a: number, b: number, bottom: number, top: number) => {
        if (b - a < 0.002 || top - bottom < 0.002) return;
        const along = (a + b) / 2,
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(b - a, w.espesor, top - bottom),
            new THREE.MeshStandardMaterial({
              color:
                data.proyecto === "garden_house_18" ? "#7d8075" : "#eee6da",
              roughness: 0.82,
              emissive:
                data.proyecto === "garden_house_18" ? "#b8a987" : "#8f8271",
              emissiveIntensity:
                data.proyecto === "garden_house_18" ? 0.08 : 0.13,
              transparent: true,
              opacity: 1,
            }),
          );
        mesh.position.set(
          w.a[0] + Math.cos(angle) * along,
          w.a[1] + Math.sin(angle) * along,
          (bottom + top) / 2,
        );
        mesh.rotation.z = angle;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.userData = { ...w, type: "pared" };
        world.add(mesh);
        proceduralArchitecture.push(mesh);
        if (
          data.proyecto === "garden_house_18" &&
          bottom < 0.74 &&
          top > 0.74
        ) {
          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(b - a, w.espesor + 0.055, 0.045),
            new THREE.MeshStandardMaterial({
              color: "#3e4b48",
              roughness: 0.64,
            }),
          );
          cap.position.set(mesh.position.x, mesh.position.y, 0.745);
          cap.rotation.z = angle;
          cap.castShadow = cap.receiveShadow = true;
          cap.userData.gardenWallCap = true;
          world.add(cap);
        }
        walls.push(mesh);
        segments.push(mesh);
        blockers.push(mesh);
        selectables.push(mesh);
      };
      [...w.aberturas]
        .sort((a: any, b: any) => a.distancia - b.distancia)
        .forEach((o: any) => {
          part(cursor, o.distancia, 0, w.altura);
          part(o.distancia, o.distancia + o.ancho, 0, o.antepecho);
          part(
            o.distancia,
            o.distancia + o.ancho,
            o.antepecho + o.alto,
            w.altura,
          );
          cursor = o.distancia + o.ancho;
        });
      part(cursor, len, 0, w.altura);
      if (segments[0]) objects.set(w.id, segments[0]);
    });
    data.elementos.forEach((x) => {
      if (data.proyecto === "garden_house_18") return;
      const n = proxy(x);
      if (
        data.proyecto === "terraza_luz" &&
        ["sofa_social", "cama_suite", "cama_secundaria"].includes(x.id)
      )
        n.visible = false;
      world.add(n);
      selectables.push(n);
      objects.set(x.id, n);
      proxyRoots.set(x.id, n);
    });
    const loadedLevels: THREE.Object3D[] = [];
    if (data.web_assets) {
      const target = data.web_assets!.objetivo,
        order = ["mobile", target].filter(
          (x, i, a) => a.indexOf(x) === i && data.web_assets!.niveles[x],
        ),
        progress = document.createElement("div");
      progress.className = "detail-progress";
      progress.textContent = "Preparando detalles";
      el.append(progress);
      const load = (index: number) => {
        if (disposed) return;
        if (index >= order.length) {
          progress.remove();
          return;
        }
        const level = order[index],
          entry = data.web_assets!.niveles[level];
        Object.assign(new GLTFLoader(), {})
          .setMeshoptDecoder(MeshoptDecoder)
          .load(
            entry.url,
            (g) => {
              if (disposed) {
                g.scene.traverse((n: any) => {
                  n.geometry?.dispose();
                  (Array.isArray(n.material) ? n.material : [n.material])
                    .filter(Boolean)
                    .forEach((m: any) => m.dispose());
                });
                return;
              }
              g.scene.traverse((node: any) => {
                const id = node.userData?.xixova_id,
                  capa = node.userData?.xixova_capa;
                if (
                  data.proyecto === "garden_house_18" &&
                  capa === "MOBILIARIO"
                )
                  node.visible = false;
                if (
                  data.proyecto === "terraza_luz" &&
                  ["cama_suite", "cama_secundaria"].some((x) =>
                    String(id || "").startsWith(x),
                  )
                )
                  node.visible = false;
                if (id && proxyRoots.has(id))
                  proxyRoots.get(id)!.visible = false;
                if (node.isMesh) {
                  node.castShadow = true;
                  node.receiveShadow = true;
                  if (capa === "ARQUITECTURA" || capa === "ENRIQUECIMIENTO") {
                    proceduralArchitecture.forEach((x) => {
                      x.visible = false;
                      x.userData.retired = true;
                    });
                    node.material = Array.isArray(node.material)
                      ? node.material.map((m: any) => m.clone())
                      : node.material.clone();
                    const base = String(id || "").split(":")[0];
                    if (data.paredes.some((w: any) => w.id === base)) {
                      (Array.isArray(node.material)
                        ? node.material
                        : [node.material]
                      ).forEach((m: any) => {
                        m.transparent = true;
                        m.opacity = 1;
                      });
                      walls.push(node);
                      blockers.push(node);
                    }
                    const room = data.espacios.find(
                      (r: any) => id === r.id + ":piso",
                    );
                    if (room) {
                      const mat = Array.isArray(node.material)
                        ? node.material[0]
                        : node.material;
                      floors.set(room.id, mat);
                    }
                  }
                }
              });
              loadedLevels.forEach((x) => {
                x.traverse((n: any) => (n.userData.retired = true));
                world.remove(x);
                x.traverse((n: any) => {
                  n.geometry?.dispose();
                  const ms = Array.isArray(n.material)
                    ? n.material
                    : [n.material];
                  ms.filter(Boolean).forEach((m: any) => {
                    for (const k of [
                      "map",
                      "normalMap",
                      "roughnessMap",
                      "metalnessMap",
                      "aoMap",
                      "emissiveMap",
                    ])
                      m[k]?.dispose();
                    m.dispose();
                  });
                });
              });
              loadedLevels.length = 0;
              loadedLevels.push(g.scene);
              world.add(g.scene);
              needsRender = true;
              renderer.shadowMap.needsUpdate = true;
              el.dataset.sceneReady = "true";
              el.dataset.quality = level;
              progress.textContent =
                index === order.length - 1
                  ? "Detalles completos"
                  : "Vista lista · afinando materiales";
              if (index === 0 && order.length > 1) {
                progress.textContent = "Vista lista";
                loadTimers.push(
                  window.setTimeout(() => progress.remove(), 1200),
                );
                if (runtime.current)
                  runtime.current.upgrade = () => {
                    el.append(progress);
                    progress.textContent = "Preparando materiales HD";
                    load(index + 1);
                    runtime.current.upgrade = null;
                  };
              } else
                loadTimers.push(window.setTimeout(() => load(index + 1), 80));
            },
            (xhr) => {
              if (xhr.total)
                progress.textContent = `Preparando detalles · ${Math.round((xhr.loaded / xhr.total) * 100)}%`;
            },
            () => {
              progress.textContent = `No se pudo cargar ${level}`;
              loadTimers.push(window.setTimeout(() => load(index + 1), 500));
            },
          );
      };
      load(0);
    } else if (data.activos_glb)
      Object.assign(new GLTFLoader(), {})
        .setMeshoptDecoder(MeshoptDecoder)
        .load(
          "./data/assets.glb",
          (g) => world.add(g.scene),
          undefined,
          () => {},
        );
    const cfg =
      data.solar?.enabled && !validateSolarConfig(data.solar).length
        ? data.solar
        : null;
    let light: SolarLightController | undefined,
      analyzer: SunlightAnalyzer | undefined;
    if (cfg) {
      light = new SolarLightController(world, center, radius);
      data.espacios
        .filter((r) => r.cubierto !== false)
        .forEach((room) => {
          const shape = new THREE.Shape(
              room.contorno.map((p: number[]) => new THREE.Vector2(p[0], p[1])),
            ),
            roof = new THREE.Mesh(
              new THREE.ShapeGeometry(shape),
              new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide,
                colorWrite: false,
                depthWrite: false,
              }),
            );
          roof.position.z = room.altura;
          world.add(roof);
          blockers.push(roof);
        });
      for (const v of cfg.environment?.obstacles || []) {
        const n = obstacle(v);
        world.add(n);
        blockers.push(n);
      }
      analyzer = new SunlightAnalyzer(
        data.espacios,
        blockers,
        cfg.exposureThreshold || 0.2,
      );
    } else {
      const sun = new THREE.DirectionalLight("#ffe1ae", 3.3);
      sun.position.set(center.x - 8, center.y - 10, 15);
      sun.castShadow = true;
      world.add(sun);
    }
    const focus = (id?: string) => {
      const n = id ? objects.get(id) : null,
        target = n
          ? new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3())
          : center;
      controls.target.copy(target);
      if (!id)
        controls.target.z = data.proyecto === "garden_house_18" ? 0.35 : 0.8;
      camera.position.set(
        target.x + radius * (data.proyecto === "garden_house_18" ? -0.1 : 0.9),
        target.y - radius * (data.proyecto === "garden_house_18" ? 0.76 : 1.15),
        radius * (data.proyecto === "garden_house_18" ? 2.16 : 1.3),
      );
      if (data.proyecto === "garden_house_18") {
        camera.zoom = id ? 1.34 : 0.96;
        camera.updateProjectionMatrix();
      }
    };
    const rotate45 = () =>
      camera.position
        .sub(controls.target)
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4)
        .add(controls.target);
    const capture = () => {
      const captureRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      captureRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      captureRenderer.setSize(el.clientWidth, el.clientHeight, false);
      captureRenderer.outputColorSpace = renderer.outputColorSpace;
      captureRenderer.toneMapping = renderer.toneMapping;
      captureRenderer.toneMappingExposure = renderer.toneMappingExposure;
      captureRenderer.render(world, camera);
      const a = document.createElement("a");
      a.href = captureRenderer.domElement.toDataURL("image/png");
      a.download = `${data.proyecto}-maqueta.png`;
      a.click();
      captureRenderer.dispose();
    };
    runtime.current = {
      world,
      renderer,
      camera,
      controls,
      light,
      analyzer,
      floors,
      ambient,
      practicals,
      editorialSun,
      path: null,
      invalidate() {
        needsRender = true;
        renderer.shadowMap.needsUpdate = true;
      },
      focus,
      rotate45,
      capture,
      wallMode,
      labels,
      center,
      radius,
      targetBackground: new THREE.Color(
        data.proyecto === "garden_house_18" ? "#f7f2e8" : "#f2efe6",
      ),
      setPath(n: THREE.Group) {
        if (this.path) {
          world.remove(this.path);
          this.path.traverse((x: any) => {
            x.geometry?.dispose();
            x.material?.dispose();
          });
        }
        this.path = n;
        world.add(n);
      },
    };
    (window as any).__XIXOVA_MAQUETA__ = runtime.current;
    const ray = new THREE.Raycaster(),
      mouse = new THREE.Vector2(),
      pointerStart = { x: 0, y: 0 },
      down = (e: PointerEvent) => {
        pointerStart.x = e.clientX;
        pointerStart.y = e.clientY;
      },
      click = (e: PointerEvent) => {
        if (
          Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5
        )
          return;
        const r = renderer.domElement.getBoundingClientRect();
        mouse.set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        );
        ray.setFromCamera(mouse, camera);
        const hit = ray.intersectObjects(selectables, true)[0];
        if (hit) {
          let n: any = hit.object;
          while (n.parent && !n.userData.id) n = n.parent;
          if (n.userData.id) onSelect(n.userData.id);
        }
      };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", click);
    const resize = () => {
      needsRender = true;
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      const a = el.clientWidth / el.clientHeight;
      camera.left = -frustum * a;
      camera.right = frustum * a;
      camera.top = frustum;
      camera.bottom = -frustum;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0;
    const wallRay = new THREE.Raycaster(),
      draw = () => {
        if (disposed) return;
        frame = requestAnimationFrame(draw);
        const r = runtime.current;
        if (!r) return;
        controls.update();
        if (r.wallMode !== lastMode || r.labels !== lastLabels) {
          needsRender = true;
          renderer.shadowMap.needsUpdate = true;
          lastMode = r.wallMode;
          lastLabels = r.labels;
          world.traverse((n) => {
            if (n.userData.gardenWallCap)
              n.visible = r.wallMode === "inteligentes";
          });
        }
        if (!needsRender || performance.now() - lastDraw < 40) return;
        lastDraw = performance.now();
        needsRender = false;
        const direction = controls.target.clone().sub(camera.position),
          distance = direction.length();
        wallRay.set(camera.position, direction.normalize());
        const hidden = new Set(
          wallRay
            .intersectObjects(walls)
            .filter((x) => x.distance < distance)
            .map((x) => x.object),
        );
        walls.forEach((w) => {
          if (w.userData.retired) {
            w.visible = false;
            return;
          }
          let opacity = 1;
          if (r.wallMode === "ocultas") opacity = 0;
          if (r.wallMode === "exteriores")
            opacity = w.userData.exterior ? 1 : 0.08;
          if (r.wallMode === "inteligentes" && hidden.has(w))
            opacity = data.proyecto === "garden_house_18" ? 0.18 : 0.08;
          const m = w.material as THREE.MeshStandardMaterial;
          const facade = String(w.userData.id || w.userData.xixova_id || "");
          if (
            r.wallMode === "inteligentes" &&
            (data.proyecto === "garden_house_18" ||
              facade.includes("fachada_sur") ||
              facade.includes("fachada_este"))
          ) {
            m.clippingPlanes = [
              new THREE.Plane(
                new THREE.Vector3(0, 0, -1),
                data.proyecto === "garden_house_18" ? 0.74 : 0.95,
              ),
            ];
            m.clipShadows = true;
            opacity = 1;
          } else m.clippingPlanes = null;
          m.opacity = opacity;
          w.visible = m.opacity > 0.025;
        });
        (world.background as THREE.Color).copy(r.targetBackground);
        renderer.render(world, camera);
        const sunLabel = el.querySelector(".sun-position-label") as HTMLElement;
        if (sunLabel && r.path?.userData.marker) {
          const sp = r.path.userData.marker
            .getWorldPosition(new THREE.Vector3())
            .project(camera);
          sunLabel.style.transform = `translate(${(sp.x * 0.5 + 0.5) * el.clientWidth}px,${(-sp.y * 0.5 + 0.5) * el.clientHeight}px)`;
          sunLabel.hidden = !r.path.visible;
        }
        data.espacios.forEach((room) => {
          const n = labelRoot.querySelector(
              `[data-id="${room.id}"]`,
            ) as HTMLElement,
            p = new THREE.Vector3(...room.centro).project(camera);
          if (n) {
            n.style.transform = `translate(${(p.x * 0.5 + 0.5) * el.clientWidth}px,${(-p.y * 0.5 + 0.5) * el.clientHeight}px)`;
            n.hidden = !r.labels || p.z > 1;
          }
        });
      };
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      loadTimers.forEach(clearTimeout);
      el.querySelector(".detail-progress")?.remove();
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", click);
      controls.dispose();
      light?.dispose();
      world.traverse((o: any) => {
        o.geometry?.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.filter(Boolean).forEach((material: any) => {
          for (const key of ["map","normalMap","roughnessMap","metalnessMap","aoMap","emissiveMap","alphaMap","lightMap"])
            material[key]?.dispose();
          material.dispose();
        });
      });
      world.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelRoot.replaceChildren();
      runtime.current = null;
    };
  }, [data]);
  useEffect(() => {
    if (runtime.current) {
      runtime.current.wallMode = wallMode;
      runtime.current.labels = labels;
    }
  }, [wallMode, labels]);
  useEffect(() => {
    runtime.current?.focus(selected || undefined);
    document
      .querySelectorAll(".label")
      .forEach((n) =>
        n.classList.toggle(
          "selected",
          (n as HTMLElement).dataset.id === selected,
        ),
      );
  }, [selected]);
  useEffect(() => {
    const r = runtime.current;
    if (!r?.light) return;
    r.invalidate();
    r.editorialSun.visible = !solar;
    if (!solar) {
      if (r.path) r.path.visible = false;
      r.targetBackground.set("#f2efe6");
      r.floors.forEach(
        (m: THREE.MeshStandardMaterial) => (m.emissiveIntensity = 0),
      );
      document
        .querySelectorAll(".label.sun-label")
        .forEach((n: Element) => n.classList.remove("sun-label"));
      onExposure([]);
      return;
    }
    r.light.update(solar.position);
    const twilight = !solar.position.daylight
      ? 1
      : Math.max(0, Math.min(1, (8 - solar.position.elevationDegrees) / 8));
    r.ambient.intensity = solar.position.daylight
      ? data.proyecto === "garden_house_18"
        ? 3.15
        : 2.1
      : 0.48;
    r.worldEnvironmentIntensity = solar.position.daylight ? 1 : 0.22;
    r.world.environmentIntensity =
      data.proyecto === "garden_house_18"
        ? solar.position.daylight
          ? 0.65
          : 0.2
        : r.worldEnvironmentIntensity;
    r.practicals.forEach((x: THREE.PointLight) => {
      x.intensity = twilight * 5.5;
      x.visible = twilight > 0;
    });
    r.renderer.toneMappingExposure = solar.position.daylight
      ? data.proyecto === "garden_house_18"
        ? 1.3
        : 1.08
      : 0.72;
    if (r.path?.userData.date !== solar.date)
      r.setPath(
        solarPath(
          solar.engine,
          solar.date,
          r.center.clone().setZ(0.35),
          r.radius * 0.62,
        ),
      );
    r.path.visible = solar.showPath;
    const marker = r.path.userData.marker as THREE.Mesh;
    marker.position.copy(
      new THREE.Vector3(...solar.position.direction)
        .multiplyScalar(r.path.userData.radius)
        .add(r.path.userData.center),
    );
    r.targetBackground.set(
      !solar.position.daylight
        ? "#cbd4dc"
        : data.proyecto === "garden_house_18"
          ? "#f7f2e8"
          : solar.minutes < 600
            ? "#eee6d6"
            : solar.minutes > 960
              ? "#eadbc9"
              : "#e5ebe8",
    );
    const sl = document.querySelector(".sun-position-label");
    if (sl)
      sl.textContent = `${String(Math.floor(solar.minutes / 60)).padStart(2, "0")}:${String(Math.round(solar.minutes) % 60).padStart(2, "0")} · ${["Norte", "Este", "Sur", "Oeste"][Math.round(solar.position.azimuthDegrees / 90) % 4]}`;
    const run = () => {
        last.current = performance.now();
        const values = r.analyzer.analyze(
          solar.position.direction,
          solar.position.daylight,
        );
        values.forEach((x: RoomSunlightResult) => {
          const m = r.floors.get(x.roomId);
          if (m) m.emissiveIntensity = x.directSunlight ? 0.18 : 0;
          const label = document.querySelector(
            `.label[data-id=\"${x.roomId}\"]`,
          );
          label?.classList.toggle("sun-label", x.directSunlight);
        });
        onExposure(values);
      },
      wait = 250 - (performance.now() - last.current);
    if (wait <= 0 || !solar.playing) run();
    else {
      if (pending.current) clearTimeout(pending.current);
      pending.current = window.setTimeout(run, wait);
    }
  }, [solar?.position, solar?.date, solar?.showPath, solar?.playing]);
  return (
    <div className="viewer" ref={host}>
      <div className="labels" ref={labelsHost} />
      <div className="sun-position-label" hidden />
      {data.solar?.enabled && (
        <div
          className="compass"
          title="Norte verdadero según la orientación configurada"
        >
          <i
            style={{
              transform: `rotate(${data.solar.building.northOffsetDegrees}deg)`,
            }}
          >
            ↑
          </i>
          <b>N</b>
        </div>
      )}
      <div className="floating">
        <button
          aria-label="Vista inicial"
          onClick={() => runtime.current?.focus()}
        >
          ⌂
        </button>
        <button
          aria-label="Girar 45 grados"
          onClick={() => runtime.current?.rotate45()}
        >
          ↻ 45°
        </button>
        <button
          aria-label="Cargar materiales de alta definición"
          title="Materiales HD"
          onClick={() => runtime.current?.upgrade?.()}
        >
          HD
        </button>
        <button
          aria-label="Guardar imagen"
          onClick={() => runtime.current?.capture()}
        >
          ▣
        </button>
      </div>
      <div className="simulation-badge">
        <span>ⓘ</span> Vista simulada
      </div>
      <div className="sun-journey" aria-hidden="true">
        <svg viewBox="0 0 1400 400" preserveAspectRatio="none">
          <path d="M 60 330 Q 700 -180 1340 330" />
        </svg>
        <span className="dawn">
          ☀
          <small>
            Este
            <br />
            Amanecer
          </small>
        </span>
        <span className="dusk">
          ☀
          <small>
            Oeste
            <br />
            Atardecer
          </small>
        </span>
        <span className="sun-now">
          <i />
          15:30 · OESTE
        </span>
      </div>
      <div className="hint">
        Arrastra para rotar · Rueda para acercar · Selecciona para explorar
      </div>
    </div>
  );
}
function MiniPlan({
  data,
  selected,
  onSelect,
}: {
  data: SceneData;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const pts = data.espacios.flatMap((r) => r.contorno),
    xs = pts.map((p: any) => p[0]),
    ys = pts.map((p: any) => p[1]),
    minX = Math.min(...xs),
    minY = Math.min(...ys),
    w = Math.max(...xs) - minX,
    h = Math.max(...ys) - minY;
  return (
    <svg
      className="miniplan"
      viewBox={`${minX - 0.3} ${minY - 0.3} ${w + 0.6} ${h + 0.6}`}
    >
      {data.espacios.map((r) => (
        <polygon
          key={r.id}
          className={selected === r.id ? "active" : ""}
          points={r.contorno.map((p: any) => p.join(",")).join(" ")}
          onClick={() => onSelect(r.id)}
        />
      ))}
    </svg>
  );
}

function App() {
  const [catalog, setCatalog] = useState<CatalogManifest>(),
    [project, setProject] = useState<CatalogProject>(),
    [data, setData] = useState<SceneData>(),
    [floor, setFloor] = useState(8),
    [unit, setUnit] = useState("804"),
    [selected, setSelected] = useState(new URLSearchParams(location.search).get("area") || ""),
    [wallMode, setWallMode] = useState<WallMode>("inteligentes"),
    [labels, setLabels] = useState(false),
    [tour, setTour] = useState(false),
    [menu, setMenu] = useState(false),
    [solarOpen, setSolarOpen] = useState(() =>
      window.matchMedia("(min-width: 761px)").matches,
    ),
    [exposure, setExposure] = useState<RoomSunlightResult[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    loadCatalog().then(value=>{
      const initial=selectionFromURL(value);setCatalog(value);setProject(initial.project);setFloor(initial.floor);setUnit(initial.unit);
      updateSelection({project:initial.project.id,floor:initial.floor,unit:initial.unit,area:selected});
    }).catch((e:Error)=>setError(e.message));
  }, []);
  useEffect(()=>{if(!project)return;setData(undefined);loadScene(project).then(scene=>setData({...scene,solar:scene.solar?{...scene.solar,unit:{floorNumber:floor,elevationMeters:floor*3}}:undefined})).catch((e:Error)=>setError(e.message))},[project,floor]);
  useEffect(()=>{
    if(project)updateSelection({project:project.id,floor,unit,area:selected});
  },[project,floor,unit,selected]);
  const choose = (id: string) => {
    setSelected(id);
    updateSelection({project:project?.id,floor,unit,area:id});
  };
  const switchProject = (id: string) => {
    const next=catalog?.projects.find(item=>item.id===id);if(!next)return;
    const nextFloor=next.floors[0],nextUnit=`${nextFloor}${next.units[0]}`;
    setProject(next);setFloor(nextFloor);setUnit(nextUnit);
    choose("");
    setExposure([]);
    updateSelection({project:id,floor:nextFloor,unit:nextUnit,area:""});
  };
  useEffect(() => {
    if (!data || !tour) return;
    let i = Math.max(
      0,
      data.espacios.findIndex((x) => x.id === selected),
    );
    const t = setInterval(() => {
      i = (i + 1) % data.espacios.length;
      choose(data.espacios[i].id);
    }, 3200);
    return () => clearInterval(t);
  }, [data, tour]);
  if (!data || !catalog || !project)
    return (
      <main className="loading">
        <b>XV</b>
        <span>{error || "Preparando tu próximo hogar…"}</span>
        {error && <button onClick={() => location.reload()}>Reintentar</button>}
      </main>
    );
  return (
    <Ready
      key={project.id}
      data={data}
      project={project.id}
      projects={catalog.projects}
      switchProject={switchProject}
      floor={floor}
      setFloor={(v: number) => {
        const nextUnit=v+project.units[0];setFloor(v);setUnit(nextUnit);updateSelection({floor:v,unit:nextUnit});
      }}
      unit={unit}
      setUnit={(value:string)=>{setUnit(value);updateSelection({unit:value})}}
      selected={selected}
      choose={choose}
      wallMode={wallMode}
      setWallMode={setWallMode}
      labels={labels}
      setLabels={setLabels}
      tour={tour}
      setTour={setTour}
      menu={menu}
      setMenu={setMenu}
      solarOpen={solarOpen}
      setSolarOpen={setSolarOpen}
      exposure={exposure}
      setExposure={setExposure}
    />
  );
}
function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7" />
      </>
    ),
    sofa: (
      <>
        <path d="M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M4 18v3m16-3v3M4 12a2 2 0 0 0-2 2v4h20v-4a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-2-2Z" />
      </>
    ),
    bed: (
      <>
        <path d="M3 18v3m18-3v3M3 18h18v-7H3Zm2-7V5h14v6M6 8h4m4 0h4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    plant: (
      <>
        <path d="m7 16 1 6h8l1-6H7Zm5 0V8m0 4C3 12 3 4 3 4s8 0 9 8Zm0-3c0-7 8-7 8-7s0 7-8 7Z" />
      </>
    ),
    bath: (
      <>
        <path d="M3 12h18l-2 7H5Zm3 7v3m12-3v3M5 12V5a3 3 0 0 1 6 0" />
      </>
    ),
    kitchen: (
      <>
        <path d="M8 12a4 4 0 0 1-3-7 4 4 0 0 1 7-2 4 4 0 0 1 7 2 4 4 0 0 1-3 7v7H8Zm0 4h8" />
      </>
    ),
    office: (
      <>
        <path d="M8 3h8v10H8ZM5 8v8h14V8M12 16v5m-5 0h10" />
      </>
    ),
    measure: (
      <>
        <path d="m3 17 14-14 4 4L7 21Zm10-10 3 3m-6 0 3 3m-6 0 3 3" />
      </>
    ),
    pin: (
      <>
        <path d="M19 9c0 6-7 13-7 13S5 15 5 9a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="9" r="2" />
      </>
    ),
    heart: <path d="M12 21 3 12C-2 4 7 0 12 6c5-6 14-2 9 6Z" />,
    layers: (
      <>
        <path d="m2 8 10-6 10 6-10 6Zm0 5 10 6 10-6M2 18l10 6 10-6" />
      </>
    ),
  };
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.home}
    </svg>
  );
}
function Ready(p: any) {
  const d = p.data,
    activeProject = (p.projects as CatalogProject[]).find(item=>item.id===p.project)!,
    valid = d.solar?.enabled && !validateSolarConfig(d.solar).length,
    solar = valid ? useSolarSimulation(d.solar) : null;
  const [favorite, setFavorite] = useState(false),
    [notice, setNotice] = useState(""),
    [measure, setMeasure] = useState(false),
    [furnished, setFurnished] = useState(true),
    [proposal, setProposal] = useState(false);
  const item = useMemo(
    () => d.espacios.find((x: any) => x.id === p.selected),
    [d, p.selected],
  );
  useEffect(() => {
    if (solar) {
      solar.setMinutes(930);
      solar.setShowPath(false);
    }
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(t);
  }, [notice]);
  const roomIcon = (id: string) =>
    /suite/.test(id)
      ? "bed"
      : /bano/.test(id)
        ? "bath"
        : /cocina|despensa/.test(id)
          ? "kitchen"
          : /terraza/.test(id)
            ? "plant"
            : /oficina/.test(id)
              ? "office"
              : /sala/.test(id)
                ? "sofa"
                : "home";
  const furniture = () => {
    const r = runtime.current;
    if (!r) return;
    r.world.traverse((n: any) => {
      if (
        n.userData.gardenFurniture ||
        n.userData.type === "objeto" ||
        n.userData.xixova_capa === "MOBILIARIO"
      )
        n.visible = !furnished;
    });
    setFurnished(!furnished);
    r.invalidate();
  };
  return (
    <main
      className={[
        "atelier",
        p.solarOpen ? "solar-active" : "",
        p.menu ? "menu-active" : "",
        p.selected ? "selection-active" : "",
      ].join(" ")}
    >
      <header>
        <div className="brand">
          <b>XV</b>
          <span>
            <strong>XIXOVÁ</strong>
            <small>MAQUETA INTERACTIVA</small>
          </span>
        </div>
        <div className="title">
          <strong>{d.nombre.toUpperCase()}</strong>
          <small>Lujo contemporáneo</small>
        </div>
        <div className="project-selectors">
          <label>
            <span>Maqueta</span>
            <select
              aria-label="Seleccionar maqueta"
              value={p.project}
              onChange={(e) => p.switchProject(e.target.value)}
            >
              {(p.projects as CatalogProject[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Piso</span>
            <select
              aria-label="Seleccionar piso"
              value={p.floor}
              onChange={(e) => p.setFloor(+e.target.value)}
            >
              {activeProject.floors.map((n) => (
                <option key={n} value={n}>
                  Piso {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Unidad</span>
            <select
              aria-label="Seleccionar unidad"
              value={p.unit}
              onChange={(e) => {
                p.setUnit(e.target.value);
                setNotice("Unidad " + e.target.value + " · misma tipología");
              }}
            >
              {activeProject.units.map((n) => (
                <option key={n} value={p.floor + n}>
                  Unidad {p.floor + n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="header-actions">
          <button
            aria-label="Guardar favorito"
            className={favorite ? "is-favorite" : ""}
            onClick={() => setFavorite(!favorite)}
          >
            <Icon name="heart" />
            <span>{favorite ? "Guardado" : "Favoritos"}</span>
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(location.href);
                setNotice("Enlace copiado");
              } catch {
                setNotice(location.href);
              }
            }}
          >
            <Icon name="pin" />
            <span>Compartir</span>
          </button>
          <button className="gold" onClick={() => setProposal(true)}>
            Solicitar propuesta
          </button>
        </div>
        <button
          className="mobilemenu"
          onClick={() => p.setMenu(!p.menu)}
          aria-label="Explorar ambientes"
        >
          ☰
        </button>
      </header>
      <section className="layout">
        <aside className={p.menu ? "open" : ""}>
          <h2>Ambientes</h2>
          <p>
            Selecciona un ambiente para
            <br />
            explorar en detalle.
          </p>
          <MiniPlan data={d} selected={p.selected} onSelect={p.choose} />
          <nav>
            {d.espacios.map((r: any) => (
              <button
                aria-label={r.nombre}
                className={p.selected === r.id ? "active" : ""}
                key={r.id}
                onClick={() => {
                  p.choose(r.id);
                  p.setMenu(false);
                }}
              >
                <Icon name={roomIcon(r.id)} />
                <span>{r.nombre}</span>
                <b>›</b>
              </button>
            ))}
          </nav>
          <button
            className="back-project"
            onClick={() => {
              p.choose("");
              runtime.current?.focus();
            }}
          >
            <Icon name="home" />
            Ver proyecto completo
          </button>
        </aside>
        <Viewer
          data={d}
          selected={p.selected}
          onSelect={p.choose}
          wallMode={p.wallMode}
          labels={p.labels}
          solar={p.solarOpen ? solar : null}
          onExposure={p.setExposure}
        />
        <aside className="info">
          {p.solarOpen && solar ? (
            <SolarControls
              solar={solar}
              timezone={d.solar.location.timezone}
              calibration={d.solar.calibrationStatus}
              rooms={p.exposure}
              names={new Map(d.espacios.map((x: any) => [x.id, x.nombre]))}
              onClose={() => p.setSolarOpen(false)}
            />
          ) : (
            <div className="explore-panel">
              <h2>Tu hogar, en detalle</h2>
              <p>Explora cada ambiente y descubre sus proporciones.</p>
              <button onClick={() => p.setSolarOpen(true)}>
                <Icon name="sun" /> Iluminación natural
              </button>
              <label>
                Visualización de paredes
                <select
                  aria-label="Modo de paredes"
                  value={p.wallMode}
                  onChange={(e) => p.setWallMode(e.target.value)}
                >
                  <option value="inteligentes">Corte arquitectónico</option>
                  <option value="todas">Altura completa</option>
                  <option value="ocultas">Sin paredes</option>
                </select>
              </label>
            </div>
          )}
          <article className="unit-card">
            <div>
              <h2>{item?.nombre || "Unidad " + p.unit}</h2>
              <span className="available">
                {item ? "Ambiente" : "Tipología Garden"}
              </span>
            </div>
            <div className="unit-facts">
              <span>
                <Icon name="measure" />
                {item
                  ? item.area_m2
                  : d.proyecto === "garden_house_18"
                    ? 234
                    : d.espacios
                        .reduce((a: number, r: any) => a + (r.area_m2 || 0), 0)
                        .toFixed(0)}{" "}
                m²
              </span>
              <span>
                <Icon name="bed" />
                {d.proyecto === "garden_house_18"
                  ? "3 suites"
                  : "2 habitaciones"}
              </span>
              <span>
                <Icon name="layers" />
                Piso {p.floor}
              </span>
            </div>
            <p className="plan-dimensions">
              {d.proyecto === "garden_house_18"
                ? "18,00 × 13,00 m"
                : "Terraza Luz"}
              <small>
                {d.proyecto === "garden_house_18"
                  ? "Terraza envolvente de 2,40 m"
                  : "Arquitectura · naturaleza · luz"}
              </small>
            </p>
            <button className="proposal" onClick={() => setProposal(true)}>
              Solicitar propuesta <span>→</span>
            </button>
          </article>
        </aside>
      </section>
      <div className="bottom-tools">
        <button
          className={p.tour ? "active" : ""}
          onClick={() => p.setTour(!p.tour)}
        >
          <Icon name="pin" />
          <span>{p.tour ? "Pausar" : "Explorar"}</span>
        </button>
        <button
          onClick={() => {
            p.setWallMode(
              p.wallMode === "inteligentes" ? "todas" : "inteligentes",
            );
            p.setSolarOpen(false);
          }}
        >
          <Icon name="eye" />
          <span>Vista</span>
        </button>
        <button className={furnished ? "active" : ""} onClick={furniture}>
          <Icon name="sofa" />
          <span>Amueblado</span>
        </button>
        <button
          className={measure ? "active" : ""}
          onClick={() => {
            setMeasure(!measure);
            p.setLabels(!measure);
          }}
        >
          <Icon name="measure" />
          <span>Medir</span>
        </button>
        <button
          className={p.solarOpen ? "active" : ""}
          onClick={() => p.setSolarOpen(!p.solarOpen)}
        >
          <Icon name="sun" />
          <span>Iluminación</span>
        </button>
        <button
          onClick={() => {
            runtime.current?.capture();
            setNotice("Vista guardada");
          }}
        >
          <Icon name="eye" />
          <span>Guardar vista</span>
        </button>
        <button
          onClick={() => {
            runtime.current?.focus();
            setNotice("Orientación norte · São Paulo");
          }}
        >
          <Icon name="pin" />
          <span>Entorno</span>
        </button>
      </div>
      {measure && (
        <div className="measure-readout">
          {d.proyecto === "garden_house_18"
            ? "18,00 m × 13,00 m · Terraza 2,40 m"
            : "Selecciona un ambiente para ver su superficie"}
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {proposal && (
        <div className="modal-scrim" onClick={() => setProposal(false)}>
          <section
            className="proposal-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Solicitar propuesta"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-modal"
              aria-label="Cerrar"
              onClick={() => setProposal(false)}
            >
              ×
            </button>
            <small>XIXOVÁ · TU PRÓXIMO HOGAR</small>
            <h2>
              {d.nombre} · Unidad {p.unit}
            </h2>
            <p>
              Guarda la ficha de esta tipología para conversar con tu asesor. La
              disponibilidad y el precio se confirman con el proyecto.
            </p>
            <button
              className="proposal"
              onClick={() => {
                runtime.current?.capture();
                setNotice("Ficha visual guardada");
                setProposal(false);
              }}
            >
              Guardar ficha de la unidad →
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
export default App;
