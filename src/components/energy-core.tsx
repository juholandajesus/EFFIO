import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * EFFIO's energy core: a plasma sphere held by a sodium-amber ring, with
 * Faísca-blue sparks orbiting it. It "powers up" once on load (the single
 * orchestrated moment), then idles and follows the pointer a little.
 * Renders a static glow instead when WebGL or motion are unavailable.
 */

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const coreVertex = /* glsl */ `
uniform float uTime; uniform float uPower;
varying vec3 vNormal; varying vec3 vView; varying float vNoise;
${NOISE}
void main(){
  float n = snoise(normal*1.6 + vec3(0.0, uTime*0.35, uTime*0.2));
  vNoise = n;
  vec3 pos = position + normal * n * 0.025 * uPower;
  vec4 mv = modelViewMatrix * vec4(pos,1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const coreFragment = /* glsl */ `
uniform float uTime; uniform float uPower;
varying vec3 vNormal; varying vec3 vView; varying float vNoise;
${NOISE}
void main(){
  float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.4);
  float bands = snoise(vNormal*2.1 + vec3(uTime*0.45, -uTime*0.3, 0.0));
  vec3 amber = vec3(0.98, 0.52, 0.06);
  vec3 hot = vec3(1.0, 0.92, 0.75);
  vec3 arc = vec3(0.56, 0.85, 1.0);
  float b = smoothstep(0.2, 1.0, bands*0.5+0.5 + vNoise*0.35);
  float facing = max(dot(vNormal, vView), 0.0);
  vec3 col = mix(vec3(0.55, 0.18, 0.02), amber, b);       // ember -> plasma
  col = mix(col, hot, pow(b, 5.0) * 0.7 + pow(facing, 6.0) * 0.35); // hot filaments and a bright heart
  col = mix(col, arc, fres * 0.55);                       // Faísca-blue rim
  gl_FragColor = vec4(col * (0.2 + 0.62 * uPower), 1.0);
}`;

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function EnergyCore({ className = "", focus = [0.55, 0] as [number, number], scale = 1 }: { className?: string; focus?: [number, number]; scale?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (!webglAvailable()) {
      setFallback(true);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090c10, 0.03);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.4, 9);

    const rig = new THREE.Group();
    rig.scale.setScalar(scale);
    scene.add(rig);

    // plasma core
    const coreMat = new THREE.ShaderMaterial({ vertexShader: coreVertex, fragmentShader: coreFragment, uniforms: { uTime: { value: 0 }, uPower: { value: 0 } } });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 64), coreMat);
    rig.add(core);

    // the ring (brand amber) and a thinner counter-ring (Faísca blue)
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf5a524).multiplyScalar(1.6), transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.028, 16, 220), ringMat);
    ring.rotation.set(Math.PI * 0.42, 0.25, 0);
    rig.add(ring);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fd8ff).multiplyScalar(1.3), transparent: true, opacity: 0 });
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.008, 8, 260), ring2Mat);
    ring2.rotation.set(Math.PI * 0.55, -0.35, 0.4);
    rig.add(ring2);

    // orbiting sparks: a disc of particles that drifts around the core
    const N = 1400;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const amber = new THREE.Color(0xf5a524);
    const arc = new THREE.Color(0x8fd8ff);
    for (let i = 0; i < N; i++) {
      const r = 1.7 + Math.pow(Math.random(), 1.6) * 3.4;
      const a = Math.random() * Math.PI * 2;
      seed[i * 3] = r;
      seed[i * 3 + 1] = a;
      seed[i * 3 + 2] = (Math.random() - 0.5) * 0.5 * (r / 2);
      const c = Math.random() < 0.7 ? arc : amber;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.03, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(pGeo, pMat);
    points.rotation.x = Math.PI * 0.42;
    rig.add(points);

    // post: bloom makes it read as light, not as a ball
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.35, 0.6);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      camera.aspect = w / h;
      // keep the core at the requested spot of the frame (x in -1..1 screen space)
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

    let visible = true;
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
    io.observe(el);

    const start = performance.now();
    let raf = 0;
    const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = reduce ? 6 : (now - start) / 1000;
      const power = ease(t / 2.6); // power-up over ~2.6s
      coreMat.uniforms.uTime.value = t;
      coreMat.uniforms.uPower.value = power;
      ringMat.opacity = ease((t - 0.6) / 1.4);
      ring2Mat.opacity = ease((t - 1.2) / 1.6) * 0.8;
      pMat.opacity = ease((t - 0.9) / 2) * 0.9;
      // the ring spins up, then settles to an idle turn
      const spin = reduce ? 0 : 0.12 + 1.6 * Math.exp(-t * 0.9);
      ring.rotation.z += spin * 0.016;
      ring2.rotation.z -= spin * 0.009;
      core.rotation.y += reduce ? 0 : 0.0016;
      for (let i = 0; i < N; i++) {
        const r = seed[i * 3];
        const a = seed[i * 3 + 1] + t * (0.5 / r) * (reduce ? 0 : 1);
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = Math.sin(a) * r;
        pos[i * 3 + 2] = seed[i * 3 + 2] + Math.sin(t * 0.8 + r * 3) * 0.03;
      }
      pGeo.attributes.position.needsUpdate = true;
      bloom.strength = 0.25 + 0.4 * power;
      // a little parallax with the pointer
      rig.rotation.y += ((reduce ? 0 : pointer.x * 0.25) - rig.rotation.y) * 0.04;
      rig.rotation.x += ((reduce ? 0 : pointer.y * 0.15) - rig.rotation.x) * 0.04;
      composer.render();
      if (reduce && t >= 6) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      composer.dispose();
      renderer.dispose();
      pGeo.dispose();
      coreMat.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [focus[0], focus[1], scale]);

  return (
    <div ref={host} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {fallback && (
        <div
          className="absolute rounded-full"
          style={{
            width: "36vmin",
            height: "36vmin",
            left: `calc(50% + ${focus[0] * 50}% - 18vmin)`,
            top: `calc(50% - ${focus[1] * 50}% - 18vmin)`,
            background: "radial-gradient(circle, #fff3d6 0%, #f5a524 30%, rgba(245,165,36,0.15) 60%, transparent 70%)",
            boxShadow: "0 0 120px 40px rgba(143,216,255,0.15)",
          }}
        />
      )}
    </div>
  );
}
