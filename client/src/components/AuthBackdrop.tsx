import { useEffect, useRef } from "react";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import type { Theme } from "../theme";

type Materials = {
  rows: LineBasicMaterial;
  columns: LineBasicMaterial;
  markers: ShaderMaterial;
};

const COLORS = {
  light: {
    line: 0x5e6759,
    rowOpacity: 0.3,
    columnOpacity: 0.11,
    marker: 0x934125,
  },
  dark: {
    line: 0xe7e0c9,
    rowOpacity: 0.25,
    columnOpacity: 0.08,
    marker: 0xc06a45,
  },
};

const MARKER_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-11, 5],
  [-6, -4],
  [-1, 3],
  [4, -5],
  [8, 2],
  [12, 6],
];

function heightAt(x: number, z: number): number {
  return (
    Math.sin(x * 0.28 + Math.cos(z * 0.19) * 1.4) * 0.55 +
    Math.cos(z * 0.33 + x * 0.08) * 0.32 +
    Math.sin((x + z) * 0.15) * 0.28
  );
}

function terrainGeometry(
  columns: number,
  rows: number,
  width: number,
  depth: number
): BufferGeometry {
  const positions: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const z = (row / rows - 0.5) * depth;
    for (let column = 0; column < columns; column += 1) {
      const x1 = (column / columns - 0.5) * width;
      const x2 = ((column + 1) / columns - 0.5) * width;
      positions.push(
        x1,
        heightAt(x1, z),
        z,
        x2,
        heightAt(x2, z),
        z
      );
    }
  }
  return geometryFrom(positions);
}

function crossGeometry(
  columns: number,
  rows: number,
  width: number,
  depth: number
): BufferGeometry {
  const positions: number[] = [];
  for (let column = 0; column <= columns; column += 1) {
    const x = (column / columns - 0.5) * width;
    for (let row = 0; row < rows; row += 1) {
      const z1 = (row / rows - 0.5) * depth;
      const z2 = ((row + 1) / rows - 0.5) * depth;
      positions.push(
        x,
        heightAt(x, z1),
        z1,
        x,
        heightAt(x, z2),
        z2
      );
    }
  }
  return geometryFrom(positions);
}

function geometryFrom(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3)
  );
  return geometry;
}

function markerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const phases: number[] = [];
  MARKER_POINTS.forEach(([x, z], index) => {
    positions.push(x, heightAt(x, z) + 0.2, z);
    phases.push(index * 1.7);
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
        gl_PointSize = (11.0 + 3.0 * vPulse) * uPixelRatio;
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
    const width = 34;
    const depth = 24;
    const columnCount = compact ? 58 : 92;
    const rowCount = compact ? 38 : 60;
    const palette = COLORS[themeRef.current];

    const scene = new Scene();
    const camera = new PerspectiveCamera(
      36,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 7.2, 19);
    camera.lookAt(0, 0, 0);

    const terrain = new Group();
    terrain.position.y = -0.9;
    scene.add(terrain);

    const rowsMaterial = new LineBasicMaterial({
      color: palette.line,
      transparent: true,
      opacity: palette.rowOpacity,
      depthWrite: false,
    });
    const columnsMaterial = new LineBasicMaterial({
      color: palette.line,
      transparent: true,
      opacity: palette.columnOpacity,
      depthWrite: false,
    });
    const rowsGeometry = terrainGeometry(
      columnCount,
      rowCount,
      width,
      depth
    );
    const columnsGeometry = crossGeometry(
      columnCount,
      rowCount,
      width,
      depth
    );
    terrain.add(new LineSegments(rowsGeometry, rowsMaterial));
    terrain.add(new LineSegments(columnsGeometry, columnsMaterial));

    const markersMaterial = markerMaterial(palette.marker);
    const markers = new Points(markerGeometry(), markersMaterial);
    markers.renderOrder = 2;
    terrain.add(markers);
    materials.current = {
      rows: rowsMaterial,
      columns: columnsMaterial,
      markers: markersMaterial,
    };

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2)
    );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "auth-backdrop-canvas";
    container.appendChild(renderer.domElement);

    let frame = 0;
    let active = true;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    const start = performance.now();

    const resize = (): void => {
      const size = container.getBoundingClientRect();
      camera.aspect = size.width / Math.max(size.height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height);
      markersMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    };

    const animate = (now: number): void => {
      if (!active) return;
      const elapsed = (now - start) / 1000;
      pointerX += (targetX - pointerX) * 0.04;
      pointerY += (targetY - pointerY) * 0.04;
      terrain.rotation.y = Math.sin(elapsed * 0.07) * 0.04 + pointerX;
      terrain.rotation.x = -0.04 + Math.sin(elapsed * 0.11) * 0.01 + pointerY;
      terrain.position.y = -0.9 + Math.sin(elapsed * 0.22) * 0.05;
      markersMaterial.uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    const onPointer = (event: PointerEvent): void => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 0.09;
      targetY = (event.clientY / window.innerHeight - 0.5) * 0.05;
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

    if (reducedMotion) {
      renderer.render(scene, camera);
    } else {
      frame = requestAnimationFrame(animate);
    }

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      rowsGeometry.dispose();
      columnsGeometry.dispose();
      markers.geometry.dispose();
      rowsMaterial.dispose();
      columnsMaterial.dispose();
      markersMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      materials.current = null;
    };
  }, []);

  useEffect(() => {
    const current = materials.current;
    if (!current) return;
    const palette = COLORS[theme];
    current.rows.color.setHex(palette.line);
    current.rows.opacity = palette.rowOpacity;
    current.columns.color.setHex(palette.line);
    current.columns.opacity = palette.columnOpacity;
    current.markers.uniforms.uColor.value.setHex(palette.marker);
  }, [theme]);

  return <div ref={host} className="auth-backdrop" aria-hidden="true" />;
}
