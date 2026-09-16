import * as THREE from 'three';

/** Abstract presentation context, not a survey or a claim about local geography. */
export type EnvironmentOptions = { water?: boolean };

export function createProceduralEnvironment(scene: THREE.Scene, options: EnvironmentOptions = {}) {
  const root = new THREE.Group();
  root.name = 'V2_procedural_context';
  scene.add(root);
  const fog = new THREE.Fog('#d4dedb', 145, 360);
  scene.fog = fog;
  const uniforms = {
    zenith: { value: new THREE.Color('#7199b0') },
    horizon: { value: new THREE.Color('#d4dedb') },
    glow: { value: new THREE.Color('#ffe9bb') },
    time: { value: 0 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms,
    vertexShader: `varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 vDirection; uniform vec3 zenith; uniform vec3 horizon; uniform vec3 glow; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
      void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 color=mix(horizon,zenith,smoothstep(-.06,.48,d.y));
        float sun=pow(max(dot(d,normalize(vec3(-.65,.27,.6))),0.),9.);color=mix(color,glow,sun*.48);
        vec2 p=d.xz/(.32+max(d.y,0.))*2.5+vec2(time*.001,0.);float n=noise(p)*.65+noise(p*2.1)*.25+noise(p*4.3)*.1;
        float cloud=smoothstep(.47,.75,n)*smoothstep(.0,.12,h)*(1.-smoothstep(.5,.9,h));color=mix(color,mix(horizon,glow,sun*.6),cloud*.34);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10;
  root.add(sky);
  const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: .96 });
  const groundMaterial = material('#acb5a3');
  const ground = new THREE.Mesh(new THREE.CircleGeometry(420, 96), groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.68; ground.receiveShadow = true; root.add(ground);
  const pavingMaterial = material('#d0cdbf');
  const paving = new THREE.Mesh(new THREE.BoxGeometry(64, .18, 59), pavingMaterial);
  paving.position.set(0, -.66, 0); paving.receiveShadow = true; root.add(paving);
  // Broad paving joints keep scale legible without competing with the façade.
  const joints = new THREE.InstancedMesh(new THREE.BoxGeometry(.045, .012, 59), material('#aaa99b'), 15);
  const transform = new THREE.Object3D();
  for (let i = 0; i < 15; i++) { transform.position.set(-28 + i * 4, -.56, 0); transform.updateMatrix(); joints.setMatrixAt(i, transform.matrix); }
  root.add(joints);
  // A narrow perimeter walk gives the court a deliberate edge at orbit angles.
  const borderMaterial = material('#b9b9aa');
  for (const z of [-30.3, 30.3]) {
    const border = new THREE.Mesh(new THREE.BoxGeometry(67.2, .09, 1.5), borderMaterial);
    border.position.set(0, -.60, z); border.receiveShadow = true; root.add(border);
  }
  for (const x of [-32.8, 32.8]) {
    const border = new THREE.Mesh(new THREE.BoxGeometry(1.5, .09, 59), borderMaterial);
    border.position.set(x, -.60, 0); border.receiveShadow = true; root.add(border);
  }
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(70, 65), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;void main(){vec2 p=abs(vUv-.5)*2.;float a=(1.-smoothstep(.3,1.,length(p)))*.19;gl_FragColor=vec4(.20,.24,.19,a);}`,
  }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = -.545; root.add(contact);
  let seed = 1729;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const treeCount = 42;
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), material('#73846a'), treeCount);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16, .26, 1, 5), material('#716f59'), treeCount);
  crowns.castShadow = true; crowns.receiveShadow = true; trunks.castShadow = true;
  for (let i = 0; i < treeCount; i++) {
    // Small groves beyond the presentation court leave the foreground calm.
    const cluster = i % 7;
    const angle = cluster / 7 * Math.PI * 2 + (random() - .5) * .16;
    const radius = 83 + (cluster % 3) * 28 + random() * 18;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const height = 3.8 + random() * 3.2, width = 2.6 + random() * 2;
    transform.position.set(x, height * .42 - .65, z); transform.scale.set(1, height * .84, 1); transform.rotation.set(0, 0, 0); transform.updateMatrix(); trunks.setMatrixAt(i, transform.matrix);
    transform.position.y = height; transform.scale.set(width, height * .53, width * .9); transform.rotation.y = random() * 6; transform.updateMatrix(); crowns.setMatrixAt(i, transform.matrix);
    crowns.setColorAt(i, new THREE.Color().setHSL(.23 + random() * .025, .12, .40 + random() * .09));
  }
  root.add(crowns, trunks);
  // Low, discontinuous silhouettes deliberately avoid inventing a city skyline.
  const horizon = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material('#a5b2a7'), 32);
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2;
    transform.position.set(Math.cos(angle) * 280, -2, Math.sin(angle) * 280);
    transform.scale.set(30 + random() * 30, 4 + random() * 5, 25 + random() * 18); transform.rotation.y = angle; transform.updateMatrix(); horizon.setMatrixAt(i, transform.matrix);
  }
  root.add(horizon);
  if (options.water === true) {
    const water = new THREE.Mesh(new THREE.CircleGeometry(90, 64), new THREE.MeshStandardMaterial({ color: '#95b1b2', roughness: .28, metalness: .25 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -.64, -220); root.add(water);
  }
  const day = { zenith: new THREE.Color('#568caa'), horizon: new THREE.Color('#d4dedb'), glow: new THREE.Color('#ffe9bb'), ground: new THREE.Color('#acb5a3'), paving: new THREE.Color('#d0cdbf') };
  const evening = { zenith: new THREE.Color('#526785'), horizon: new THREE.Color('#c6ada0'), glow: new THREE.Color('#f6b888'), ground: new THREE.Color('#939888'), paving: new THREE.Color('#b8aa98') };
  let lastTime: number | undefined;
  return {
    update(elapsedSeconds: number, dusk: boolean, camera: THREE.Camera) {
      sky.position.copy(camera.position);
      uniforms.time.value = elapsedSeconds;
      const palette = dusk ? evening : day;
      const blend = lastTime === undefined ? 1 : 1 - Math.exp(-Math.min(elapsedSeconds - lastTime, .1) * 4);
      lastTime = elapsedSeconds;
      uniforms.zenith.value.lerp(palette.zenith, blend);
      uniforms.horizon.value.lerp(palette.horizon, blend);
      uniforms.glow.value.lerp(palette.glow, blend);
      fog.color.copy(uniforms.horizon.value);
      groundMaterial.color.lerp(palette.ground, blend);
      pavingMaterial.color.lerp(palette.paving, blend);
    },
  };
}
