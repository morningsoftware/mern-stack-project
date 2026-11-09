import { useEffect, useRef } from "react";
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { Theme } from "../theme";

/**
 * Lazy-loaded three.js scene shown behind the signed-out form.
 *
 * This file is intentionally boilerplate: the renderer, camera, resize
 * handling, reduced-motion behavior, visibility pausing, pointer hooks, and
 * cleanup are wired up. Build your own scene inside the marked TODOs.
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

    const scene = new Scene();
    const camera = new PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 7, 20);
    camera.lookAt(0, 2, 0);

    // TODO: add your lights, geometry, and materials here.

    let frame = 0;
    let active = true;
    let lastTime = performance.now();

    const renderOnce = (): void => {
      renderer.render(scene, camera);
    };

    const resize = (): void => {
      const size = container.getBoundingClientRect();
      camera.aspect = size.width / Math.max(size.height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height);
      if (reducedMotion) renderOnce();
    };

    const animate = (now: number): void => {
      if (!active) return;
      // TODO: update your scene here using (now - lastTime) as the delta.
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    const onPointer = (event: PointerEvent): void => {
      // TODO: react to pointer position, e.g. camera parallax or interaction.
      void event;
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

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2)
    );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "auth-backdrop-canvas";
    container.appendChild(renderer.domElement);

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
      // TODO: dispose any geometry, materials, and textures you create.
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="auth-backdrop" aria-hidden="true" />;
}
