import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BrandMark } from "./brand-mark";

/**
 * The EFFIO logo as an object: a bolt of dark brushed metal with an amber
 * rim, throwing sparks where it touches down. It drops in and strikes once,
 * then turns slowly so you can see its depth, with a current running round
 * its edge. Falls back to the flat mark without WebGL.
 */

// same outline as the flat mark (brand-mark.tsx), in the comp's units
const OUTLINE: [number, number][] = [
  [1135, 60],
  [880, 455],
  [1030, 455],
  [945, 745],
  [1235, 300],
  [1080, 300],
];
const S = 3.2 / 685;
const PTS = OUTLINE.map(([x, y]) => new THREE.Vector2((x - 1057.5) * S, -(y - 402.5) * S));
const TIP = PTS[3];
const DEPTH = 0.34;

function webgl() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function brushedTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) {
    const y = Math.random() * 512;
    const v = 100 + Math.random() * 80;
    g.strokeStyle = `rgba(${v},${v},${v},${0.15 + Math.random() * 0.3})`;
    g.lineWidth = Math.random() * 1.6;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y - 60);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.6, 0.6);
  return tex;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,246,225,1)");
  gr.addColorStop(0.18, "rgba(255,200,110,0.8)");
  gr.addColorStop(0.5, "rgba(245,165,36,0.22)");
  gr.addColorStop(1, "rgba(245,165,36,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** the outline as a closed 3D path that starts at the tip, so the rim draws on from where it lands */
function rimPath(z: number) {
  const order = [3, 4, 5, 0, 1, 2, 3];
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < order.length - 1; i++) {
    const a = PTS[order[i]];
    const b = PTS[order[i + 1]];
    path.add(new THREE.LineCurve3(new THREE.Vector3(a.x, a.y, z), new THREE.Vector3(b.x, b.y, z)));
  }
  return path;
}

export function BoltLogo3D({ className = "", focus = [0, 0] as [number, number], scale = 1 }: { className?: string; focus?: [number, number]; scale?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (!webgl()) {
      setFallback(true);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 9.5);

    const rig = new THREE.Group();
    rig.scale.setScalar(scale);
    scene.add(rig);
    const bolt = new THREE.Group();
    rig.add(bolt);

    // the body: extruded, bevelled, brushed dark metal
    const shape = new THREE.Shape(PTS);
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.045, bevelSegments: 4, curveSegments: 1 });
    bodyGeo.translate(0, 0, -DEPTH / 2);
    const brushed = brushedTexture();
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1e23,
      metalness: 0.92,
      roughness: 0.34,
      roughnessMap: brushed,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.55,
    });
    bolt.add(new THREE.Mesh(bodyGeo, bodyMat));

    // amber rim on both faces; it draws on from the tip at the strike
    const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf5a524).multiplyScalar(2.4), toneMapped: false });
    const front = rimPath(DEPTH / 2 + 0.035);
    const back = rimPath(-DEPTH / 2 - 0.035);
    const rimGeoF = new THREE.TubeGeometry(front, 720, 0.024, 8, false);
    const rimGeoB = new THREE.TubeGeometry(back, 720, 0.016, 6, false);
    const rimCountF = rimGeoF.index!.count;
    const rimCountB = rimGeoB.index!.count;
    bolt.add(new THREE.Mesh(rimGeoF, rimMat), new THREE.Mesh(rimGeoB, rimMat));

    // lights: a warm rim from behind, a cool fill from the front, and the spark lighting the bevel
    scene.add(new THREE.AmbientLight(0xffffff, 0.05));
    const key = new THREE.DirectionalLight(0xffb347, 2.2);
    key.position.set(3, 2.5, -2.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fc0dc, 0.5);
    fill.position.set(-3, 1, 4);
    scene.add(fill);
    const tipLight = new THREE.PointLight(0xffa640, 0, 3.2, 1.6);
    tipLight.position.set(TIP.x, TIP.y + 0.05, 0.4);
    bolt.add(tipLight);

    // the spark: a glow plus particles thrown from the tip
    const glowTex = glowTexture();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    glow.position.set(TIP.x, TIP.y, 0.05);
    bolt.add(glow);
    const runner = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    runner.scale.setScalar(0.32);
    bolt.add(runner);

    const N = 260;
    const pPos = new Float32Array(N * 3);
    const pVel = new Float32Array(N * 3);
    const pLife = new Float32Array(N).fill(99);
    const pMax = new Float32Array(N).fill(1);
    const pCol = new Float32Array(N * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    bolt.add(new THREE.Points(pGeo, pMat));
    const amber = new THREE.Color(0xffb02e).multiplyScalar(2);
    const hot = new THREE.Color(0xfff1cf).multiplyScalar(2);
    let cursor = 0;
    const emit = (n: number, power: number) => {
      for (let k = 0; k < n; k++) {
        const i = cursor++ % N;
        const a = Math.random() * Math.PI * 2;
        const up = Math.random();
        const v = power * (0.3 + Math.random());
        pPos.set([TIP.x, TIP.y, 0], i * 3);
        pVel.set([Math.cos(a) * v, (up * 0.9 - 0.2) * v, Math.sin(a) * v * 0.6], i * 3);
        pLife[i] = 0;
        pMax[i] = 0.3 + Math.random() * 0.7;
      }
    };

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.4, 0.7);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.setViewOffset(w, h, -focus[0] * w * 0.5, -focus[1] * h * 0.5, w, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let running = true;
    const io = new IntersectionObserver(([e]) => (running = e.isIntersecting));
    io.observe(el);

    const DROP = 0.5; // it lands at 0.5 s
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    let t = reduce ? 8 : 0;
    let struck = reduce;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!running || document.hidden) return;
      if (!reduce) t += dt;

      // the drop: falls fast from above, turning into place
      const fall = clamp(t / DROP);
      const eased = fall * fall * fall;
      bolt.position.y = (1 - eased) * 5;
      if (!struck && t >= DROP) {
        struck = true;
        emit(200, 2.6);
      }
      const since = Math.max(0, t - DROP);
      const impact = t >= DROP ? Math.exp(-since * 3) : 0;

      // after landing: a slow turn that shows the depth, a little float, the pointer
      const idle = clamp(since / 1.5);
      const turn = reduce ? -0.35 : Math.sin(since * 0.4) * 0.42 * idle - 0.25 * (1 - idle) + pointer.x * 0.18;
      bolt.rotation.y += (turn + (1 - eased) * 0.8 - bolt.rotation.y) * 0.08;
      bolt.rotation.x += ((reduce ? 0 : pointer.y * 0.1) - bolt.rotation.x) * 0.05;
      if (fall >= 1 && !reduce) bolt.position.y = Math.sin(since * 0.9) * 0.04 * idle - impact * 0.06;

      // the rim draws on from the tip, then stays
      const draw = reduce ? 1 : clamp((since - 0.05) / 0.9);
      rimGeoF.setDrawRange(0, Math.floor((rimCountF * draw) / 3) * 3);
      rimGeoB.setDrawRange(0, Math.floor((rimCountB * draw) / 3) * 3);

      // the spark: a big flash on impact, then a crackle that never quite stops
      const crackle = 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.7);
      glow.material.opacity = t >= DROP ? Math.min(1, 0.7 * crackle + impact) : 0;
      glow.scale.setScalar(0.7 + impact * 1.6 + 0.08 * crackle);
      tipLight.intensity = t >= DROP ? 4 * crackle + impact * 30 : 0;
      bloom.strength = 0.55 + impact * 1.4;
      if (struck && !reduce && Math.random() < 0.45) emit(1 + Math.floor(Math.random() * 2), 0.9);

      // a current runs round the edge every 5 s
      const c = since - 1.4;
      if (c > 0 && !reduce) {
        const p = (c % 5) / 2.2;
        if (p < 1) {
          runner.position.copy(front.getPointAt(p));
          runner.material.opacity = Math.sin(p * Math.PI);
        } else runner.material.opacity = 0;
      }

      for (let i = 0; i < N; i++) {
        if (pLife[i] > pMax[i]) {
          pCol.set([0, 0, 0], i * 3);
          continue;
        }
        pLife[i] += dt;
        pVel[i * 3 + 1] -= 4.5 * dt;
        pPos[i * 3] += pVel[i * 3] * dt;
        pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
        pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        const a = 1 - pLife[i] / pMax[i];
        const col = i % 3 === 0 ? hot : amber;
        pCol.set([col.r * a, col.g * a, col.b * a], i * 3);
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;

      composer.render();
      if (reduce) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      composer.dispose();
      pmrem.dispose();
      env.dispose();
      brushed.dispose();
      glowTex.dispose();
      bodyGeo.dispose();
      rimGeoF.dispose();
      rimGeoB.dispose();
      pGeo.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [focus[0], focus[1], scale]);

  return (
    <div ref={host} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {fallback && (
        <div className="absolute" style={{ left: `calc(50% + ${focus[0] * 50}% - 15vmin)`, top: `calc(50% - ${focus[1] * 50}% - 15vmin)` }}>
          <BrandMark size={Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.3)} />
        </div>
      )}
    </div>
  );
}
