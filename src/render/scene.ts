import * as THREE from 'three';
import { TUNING } from '../core/config.ts';
import type { GameSimulation } from '../core/simulation.ts';
import type { NightId, Vec3 } from '../core/types.ts';

// Standard Palette (Ticket-02)
const PALETTE = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStun: 0x3a3450,
  mayCloak: 0xe8e2d0,
  mayScarf: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8
};

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
  private mapGroup: THREE.Group;
  private builtNight: NightId | null = null;

  private playerGroup: THREE.Group;
  private playerLight: THREE.PointLight;
  private orbitMotes: THREE.Mesh[] = [];

  private lanternMap = new Map<string, LanternVisual>();
  private shadeMap = new Map<string, ShadeVisual>();
  private moteMap = new Map<string, THREE.Group>();
  private drifterMap = new Map<string, THREE.Group>();
  private charmMap = new Map<string, THREE.Group>();

  private pulseRing: THREE.Mesh;
  private pulseRingAge = 1;
  private windLeaves: THREE.Points;
  private skyLanterns: SkyLantern[] = [];
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.fog = new THREE.FogExp2(PALETTE.fog, 0.015);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      260
    );

    // Ambient intensity = 0.15 + 0.55 * (lit / total)
    this.hemiLight = new THREE.HemisphereLight(0x9fb8ff, PALETTE.cloudSea, 0.15);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xcfe0ff, 0.45);
    this.dirLight.position.set(28, 48, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.left = -65;
    this.dirLight.shadow.camera.right = 65;
    this.dirLight.shadow.camera.top = 65;
    this.dirLight.shadow.camera.bottom = -65;
    this.scene.add(this.dirLight);

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    this.buildSkyAndClouds();

    const { group, light, orbitMotes } = this.buildPlayer();
    this.playerGroup = group;
    this.playerLight = light;
    this.orbitMotes = orbitMotes;
    this.scene.add(this.playerGroup);

    // Expanding light pulse ring VFX
    const pulseGeo = new THREE.RingGeometry(0.5, 1.0, 48);
    pulseGeo.rotateX(-Math.PI / 2);
    this.pulseRing = new THREE.Mesh(
      pulseGeo,
      new THREE.MeshBasicMaterial({
        color: PALETTE.lanternLit,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      })
    );
    this.scene.add(this.pulseRing);

    // Wind leaves particle system (Night 3)
    const leafCoords: number[] = [];
    for (let i = 0; i < 120; i++) {
      leafCoords.push(((i * 29) % 80) - 40, 1 + ((i * 13) % 10), ((i * 47) % 80) - 40);
    }
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(leafCoords, 3));
    this.windLeaves = new THREE.Points(
      leafGeo,
      new THREE.PointsMaterial({ color: PALETTE.gold, size: 0.45, transparent: true, opacity: 0.85 })
    );
    this.windLeaves.visible = false;
    this.scene.add(this.windLeaves);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private buildSkyAndClouds(): void {
    const cloudSea = new THREE.Mesh(
      new THREE.CircleGeometry(240, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.cloudSea, transparent: true, opacity: 0.92 })
    );
    cloudSea.rotation.x = -Math.PI / 2;
    cloudSea.position.y = -11;
    this.scene.add(cloudSea);

    const starPositions: number[] = [];
    for (let i = 0; i < 320; i++) {
      const a = i * 2.39996;
      const elev = 0.22 + ((i * 37) % 100) / 150;
      const dist = 160;
      starPositions.push(
        Math.cos(a) * Math.cos(elev) * dist,
        Math.sin(elev) * dist,
        Math.sin(a) * Math.cos(elev) * dist
      );
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xfff6c2, size: 1.0 })));
  }

  private buildIslandMesh(cx: number, cz: number, radius: number): void {
    const grass = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.93, 3.0, 56),
      new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.9 })
    );
    grass.position.set(cx, -1.5, cz);
    grass.receiveShadow = true;
    this.mapGroup.add(grass);

    // Sand border ring
    const sandGeo = new THREE.RingGeometry(radius - 2.2, radius, 56);
    sandGeo.rotateX(-Math.PI / 2);
    const sand = new THREE.Mesh(
      sandGeo,
      new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.95 })
    );
    sand.position.set(cx, 0.02, cz);
    sand.receiveShadow = true;
    this.mapGroup.add(sand);
  }

  private buildJumpPadMesh(pos: Vec3): void {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.15, 0.22, 20),
      new THREE.MeshStandardMaterial({
        color: PALETTE.gold,
        emissive: PALETTE.lanternLit,
        emissiveIntensity: 0.75
      })
    );
    pad.position.set(pos[0], pos[1] + 0.11, pos[2]);
    this.mapGroup.add(pad);
  }

  private buildNightGeometry(night: NightId): void {
    while (this.mapGroup.children.length > 0) {
      this.mapGroup.remove(this.mapGroup.children[0]);
    }
    this.builtNight = night;

    if (night === 1) {
      this.buildIslandMesh(0, 0, 40);
    } else if (night === 2) {
      this.buildIslandMesh(0, 0, 28);
      this.buildIslandMesh(70, 0, 28);
      // Bamboo bridge x in [26, 44], z in [-2, 2]
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(18, 0.4, 4),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 })
      );
      bridge.position.set(35, -0.2, 0);
      bridge.receiveShadow = true;
      this.mapGroup.add(bridge);

      this.buildJumpPadMesh([20, 0, 18]);
      this.buildJumpPadMesh([50, 0, -18]);
    } else {
      // Night 3: Đảo Chuông
      this.buildIslandMesh(0, 0, 45);

      // Tier 1: half-annulus r in [12, 24], z > 0, Y = 3
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 24, 0, Math.PI, false);
      shape.lineTo(-12, 0);
      shape.absarc(0, 0, 12, Math.PI, 0, true);
      shape.closePath();
      const tier1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
      tier1Geo.rotateX(Math.PI / 2);
      const tier1 = new THREE.Mesh(
        tier1Geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.88 })
      );
      tier1.position.y = 3;
      tier1.receiveShadow = true;
      this.mapGroup.add(tier1);

      // Tier 2: disk r = 8 at Y = 6
      const tier2 = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 8.2, 6, 36),
        new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.85 })
      );
      tier2.position.y = 3;
      tier2.receiveShadow = true;
      this.mapGroup.add(tier2);

      // Bell tower at (0, 6, 0), r = 2, height = 8
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(2.0, 2.0, 8, 16),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 })
      );
      tower.position.y = 10;
      tower.castShadow = true;
      this.mapGroup.add(tower);

      const bellRoof = new THREE.Mesh(
        new THREE.ConeGeometry(2.8, 2.0, 8),
        new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.5 })
      );
      bellRoof.position.y = 15;
      this.mapGroup.add(bellRoof);

      // Two ramps at 30° and 150° from r=30 (Y=0) to r=24 (Y=3), width 3 m
      const rampLen = Math.hypot(6, 3);
      const rampSlope = Math.atan2(3, 6);
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180;
        const ramp = new THREE.Mesh(
          new THREE.BoxGeometry(rampLen, 0.35, 3.0),
          new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 })
        );
        ramp.position.set(Math.cos(rad) * 27, 1.35, Math.sin(rad) * 27);
        ramp.rotation.order = 'YXZ';
        ramp.rotation.y = -rad;
        ramp.rotation.z = rampSlope;
        ramp.receiveShadow = true;
        this.mapGroup.add(ramp);
      }

      this.buildJumpPadMesh([0, 3, 13]);
    }
  }

  private buildPlayer(): {
    group: THREE.Group;
    light: THREE.PointLight;
    orbitMotes: THREE.Mesh[];
  } {
    const group = new THREE.Group();

    // Cloak (#E8E2D0)
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.46, 1.12, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayCloak, roughness: 0.7 })
    );
    body.position.y = 0.56;
    body.castShadow = true;
    group.add(body);

    // Scarf (#C8102E)
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.08, 8, 16),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayScarf, roughness: 0.65 })
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.08;
    group.add(scarf);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.6 })
    );
    head.position.y = 1.32;
    group.add(head);

    // Nón lá + tiny hanging lantern
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 0.4, 20),
      new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.7 })
    );
    hat.position.y = 1.65;
    hat.castShadow = true;
    group.add(hat);

    const miniLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.22, 10),
      new THREE.MeshStandardMaterial({
        color: PALETTE.lanternLit,
        emissive: PALETTE.lanternLit,
        emissiveIntensity: 1.8
      })
    );
    miniLantern.position.set(0, 1.35, 0.6);
    group.add(miniLantern);

    const light = new THREE.PointLight(PALETTE.lanternLit, 2.2, 14, 1.6);
    light.position.set(0, 1.5, 0.5);
    group.add(light);

    // Orbiting carried motes (up to 10)
    const orbitMotes: THREE.Mesh[] = [];
    const moteGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const moteMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
    for (let i = 0; i < TUNING.carry_capacity; i++) {
      const m = new THREE.Mesh(moteGeo, moteMat);
      m.visible = false;
      group.add(m);
      orbitMotes.push(m);
    }

    return { group, light, orbitMotes };
  }

  private createLanternVisual(pos: Vec3): LanternVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 1.0, 0.45, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff, roughness: 0.85 })
    );
    base.position.y = 0.22;
    group.add(base);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.26, 3.1, 10),
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 })
    );
    pillar.position.y = 1.85;
    group.add(pillar);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.75 })
    );
    roof.position.y = 4.3;
    group.add(roof);

    const bulb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.45, 0.95, 6),
      new THREE.MeshStandardMaterial({
        color: PALETTE.lanternOff,
        emissive: PALETTE.lanternLit,
        emissiveIntensity: 0.05
      })
    );
    bulb.position.y = 3.6;
    group.add(bulb);

    const light = new THREE.PointLight(PALETTE.lanternLit, 0, 26, 1.4);
    light.position.y = 3.7;
    group.add(light);

    const safeGeo = new THREE.RingGeometry(TUNING.safe_radius - 0.14, TUNING.safe_radius, 48);
    safeGeo.rotateX(-Math.PI / 2);
    const safeRing = new THREE.Mesh(
      safeGeo,
      new THREE.MeshBasicMaterial({
        color: PALETTE.lanternLit,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      })
    );
    safeRing.position.y = 0.06;
    group.add(safeRing);

    const progGeo = new THREE.RingGeometry(1.1, 1.3, 24);
    progGeo.rotateX(-Math.PI / 2);
    const progressBar = new THREE.Mesh(
      progGeo,
      new THREE.MeshBasicMaterial({
        color: PALETTE.gold,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      })
    );
    progressBar.position.y = 0.07;
    group.add(progressBar);

    this.scene.add(group);
    return { group, bulb, light, safeRing, progressBar };
  }

  private createShadeVisual(pos: Vec3): ShadeVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);

    const body = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.72, 1),
      new THREE.MeshStandardMaterial({
        color: PALETTE.shadeBody,
        emissive: PALETTE.shadeRim,
        emissiveIntensity: 0.55,
        roughness: 0.35
      })
    );
    group.add(body);

    const eyeGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.22, 0.12, 0.62);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.22, 0.12, 0.62);
    group.add(eyeL, eyeR);

    const stunGeo = new THREE.TorusGeometry(0.85, 0.06, 8, 24);
    stunGeo.rotateX(Math.PI / 2);
    const stunRing = new THREE.Mesh(stunGeo, new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
    stunRing.position.y = 0.95;
    stunRing.visible = false;
    group.add(stunRing);

    this.scene.add(group);
    return { group, body, stunRing };
  }

  private createMoteVisual(pos: Vec3): THREE.Group {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1] + 0.85, pos[2]);
    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 10, 10),
        new THREE.MeshBasicMaterial({ color: PALETTE.moteCore })
      ),
      new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 10, 10),
        new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.35 })
      )
    );
    this.scene.add(group);
    return group;
  }

  private createDrifterVisual(pos: Vec3): THREE.Group {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);
    const ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.9, 1.4),
      new THREE.MeshStandardMaterial({
        color: PALETTE.drifter,
        emissive: PALETTE.drifter,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.85
      })
    );
    group.add(ribbon);
    this.scene.add(group);
    return group;
  }

  private createCharmVisual(pos: Vec3): THREE.Group {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1] + 1.0, pos[2]);
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.75, 0.08),
      new THREE.MeshStandardMaterial({
        color: PALETTE.mayScarf,
        emissive: PALETTE.mayScarf,
        emissiveIntensity: 0.5
      })
    );
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.84, 0.05),
      new THREE.MeshBasicMaterial({ color: PALETTE.gold })
    );
    group.add(border, tag);
    this.scene.add(group);
    return group;
  }

  triggerPulseVfx(pos: Vec3): void {
    this.pulseRing.position.set(pos[0], pos[1] + 0.2, pos[2]);
    this.pulseRingAge = 0;
  }

  spawnSkyLantern(pos: Vec3): void {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.22, 0.48, 8),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit })
    );
    mesh.position.set(pos[0], pos[1] + 4.6, pos[2]);
    this.scene.add(mesh);
    this.skyLanterns.push({
      mesh,
      speed: 1.5 + (this.skyLanterns.length % 3) * 0.35,
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
    for (const v of this.drifterMap.values()) this.scene.remove(v);
    this.drifterMap.clear();
    for (const v of this.charmMap.values()) this.scene.remove(v);
    this.charmMap.clear();
    for (const s of this.skyLanterns) this.scene.remove(s.mesh);
    this.skyLanterns = [];
  }

  /** Projects a world position to normalized screen coordinates for off-screen lantern arrow. */
  projectToScreen(pos: Vec3): { x: number; y: number; inFront: boolean; onScreen: boolean } {
    const v = new THREE.Vector3(pos[0], pos[1] + 2.5, pos[2]);
    v.project(this.camera);
    const inFront = v.z < 1;
    const onScreen = inFront && Math.abs(v.x) <= 0.92 && Math.abs(v.y) <= 0.88;
    return { x: v.x, y: v.y, inFront, onScreen };
  }

  render(sim: GameSimulation, camYawDeg: number, dt: number): void {
    this.elapsed += dt;
    if (this.builtNight !== sim.night) {
      this.buildNightGeometry(sim.night);
    }

    // Player
    this.playerGroup.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
    const yawRad = (camYawDeg * Math.PI) / 180;
    this.playerGroup.rotation.y = Math.atan2(sim.player.facing[0], sim.player.facing[1]);
    this.playerGroup.visible =
      !sim.falling && (sim.invulnTicks <= 0 || Math.floor(sim.invulnTicks / 4) % 2 === 0);
    this.playerLight.intensity = 2.0 + sim.player.carried * 0.22;

    for (let i = 0; i < this.orbitMotes.length; i++) {
      const m = this.orbitMotes[i];
      m.visible = i < sim.player.carried;
      if (m.visible) {
        const a = this.elapsed * 2.5 + (i * Math.PI * 2) / Math.max(1, sim.player.carried);
        m.position.set(
          Math.cos(a) * 0.92,
          1.1 + Math.sin(this.elapsed * 3.5 + i) * 0.14,
          Math.sin(a) * 0.92
        );
      }
    }

    // Lanterns + ambient intensity formula (0.15 + 0.55 * lit / total)
    let litCount = 0;
    for (const l of sim.lanterns) {
      let vis = this.lanternMap.get(l.id);
      if (!vis) {
        vis = this.createLanternVisual(l.pos);
        this.lanternMap.set(l.id, vis);
      }
      vis.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      const mat = vis.bulb.material as THREE.MeshStandardMaterial;
      const safeMat = vis.safeRing.material as THREE.MeshBasicMaterial;
      if (l.lit) {
        litCount += 1;
        mat.color.setHex(PALETTE.lanternCore);
        mat.emissive.setHex(PALETTE.lanternLit);
        mat.emissiveIntensity = 1.85 + Math.sin(this.elapsed * 4) * 0.12;
        vis.light.intensity = 4.2;
        safeMat.opacity = 0.34;
        vis.progressBar.visible = false;
      } else {
        const ratio = l.deposited / TUNING.lantern_cost;
        mat.color.setHex(ratio > 0 ? 0x8a6f52 : PALETTE.lanternOff);
        mat.emissiveIntensity = 0.06 + ratio * 0.85;
        vis.light.intensity = ratio * 1.4;
        safeMat.opacity = 0;
        vis.progressBar.visible = true;
        vis.progressBar.scale.setScalar(0.75 + ratio * 0.45);
      }
    }

    const progress = litCount / Math.max(1, sim.lanterns.length);
    this.hemiLight.intensity = 0.15 + 0.55 * progress;
    this.fog.density = 0.017 - progress * 0.009;
    this.dirLight.intensity = 0.4 + progress * 0.45;

    // Shades
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
        s.pos[1] + Math.sin(this.elapsed * 3.5 + s.pos[0]) * 0.12,
        s.pos[2]
      );
      vis.group.lookAt(sim.player.pos[0], vis.group.position.y, sim.player.pos[2]);
      const mat = vis.body.material as THREE.MeshStandardMaterial;
      if (s.state === 'stunned') {
        mat.color.setHex(PALETTE.shadeStun);
        mat.emissive.setHex(PALETTE.shadeRim);
        vis.stunRing.visible = true;
        vis.stunRing.rotation.z = this.elapsed * 5;
      } else {
        mat.color.setHex(PALETTE.shadeBody);
        mat.emissive.setHex(PALETTE.shadeRim);
        vis.stunRing.visible = false;
      }
      vis.group.scale.setScalar(s.state === 'spawning' ? 0.55 : 1.0);
    }
    for (const [id, vis] of this.shadeMap.entries()) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(vis.group);
        this.shadeMap.delete(id);
      }
    }

    // Motes
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
        m.pos[1] + 0.85 + Math.sin(this.elapsed * 3.2 + m.pos[0] + m.pos[2]) * 0.22,
        m.pos[2]
      );
    }
    for (const [id, vis] of this.moteMap.entries()) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(vis);
        this.moteMap.delete(id);
      }
    }

    // Drifters (Gió Lạc)
    const activeDrifterIds = new Set<string>();
    for (const d of sim.drifters) {
      activeDrifterIds.add(d.id);
      let vis = this.drifterMap.get(d.id);
      if (!vis) {
        vis = this.createDrifterVisual(d.pos);
        this.drifterMap.set(d.id, vis);
      }
      vis.position.set(d.pos[0], d.pos[1] + Math.sin(this.elapsed * 5) * 0.25, d.pos[2]);
      vis.rotation.y = this.elapsed * 2.5;
    }
    for (const [id, vis] of this.drifterMap.entries()) {
      if (!activeDrifterIds.has(id)) {
        this.scene.remove(vis);
        this.drifterMap.delete(id);
      }
    }

    // Charms (Bùa Gió)
    for (const c of sim.charms) {
      let vis = this.charmMap.get(c.id);
      if (!vis) {
        vis = this.createCharmVisual(c.pos);
        this.charmMap.set(c.id, vis);
      }
      vis.visible = c.available;
      if (c.available) {
        vis.position.set(c.pos[0], c.pos[1] + 1.0 + Math.sin(this.elapsed * 3) * 0.18, c.pos[2]);
        vis.rotation.y = this.elapsed * 1.8;
      }
    }

    // Wind leaves VFX
    this.windLeaves.visible = sim.wind.active || sim.wind.warning;
    if (this.windLeaves.visible) {
      const wr = (sim.wind.dir_deg * Math.PI) / 180;
      const posAttr = this.windLeaves.geometry.getAttribute('position') as THREE.BufferAttribute;
      const spd = sim.wind.active ? 16 : 6;
      for (let i = 0; i < posAttr.count; i++) {
        let x = posAttr.getX(i) + Math.cos(wr) * spd * dt;
        let z = posAttr.getZ(i) + Math.sin(wr) * spd * dt;
        if (x > 45) x -= 90;
        if (x < -45) x += 90;
        if (z > 45) z -= 90;
        if (z < -45) z += 90;
        posAttr.setXYZ(i, x, posAttr.getY(i), z);
      }
      posAttr.needsUpdate = true;
    }

    // Pulse ring
    if (this.pulseRingAge < 1) {
      this.pulseRingAge = Math.min(1, this.pulseRingAge + dt * 2.4);
      this.pulseRing.scale.setScalar(1 + this.pulseRingAge * (TUNING.pulse_radius - 1));
      (this.pulseRing.material as THREE.MeshBasicMaterial).opacity =
        (1 - this.pulseRingAge) * 0.78;
    }

    // Rising sky lanterns (visual-only creativity)
    for (let i = this.skyLanterns.length - 1; i >= 0; i--) {
      const s = this.skyLanterns[i];
      s.mesh.position.y += s.speed * dt;
      s.mesh.position.x += Math.sin(this.elapsed + s.wobbleOffset) * 0.35 * dt;
      if (s.mesh.position.y > 54) {
        this.scene.remove(s.mesh);
        this.skyLanterns.splice(i, 1);
      }
    }

    // Third-person camera
    const camDist = 10.2;
    const camHeight = 5.6;
    const targetX = sim.player.pos[0] - Math.sin(yawRad) * camDist;
    const targetZ = sim.player.pos[2] - Math.cos(yawRad) * camDist;
    const targetY = Math.max(-2, sim.player.pos[1]) + camHeight;
    const alpha = 1 - Math.exp(-10 * dt);
    this.camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), alpha);
    this.camera.lookAt(sim.player.pos[0], Math.max(-2, sim.player.pos[1]) + 1.4, sim.player.pos[2]);

    this.renderer.render(this.scene, this.camera);
  }
}
