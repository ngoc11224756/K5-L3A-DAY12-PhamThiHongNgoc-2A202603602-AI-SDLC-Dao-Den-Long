import * as THREE from 'three';
import { ISLAND_RADIUS, TUNING } from '../core/config.ts';
import type { GameSimulation } from '../core/simulation.ts';

interface LanternVisual {
  group: THREE.Group;
  bulb: THREE.Mesh;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
  progressBar: THREE.Mesh;
}

interface ShadeVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  stunRing: THREE.Mesh;
}

interface SkyLantern {
  mesh: THREE.Mesh;
  speed: number;
  wobbleOffset: number;
}

export class GameSceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private fog: THREE.FogExp2;
  private hemiLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;

  private playerGroup: THREE.Group;
  private playerLight: THREE.PointLight;
  private orbitMotes: THREE.Mesh[] = [];

  private lanternMap = new Map<string, LanternVisual>();
  private shadeMap = new Map<string, ShadeVisual>();
  private moteMap = new Map<string, THREE.Group>();

  private pulseRing: THREE.Mesh;
  private pulseRingAge = 1;

  // Visual-only creativity: rising sky lanterns when Great Lanterns are lit
  private skyLanterns: SkyLantern[] = [];
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d091d);
    this.fog = new THREE.FogExp2(0x110b24, 0.022);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      240
    );

    this.hemiLight = new THREE.HemisphereLight(0x4b3d7a, 0x161224, 0.75);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0x9ab0ff, 0.55);
    this.dirLight.position.set(22, 40, 18);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.left = -50;
    this.dirLight.shadow.camera.right = 50;
    this.dirLight.shadow.camera.top = 50;
    this.dirLight.shadow.camera.bottom = -50;
    this.scene.add(this.dirLight);

    this.buildIslandAndSky();

    const { group, light, orbitMotes } = this.buildPlayer();
    this.playerGroup = group;
    this.playerLight = light;
    this.orbitMotes = orbitMotes;
    this.scene.add(this.playerGroup);

    // Expanding light pulse ring VFX
    const pulseGeo = new THREE.RingGeometry(0.6, 1.0, 48);
    pulseGeo.rotateX(-Math.PI / 2);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xffc864,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    this.pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
    this.pulseRing.position.y = 0.15;
    this.scene.add(this.pulseRing);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private buildIslandAndSky(): void {
    // Circular Island (Đảo Bến) at Y = 0
    const islandGeo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.92, 3.2, 64);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x202736,
      roughness: 0.92,
      metalness: 0.05
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -1.6;
    island.receiveShadow = true;
    this.scene.add(island);

    // Decorative stone ring near center
    const centerRingGeo = new THREE.RingGeometry(2.8, 3.4, 36);
    centerRingGeo.rotateX(-Math.PI / 2);
    const centerRingMat = new THREE.MeshStandardMaterial({
      color: 0x3b3552,
      roughness: 0.85
    });
    const centerRing = new THREE.Mesh(centerRingGeo, centerRingMat);
    centerRing.position.y = 0.02;
    this.scene.add(centerRing);

    // Soft sea of clouds below island
    const cloudSeaGeo = new THREE.CircleGeometry(180, 48);
    cloudSeaGeo.rotateX(-Math.PI / 2);
    const cloudSeaMat = new THREE.MeshBasicMaterial({
      color: 0x16112b,
      transparent: true,
      opacity: 0.9
    });
    const cloudSea = new THREE.Mesh(cloudSeaGeo, cloudSeaMat);
    cloudSea.position.y = -3.4;
    this.scene.add(cloudSea);

    // Starfield dome (deterministic positions)
    const starPositions: number[] = [];
    for (let i = 0; i < 280; i++) {
      const a = i * 2.39996;
      const elev = 0.25 + ((i * 37) % 100) / 150;
      const dist = 120;
      starPositions.push(
        Math.cos(a) * Math.cos(elev) * dist,
        Math.sin(elev) * dist,
        Math.sin(a) * Math.cos(elev) * dist
      );
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffe9c4, size: 0.9 });
    this.scene.add(new THREE.Points(starsGeo, starsMat));

    // Island border bollards
    const postGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.9, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a324b, roughness: 0.8 });
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(
        Math.cos(a) * (ISLAND_RADIUS - 0.6),
        0.45,
        Math.sin(a) * (ISLAND_RADIUS - 0.6)
      );
      this.scene.add(post);
    }
  }

  private buildPlayer(): {
    group: THREE.Group;
    light: THREE.PointLight;
    orbitMotes: THREE.Mesh[];
  } {
    const group = new THREE.Group();

    // Cloak body
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 1.15, 12),
      new THREE.MeshStandardMaterial({ color: 0x3d5c8a, roughness: 0.75 })
    );
    body.position.y = 0.58;
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.6 })
    );
    head.position.y = 1.32;
    head.castShadow = true;
    group.add(head);

    // Vietnamese conical hat (Nón lá)
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.72, 0.42, 20),
      new THREE.MeshStandardMaterial({ color: 0xe6c88a, roughness: 0.7 })
    );
    hat.position.y = 1.66;
    hat.castShadow = true;
    group.add(hat);

    // Small warm lantern hanging from the brim of the nón lá
    const miniLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.22, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffbe55,
        emissive: 0xff9a2e,
        emissiveIntensity: 1.8
      })
    );
    miniLantern.position.set(0, 1.36, 0.62);
    group.add(miniLantern);

    const light = new THREE.PointLight(0xffb554, 2.2, 14, 1.6);
    light.position.set(0, 1.5, 0.5);
    group.add(light);

    // Orbiting carried motes (visual indicator of carried count)
    const orbitMotes: THREE.Mesh[] = [];
    const moteGeo = new THREE.SphereGeometry(0.12, 10, 10);
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffdc7a });
    for (let i = 0; i < TUNING.carry_capacity; i++) {
      const m = new THREE.Mesh(moteGeo, moteMat);
      m.visible = false;
      group.add(m);
      orbitMotes.push(m);
    }

    return { group, light, orbitMotes };
  }

  private createLanternVisual(pos: [number, number, number]): LanternVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], 0, pos[2]);

    // Stone pedestal
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1.05, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x454156, roughness: 0.85 })
    );
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Pillar
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 3.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x5c3c28, roughness: 0.8 })
    );
    pillar.position.y = 1.9;
    pillar.castShadow = true;
    group.add(pillar);

    // Lantern roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0x3b261d, roughness: 0.75 })
    );
    roof.position.y = 4.35;
    group.add(roof);

    // Lantern bulb
    const bulb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.45, 0.95, 6),
      new THREE.MeshStandardMaterial({
        color: 0x463b52,
        emissive: 0xff9a2e,
        emissiveIntensity: 0.05,
        roughness: 0.4
      })
    );
    bulb.position.y = 3.65;
    group.add(bulb);

    const light = new THREE.PointLight(0xffaa44, 0, 26, 1.4);
    light.position.y = 3.7;
    group.add(light);

    // Safe radius ground ring (visible when lit)
    const safeGeo = new THREE.RingGeometry(TUNING.safe_radius - 0.14, TUNING.safe_radius, 48);
    safeGeo.rotateX(-Math.PI / 2);
    const safeRing = new THREE.Mesh(
      safeGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffb84d,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide
      })
    );
    safeRing.position.y = 0.05;
    group.add(safeRing);

    // Deposit progress ring near base
    const progGeo = new THREE.RingGeometry(1.15, 1.35, 24);
    progGeo.rotateX(-Math.PI / 2);
    const progressBar = new THREE.Mesh(
      progGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffd27a,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      })
    );
    progressBar.position.y = 0.06;
    group.add(progressBar);

    this.scene.add(group);
    return { group, bulb, light, safeRing, progressBar };
  }

  private createShadeVisual(pos: [number, number, number]): ShadeVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], 0, pos[2]);

    const body = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.75, 1),
      new THREE.MeshStandardMaterial({
        color: 0x1a0826,
        emissive: 0x3b0b5e,
        emissiveIntensity: 0.6,
        roughness: 0.35
      })
    );
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    const eyeGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd966ff });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.22, 1.18, 0.62);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.22, 1.18, 0.62);
    group.add(eyeL, eyeR);

    const stunGeo = new THREE.TorusGeometry(0.85, 0.06, 8, 24);
    stunGeo.rotateX(Math.PI / 2);
    const stunRing = new THREE.Mesh(
      stunGeo,
      new THREE.MeshBasicMaterial({ color: 0xffdf80 })
    );
    stunRing.position.y = 2.0;
    stunRing.visible = false;
    group.add(stunRing);

    this.scene.add(group);
    return { group, body, stunRing };
  }

  private createMoteVisual(pos: [number, number, number]): THREE.Group {
    const group = new THREE.Group();
    group.position.set(pos[0], 0.9, pos[2]);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe484 })
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffa834,
        transparent: true,
        opacity: 0.32
      })
    );
    group.add(core, halo);
    this.scene.add(group);
    return group;
  }

  triggerPulseVfx(pos: [number, number, number]): void {
    this.pulseRing.position.set(pos[0], 0.18, pos[2]);
    this.pulseRingAge = 0;
  }

  spawnSkyLantern(pos: [number, number, number]): void {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.22, 0.48, 8),
      new THREE.MeshBasicMaterial({ color: 0xffbe5c })
    );
    mesh.position.set(pos[0], 4.6, pos[2]);
    this.scene.add(mesh);
    this.skyLanterns.push({
      mesh,
      speed: 1.4 + (this.skyLanterns.length % 3) * 0.35,
      wobbleOffset: this.elapsed + this.skyLanterns.length
    });
  }

  resetDynamicVisuals(): void {
    for (const v of this.lanternMap.values()) this.scene.remove(v.group);
    this.lanternMap.clear();
    for (const v of this.shadeMap.values()) this.scene.remove(v.group);
    this.shadeMap.clear();
    for (const v of this.moteMap.values()) this.scene.remove(v);
    this.moteMap.clear();
    for (const s of this.skyLanterns) this.scene.remove(s.mesh);
    this.skyLanterns = [];
  }

  render(sim: GameSimulation, camYawDeg: number, dt: number): void {
    this.elapsed += dt;

    // Update player transform & orbiting motes
    this.playerGroup.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
    const yawRad = (camYawDeg * Math.PI) / 180;
    this.playerGroup.rotation.y = yawRad;

    // Blink slightly during invulnerability
    this.playerGroup.visible =
      sim.invulnTicks <= 0 || Math.floor(sim.invulnTicks / 4) % 2 === 0;
    this.playerLight.intensity = 2.0 + sim.player.carried * 0.35;

    for (let i = 0; i < this.orbitMotes.length; i++) {
      const mesh = this.orbitMotes[i];
      mesh.visible = i < sim.player.carried;
      if (mesh.visible) {
        const angle = this.elapsed * 2.4 + (i * Math.PI * 2) / Math.max(1, sim.player.carried);
        mesh.position.set(
          Math.cos(angle) * 0.95,
          1.15 + Math.sin(this.elapsed * 3.5 + i) * 0.14,
          Math.sin(angle) * 0.95
        );
      }
    }

    // Sync lanterns & compute island brightness progress
    let litCount = 0;
    for (const l of sim.lanterns) {
      let vis = this.lanternMap.get(l.id);
      if (!vis) {
        vis = this.createLanternVisual(l.pos);
        this.lanternMap.set(l.id, vis);
      }
      vis.group.position.set(l.pos[0], 0, l.pos[2]);
      const mat = vis.bulb.material as THREE.MeshStandardMaterial;
      const safeMat = vis.safeRing.material as THREE.MeshBasicMaterial;
      if (l.lit) {
        litCount += 1;
        mat.color.setHex(0xffd27a);
        mat.emissiveIntensity = 1.9 + Math.sin(this.elapsed * 4) * 0.15;
        vis.light.intensity = 4.2;
        safeMat.opacity = 0.34;
        vis.progressBar.visible = false;
      } else {
        const ratio = l.deposited / TUNING.lantern_cost;
        mat.color.setHex(ratio > 0 ? 0x8a6448 : 0x463b52);
        mat.emissiveIntensity = 0.08 + ratio * 0.9;
        vis.light.intensity = ratio * 1.4;
        safeMat.opacity = 0;
        vis.progressBar.visible = true;
        vis.progressBar.scale.setScalar(0.75 + ratio * 0.45);
      }
    }

    // Island brightens as lanterns are lit
    const progress = litCount / Math.max(1, sim.lanterns.length);
    this.fog.density = 0.022 - progress * 0.013;
    this.hemiLight.intensity = 0.72 + progress * 0.65;
    this.dirLight.intensity = 0.5 + progress * 0.55;

    // Sync shades
    const activeShadeIds = new Set<string>();
    for (const s of sim.shades) {
      activeShadeIds.add(s.id);
      let vis = this.shadeMap.get(s.id);
      if (!vis) {
        vis = this.createShadeVisual(s.pos);
        this.shadeMap.set(s.id, vis);
      }
      vis.group.position.set(
        s.pos[0],
        Math.sin(this.elapsed * 3.5 + s.pos[0]) * 0.14,
        s.pos[2]
      );
      vis.group.lookAt(sim.player.pos[0], vis.group.position.y, sim.player.pos[2]);
      const bodyMat = vis.body.material as THREE.MeshStandardMaterial;
      if (s.state === 'stunned') {
        bodyMat.color.setHex(0x63588f);
        bodyMat.emissive.setHex(0x9a8cff);
        vis.stunRing.visible = true;
        vis.stunRing.rotation.z = this.elapsed * 5;
      } else {
        bodyMat.color.setHex(0x1a0826);
        bodyMat.emissive.setHex(0x3b0b5e);
        vis.stunRing.visible = false;
      }
    }
    for (const [id, vis] of this.shadeMap.entries()) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(vis.group);
        this.shadeMap.delete(id);
      }
    }

    // Sync motes
    const activeMoteIds = new Set<string>();
    for (const m of sim.motes) {
      activeMoteIds.add(m.id);
      let vis = this.moteMap.get(m.id);
      if (!vis) {
        vis = this.createMoteVisual(m.pos);
        this.moteMap.set(m.id, vis);
      }
      vis.position.set(
        m.pos[0],
        0.95 + Math.sin(this.elapsed * 3.2 + m.pos[0] + m.pos[2]) * 0.25,
        m.pos[2]
      );
    }
    for (const [id, vis] of this.moteMap.entries()) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(vis);
        this.moteMap.delete(id);
      }
    }

    // Animate pulse shockwave ring
    if (this.pulseRingAge < 1) {
      this.pulseRingAge = Math.min(1, this.pulseRingAge + dt * 2.2);
      const scale = 1 + this.pulseRingAge * (TUNING.pulse_radius - 1);
      this.pulseRing.scale.setScalar(scale);
      (this.pulseRing.material as THREE.MeshBasicMaterial).opacity =
        (1 - this.pulseRingAge) * 0.75;
    }

    // Animate decorative rising sky lanterns
    for (let i = this.skyLanterns.length - 1; i >= 0; i--) {
      const s = this.skyLanterns[i];
      s.mesh.position.y += s.speed * dt;
      s.mesh.position.x += Math.sin(this.elapsed + s.wobbleOffset) * 0.35 * dt;
      if (s.mesh.position.y > 48) {
        this.scene.remove(s.mesh);
        this.skyLanterns.splice(i, 1);
      }
    }

    // Third-person camera following Mây (frame-rate independent smoothing)
    const camDist = 9.8;
    const camHeight = 5.4;
    const targetX = sim.player.pos[0] - Math.sin(yawRad) * camDist;
    const targetZ = sim.player.pos[2] - Math.cos(yawRad) * camDist;
    const targetY = sim.player.pos[1] + camHeight;

    const alpha = 1 - Math.exp(-10 * dt);
    this.camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), alpha);
    this.camera.lookAt(sim.player.pos[0], sim.player.pos[1] + 1.4, sim.player.pos[2]);

    this.renderer.render(this.scene, this.camera);
  }
}
