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

type Marker = {
  x: number;
  z: number;
  phase: number;
};

const COLORS = {
  light: {
    line: 0x5e6759,
    rowOpacity: 0.32,
    columnOpacity: 0.12,
    marker: 0x934125,
  },
  dark: {
    line: 0xe7e0c9,
    rowOpacity: 0.28,
    columnOpacity: 0.09,
    marker: 0xc06a45,
  },
};

const WIDTH = 34;
const DEPTH = 24;

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

function heightAt(
  x: number,
  z: number,
  time: number,
  pointerX: number,
  pointerZ: number
): number {
  const drift = time * 0.22;
  let height =
    Math.sin(x * 0.26 + drift + Math.cos(z * 0.17 - drift * 0.6) * 1.35) *
      0.55 +
    Math.cos(z * 0.31 - drift * 0.8 + x * 0.09) * 0.34 +
    Math.sin((x + z) * 0.16 + drift * 1.25) * 0.24 +
    Math.sin(Math.sqrt(x * x + z * z) * 0.55 - drift * 2.1) * 0.12;

  for (const marker of MARKER_DATA) {
    const dx = x - marker.x;
    const dz = z - marker.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    height +=
      Math.sin(distance * 0.9 - time * 1.6 + marker.phase) *
      Math.exp(-distance * 0.14) *
      0.42;
  }

  const pointerDistance =
    (x - pointerX) * (x - pointerX) + (z - pointerZ) * (z - pointerZ);
  height +=
    Math.exp(-pointerDistance / 9) *
    (0.62 + Math.sin(time * 2.4) * 0.18);
  return height;
}

function geometryFrom(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3)
  );
  return geometry;
}

function rowGeometry(
  columns: number,
  rows: number,
  heights: Float32Array
): BufferGeometry {
  const positions: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const z = (row / rows - 0.5) * DEPTH;
    for (let column = 0; column < columns; column += 1) {
      const x1 = (column / columns - 0.5) * WIDTH;
      const x2 = ((column + 1) / columns - 0.5) * WIDTH;
      const index = row * (columns + 1) + column;
      positions.push(x1, heights[index], z, x2, heights[index + 1], z);
    }
  }
  return geometryFrom(positions);
}

function columnGeometry(
  columns: number,
  rows: number,
  heights: Float32Array
): BufferGeometry {
  const positions: number[] = [];
  for (let column = 0; column <= columns; column += 1) {
    const x = (column / columns - 0.5) * WIDTH;
    for (let row = 0; row < rows; row += 1) {
      const z1 = (row / rows - 0.5) * DEPTH;
      const z2 = ((row + 1) / rows - 0.5) * DEPTH;
      const index = row * (columns + 1) + column;
      positions.push(
        x,
        heights[index],
        z1,
        x,
        heights[index + columns + 1],
        z2
      );
    }
  }
  return geometryFrom(positions);
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

function markerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const phases: number[] = [];
  MARKER_DATA.forEach((marker) => {
    positions.push(
      marker.x,
      heightAt(marker.x, marker.z, 0, 0, 0) + 0.2,
      marker.z
    );
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
    const columns = compact ? 54 : 92;
    const rows = compact ? 34 : 60;
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

    const heights = new Float32Array((columns + 1) * (rows + 1));
    const updateHeights = (
      time: number,
      pointerX: number,
      pointerZ: number
    ): void => {
      for (let row = 0; row <= rows; row += 1) {
        const z = (row / rows - 0.5) * DEPTH;
        for (let column = 0; column <= columns; column += 1) {
          const x = (column / columns - 0.5) * WIDTH;
          heights[row * (columns + 1) + column] = heightAt(
            x,
            z,
            time,
            pointerX,
            pointerZ
          );
        }
      }
    };
    updateHeights(0, 0, 0);

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
    const rowMeshGeometry = rowGeometry(columns, rows, heights);
    const columnMeshGeometry = columnGeometry(columns, rows, heights);
    const rowsMesh = new LineSegments(rowMeshGeometry, rowsMaterial);
    const columnsMesh = new LineSegments(
      columnMeshGeometry,
      columnsMaterial
    );
    rowsMesh.frustumCulled = false;
    columnsMesh.frustumCulled = false;
    terrain.add(rowsMesh, columnsMesh);

    const markersMaterial = markerMaterial(palette.marker);
    const markersGeometry = markerGeometry();
    const markers = new Points(markersGeometry, markersMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 2;
    terrain.add(markers);
    materials.current = {
      rows: rowsMaterial,
      columns: columnsMaterial,
      markers: markersMaterial,
    };

    const rowsAttribute = rowMeshGeometry.getAttribute(
      "position"
    ) as Float32BufferAttribute;
    const columnsAttribute = columnMeshGeometry.getAttribute(
      "position"
    ) as Float32BufferAttribute;
    const markerAttribute = markersGeometry.getAttribute(
      "position"
    ) as Float32BufferAttribute;
    const rowsArray = rowsAttribute.array as Float32Array;
    const columnsArray = columnsAttribute.array as Float32Array;

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2)
    );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "auth-backdrop-canvas";
    container.appendChild(renderer.domElement);

    const updateGeometry = (
      time: number,
      pointerX: number,
      pointerZ: number
    ): void => {
      updateHeights(time, pointerX, pointerZ);
      let rowVertex = 0;
      for (let row = 0; row <= rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * (columns + 1) + column;
          rowsArray[rowVertex + 1] = heights[index];
          rowsArray[rowVertex + 4] = heights[index + 1];
          rowVertex += 6;
        }
      }
      let columnVertex = 0;
      for (let column = 0; column <= columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
          const index = row * (columns + 1) + column;
          columnsArray[columnVertex + 1] = heights[index];
          columnsArray[columnVertex + 4] =
            heights[index + columns + 1];
          columnVertex += 6;
        }
      }
      rowsAttribute.needsUpdate = true;
      columnsAttribute.needsUpdate = true;

      MARKER_DATA.forEach((marker, index) => {
        const x = marker.x + Math.sin(time * 0.42 + marker.phase) * 0.75;
        const z = marker.z + Math.cos(time * 0.33 + marker.phase) * 0.65;
        markerAttribute.setXYZ(
          index,
          x,
          heightAt(x, z, time, pointerX, pointerZ) + 0.2,
          z
        );
      });
      markerAttribute.needsUpdate = true;
    };

    const renderStatic = (): void => {
      updateGeometry(0, 0, 0);
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
    const start = performance.now();

    const resize = (): void => {
      const size = container.getBoundingClientRect();
      camera.aspect = size.width / Math.max(size.height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height);
      markersMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      if (reducedMotion) renderStatic();
    };

    const animate = (now: number): void => {
      if (!active) return;
      const elapsed = (now - start) / 1000;
      pointerWorldX += (targetWorldX - pointerWorldX) * 0.055;
      pointerWorldZ += (targetWorldZ - pointerWorldZ) * 0.055;
      tiltX += (targetTiltX - tiltX) * 0.055;
      tiltY += (targetTiltY - tiltY) * 0.055;
      updateGeometry(elapsed, pointerWorldX, pointerWorldZ);
      terrain.rotation.x = -0.05 + Math.sin(elapsed * 0.17) * 0.02 + tiltX;
      terrain.rotation.y = Math.sin(elapsed * 0.1) * 0.07 + tiltY;
      terrain.position.y = -0.9 + Math.sin(elapsed * 0.27) * 0.07;
      markersMaterial.uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    const onPointer = (event: PointerEvent): void => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      targetTiltY = x * 0.18;
      targetTiltX = y * 0.08;
      targetWorldX = x * WIDTH;
      targetWorldZ = y * DEPTH;
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
      rowMeshGeometry.dispose();
      columnMeshGeometry.dispose();
      markersGeometry.dispose();
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
