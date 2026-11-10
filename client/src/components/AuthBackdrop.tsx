import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Theme } from "../theme";
import vertexShader from "../shaders/authBackdrop.vert.glsl";
import fragmentShader from "../shaders/authBackdrop.frag.glsl";

/**
 * Lazy-loaded three.js scene shown behind the signed-out form.
 * Draw your visuals in `src/shaders/authBackdrop.frag.ts`.
 */
export default function AuthBackdrop({ theme }: { theme: Theme }) {
  const host = useRef<HTMLDivElement>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }

    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const compact =
      window.matchMedia?.("(max-width: 760px)")?.matches ?? false;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uMouse: { value: new THREE.Vector2() },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    quad.renderOrder = -1;
    scene.add(quad);

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2)
    );
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "auth-backdrop-canvas";
    container.appendChild(renderer.domElement);

    const clock = new THREE.Clock();
    let frame = 0;
    let active = true;

    const renderOnce = (): void => {
      renderer.render(scene, camera);
    };

    const resize = (): void => {
      const size = container.getBoundingClientRect();
      renderer.setSize(size.width, size.height);
      uniforms.uResolution.value.set(
        size.width * renderer.getPixelRatio(),
        size.height * renderer.getPixelRatio()
      );
      if (reducedMotion) renderOnce();
    };

    const animate = (): void => {
      if (!active) return;
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    const onPointer = (event: PointerEvent): void => {
      // Stored in device pixels to match gl_FragCoord.
      uniforms.uMouse.value.set(
        event.clientX * renderer.getPixelRatio(),
        event.clientY * renderer.getPixelRatio()
      );
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
      renderOnce();
      frame = requestAnimationFrame(() => {
        if (active) renderOnce();
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
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [vertexShader, fragmentShader]);

  return <div ref={host} className="auth-backdrop" aria-hidden="true" />;
}
