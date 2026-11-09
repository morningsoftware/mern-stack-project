import { useEffect, useRef } from "react";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import type { Theme } from "../theme";

type Palette = {
  line: { r: number; g: number; b: number };
  rust: { r: number; g: number; b: number };
  rustHex: number;
  opacity: number;
};

type Materials = {
  points: ShaderMaterial;
  markers: ShaderMaterial;
  palette: Palette;
};

type Marker = {
  x: number;
  z: number;
  phase: number;
};

const PALETTES: Record<Theme, Palette> = {
  light: {
    line: { r: 0.35, g: 0.41, b: 0.33 },
    rust: { r: 0.58, g: 0.26, b: 0.15 },
    rustHex: 0x934125,
    opacity: 0.95,
  },
  dark: {
    line: { r: 0.9, g: 0.88, b: 0.79 },
    rust: { r: 0.75, g: 0.42, b: 0.27 },
    rustHex: 0xc06a45,
    opacity: 0.9,
  },
};

const WIDTH = 36;
const DEPTH = 26;

const MARKERS: ReadonlyArray<readonly [number, number]> = [
  [-11, 5],
  [-6, -4],
  [-1, 3],
  [4, -5],
  [8, 2],
  [12, 6],
];

const MARKER_DATA: Marker[] = MARKERS.map(([x, z], index) => ({
  x,
  z,
  phase: index * 1.7,
}));

const RIPPLE_DATA: Marker[] = MARKER_DATA.slice(0, 4);

function surfaceHeight(
  x: number,
  z: number,
  time: number,
  pointerX: number,
  pointerZ: number,
  splash: number
): number {
  let height =
    Math.sin(x * 0.55 + time * 1.1) * 0.55 +
    Math.cos(z * 0.6 + time * 0.85) * 0.45 +
    Math.sin((x + z) * 0.28 - time * 1.4) * 0.3 +
    Math.sin(x * 0.12 - time * 0.6 + z * 0.2) * 0.2;

  for (const marker of RIPPLE_DATA) {
    const dx = x - marker.x;
    const dz = z - marker.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    height +=
      Math.sin(distance * 0.8 - time * 1.5 + marker.phase) *
      Math.exp(-distance * 0.13) *
      0.5;
  }

  const dx = x - pointerX;
  const dz = z - pointerZ;
  const distance = Math.sqrt(dx * dx + dz * dz);
  height +=
    Math.sin(distance * 3.1 - time * 4.8) *
    Math.exp(-distance * 0.5) *
    (1.3 + splash * 1.5);
  return height;
}

function pointMaterial(palette: Palette): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize: { value: 2.2 },
      uPixelRatio: { value: 1 },
      uScale: { value: 18 },
      uTime: { value: 0 },
      uOpacity: { value: palette.opacity },
    },
    vertexShader: `
      attribute vec3 aColor;
      uniform float uSize;
      uniform float uPixelRatio;
      uniform float uScale;
      uniform float uTime;
      varying vec3 vColor;
      varying float vElevation;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float phase = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
        float pulse = 0.9 + 0.12 * sin(uTime * 1.8 + phase * 6.28318);
        gl_PointSize = uSize * uPixelRatio * uScale * pulse / max(0.1, -viewPosition.z);
        vColor = aColor;
        vElevation = position.y;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vElevation;
      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceToCenter = length(point);
        if (distanceToCenter > 0.5) discard;
        float alpha = smoothstep(0.5, 0.12, distanceToCenter);
        float core = smoothstep(0.18, 0.0, distanceToCenter);
        vec3 color = mix(vColor, vColor * 1.15, core);
        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `,
  });
}

function markerMaterial(color: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uColor: { value: new Color(color) },
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: `
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vPulse;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vPulse = 0.65 + 0.35 * sin(uTime * 0.7 + aPhase);
        gl_PointSize = (12.0 + 3.0 * vPulse) * uPixelRatio;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vPulse;
      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceToCenter = length(point);
        if (distanceToCenter > 0.5) discard;
        float ring = smoothstep(0.50, 0.43, distanceToCenter)
          - smoothstep(0.34, 0.28, distanceToCenter);
        float dot = smoothstep(0.16, 0.05, distanceToCenter);
        float alpha = clamp(ring * 0.75 + dot * 0.6, 0.0, 1.0) * vPulse;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function markerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const phases: number[] = [];
  MARKER_DATA.forEach((marker) => {
    positions.push(marker.x, surfaceHeight(marker.x, marker.z, 0, 0, 0, 0) + 0.3, marker.z);
    phases.push(marker.phase);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    "aPhase",
    new Float32BufferAttribute(phases, 1)
  );
  return geometry;
}

export default function AuthBackdrop({ theme }: { theme: Theme }) {
  const host = useRef<HTMLDivElement>(null);
  const materials = useRef<Materials | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }

    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const compact =
      window.matchMedia?.("(max-width: 760px)")?.matches ?? false;
    const columns = compact ? 56 : 96;
    const rows = compact ? 36 : 60;
    const count = columns * rows;
    const palette = PALETTES[themeRef.current];

    const scene = new Scene();
    const camera = new PerspectiveCamera(
      38,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 6.6, 17);
    camera.lookAt(0, -0.4, 0);

    const field = new Group();
    field.position.y = -1;
    scene.add(field);

    const positions = new Float32Array(count * 3);
    const baseX = new Float32Array(count);
    const baseZ = new Float32Array(count);
    const variance = new Float32Array(count);
    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      const z = (row / (rows - 1) - 0.5) * DEPTH;
      for (let column = 0; column < columns; column += 1) {
        const x = (column / (columns - 1) - 0.5) * WIDTH;
        baseX[index] = x;
        baseZ[index] = z;
        variance[index] = Math.random();
        positions[index * 3] = x;
        positions[index * 3 + 2] = z;
        index += 1;
      }
    }

    const geometry = new BufferGeometry();
    const positionAttribute = new Float32BufferAttribute(positions, 3);
    geometry.setAttribute("position", positionAttribute);
    const colorAttribute = new Float32BufferAttribute(
      new Float32Array(count * 3),
      3
    );
    geometry.setAttribute("aColor", colorAttribute);

    const pointsMaterial = pointMaterial(palette);
    const points = new Points(geometry, pointsMaterial);
    points.frustumCulled = false;
    field.add(points);

    const markersMaterial = markerMaterial(palette.rustHex);
    const markersGeometry = markerGeometry();
    const markers = new Points(markersGeometry, markersMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 2;
    field.add(markers);
    materials.current = {
      points: pointsMaterial,
      markers: markersMaterial,
      palette,
    };

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2)
    );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "auth-backdrop-canvas";
    container.appendChild(renderer.domElement);

    const markerAttribute = markersGeometry.getAttribute(
      "position"
    ) as Float32BufferAttribute;
    const positionsArray = positionAttribute.array as Float32Array;
    const colorsArray = colorAttribute.array as Float32Array;

    const updateGeometry = (
      time: number,
      pointerX: number,
      pointerZ: number,
      splash: number
    ): void => {
      const current = materials.current;
      const activePalette = current?.palette ?? palette;
      const line = activePalette.line;
      const rust = activePalette.rust;
      for (let i = 0; i < count; i += 1) {
        const y = surfaceHeight(
          baseX[i],
          baseZ[i],
          time,
          pointerX,
          pointerZ,
          splash
        );
        positionsArray[i * 3 + 1] = y;
        const crest = Math.min(1, Math.max(0, (y + 1.1) * 0.42));
        const shade = 0.82 + variance[i] * 0.28;
        const tint = crest * 0.85;
        colorsArray[i * 3] = (line.r * shade) * (1 - tint) + rust.r * tint;
        colorsArray[i * 3 + 1] =
          (line.g * shade) * (1 - tint) + rust.g * tint;
        colorsArray[i * 3 + 2] =
          (line.b * shade) * (1 - tint) + rust.b * tint;
      }
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;

      MARKER_DATA.forEach((marker, markerIndex) => {
        const x = marker.x + Math.sin(time * 0.42 + marker.phase) * 0.75;
        const z = marker.z + Math.cos(time * 0.33 + marker.phase) * 0.65;
        markerAttribute.setXYZ(
          markerIndex,
          x,
          surfaceHeight(x, z, time, pointerX, pointerZ, 0) + 0.3,
          z
        );
      });
      markerAttribute.needsUpdate = true;
    };

    const renderStatic = (): void => {
      updateGeometry(0, 0, 0, 0);
      renderer.render(scene, camera);
    };

    let frame = 0;
    let active = true;
    let pointerWorldX = 0;
    let pointerWorldZ = 0;
    let targetWorldX = 0;
    let targetWorldZ = 0;
    let tiltX = 0;
    let tiltY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let splash = 0;
    let lastTime = performance.now();
    const start = lastTime;

    const resize = (): void => {
      const size = container.getBoundingClientRect();
      camera.aspect = size.width / Math.max(size.height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height);
      pointsMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      pointsMaterial.uniforms.uScale.value =
        size.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
      markersMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      if (reducedMotion) renderStatic();
    };

    const animate = (now: number): void => {
      if (!active) return;
      const elapsed = (now - start) / 1000;
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      pointerWorldX += (targetWorldX - pointerWorldX) * 0.06;
      pointerWorldZ += (targetWorldZ - pointerWorldZ) * 0.06;
      tiltX += (targetTiltX - tiltX) * 0.06;
      tiltY += (targetTiltY - tiltY) * 0.06;
      splash *= Math.exp(-delta * 2.2);
      updateGeometry(elapsed, pointerWorldX, pointerWorldZ, splash);
      field.rotation.x = -0.09 + Math.sin(elapsed * 0.18) * 0.02 + tiltX;
      field.rotation.y = Math.sin(elapsed * 0.11) * 0.06 + tiltY;
      pointsMaterial.uniforms.uTime.value = elapsed;
      markersMaterial.uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    const onPointer = (event: PointerEvent): void => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      targetTiltY = x * 0.16;
      targetTiltX = y * 0.07;
      targetWorldX = x * WIDTH;
      targetWorldZ = y * DEPTH;
    };

    const onPointerDown = (): void => {
      splash = 1;
    };

    const onPointerLeave = (): void => {
      targetTiltX = 0;
      targetTiltY = 0;
      targetWorldX = 0;
      targetWorldZ = 0;
    };

    const onVisibility = (): void => {
      if (document.hidden) {
        active = false;
        cancelAnimationFrame(frame);
      } else if (!reducedMotion && !active) {
        active = true;
        frame = requestAnimationFrame(animate);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);

    if (reducedMotion) {
      renderStatic();
      frame = requestAnimationFrame(() => {
        if (active) renderStatic();
      });
    } else {
      frame = requestAnimationFrame(animate);
    }

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerleave", onPointerLeave);
      geometry.dispose();
      markersGeometry.dispose();
      pointsMaterial.dispose();
      markersMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      materials.current = null;
    };
  }, []);

  useEffect(() => {
    const current = materials.current;
    if (!current) return;
    const palette = PALETTES[theme];
    current.palette = palette;
    current.points.uniforms.uOpacity.value = palette.opacity;
    current.markers.uniforms.uColor.value.setHex(palette.rustHex);
  }, [theme]);

  return <div ref={host} className="auth-backdrop" aria-hidden="true" />;
}
