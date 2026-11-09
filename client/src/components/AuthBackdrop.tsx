import { useEffect, useRef } from "react";
import {
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { Theme } from "../theme";

type ScenePalette = {
  colors: string[];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  dirIntensity: number;
};

type Materials = {
  cells: MeshLambertMaterial[];
  hemi: HemisphereLight;
  dir: DirectionalLight;
  palette: ScenePalette;
};

type Cell = {
  mesh: Mesh;
  colorIndex: number;
};

type FallingPiece = {
  col: number;
  row: number;
  colorIndex: number;
  cells: ReadonlyArray<readonly [number, number]>;
  visualY: number;
};

const PALETTES: Record<Theme, ScenePalette> = {
  light: {
    colors: ["#93a087", "#58604e", "#a9532f", "#d9cb98", "#6f7a68"],
    hemiSky: 0xfff7e6,
    hemiGround: 0x8b9488,
    hemiIntensity: 0.85,
    dirIntensity: 0.8,
  },
  dark: {
    colors: ["#8fa08a", "#7c8f78", "#c06a45", "#e7dba9", "#aab4a4"],
    hemiSky: 0xf4efe0,
    hemiGround: 0x2c3a30,
    hemiIntensity: 0.55,
    dirIntensity: 0.6,
  },
};

const SHAPES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 0],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
];

const CELL = 2.0;
const STEP_SECONDS = 0.22;
const SPAWN_SECONDS = 0.85;

function rotateCells(
  cells: ReadonlyArray<readonly [number, number]>
): ReadonlyArray<readonly [number, number]> {
  const rotated = cells.map(([row, column]) => [column, 3 - row] as const);
  const minRow = Math.min(...rotated.map((cell) => cell[0]));
  const minColumn = Math.min(...rotated.map((cell) => cell[1]));
  return rotated.map(
    ([row, column]) => [row - minRow, column - minColumn] as const
  );
}

function seededRandom(): () => number {
  let seed = 0x2f6e2b;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
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
    const columns = compact ? 10 : 14;
    const rows = compact ? 12 : 18;
    const stepSeconds = compact ? 0.26 : STEP_SECONDS;
    const spawnSeconds = compact ? 1.1 : SPAWN_SECONDS;
    const palette = PALETTES[themeRef.current];

    const scene = new Scene();
    const camera = new PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 7, 20);
    camera.lookAt(0, 3, 0);

    const board = new Group();
    board.position.set(0, -6.5, 0);
    scene.add(board);

    const hemi = new HemisphereLight(
      palette.hemiSky,
      palette.hemiGround,
      palette.hemiIntensity
    );
    const dir = new DirectionalLight(0xfff2dd, palette.dirIntensity);
    dir.position.set(6, 12, 8);
    scene.add(hemi, dir);

    const boxGeometry = new BoxGeometry(CELL * 0.96, CELL * 0.96, CELL * 0.96);
    const cellMaterials = palette.colors.map(
      (color) => new MeshLambertMaterial({ color, flatShading: true })
    );
    materials.current = { cells: cellMaterials, hemi, dir, palette };

    const grid: Array<Array<Cell | null>> = Array.from(
      { length: rows },
      () => Array.from({ length: columns }, () => null)
    );
    const clearing: Array<{ mesh: Mesh; until: number }> = [];
    const pieceGroup = new Group();
    const pieceMeshes = Array.from({ length: 4 }, () => {
      const mesh = new Mesh(boxGeometry, cellMaterials[0]);
      mesh.visible = false;
      pieceGroup.add(mesh);
      return mesh;
    });
    pieceGroup.position.z = 0.4;
    board.add(pieceGroup);

    let falling: FallingPiece | null = null;
    let colorCounter = 0;
    let spawnTimer = spawnSeconds;
    let stepAccumulator = 0;
    let targetColumn = Math.floor(columns / 2) - 2;
    let targetCameraX = 0;
    let cameraX = 0;
    let tiltX = 0;
    let tiltY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let active = true;
    let frame = 0;
    let lastTime = performance.now();
    const start = lastTime;

    const random = seededRandom();
    const columnWidth = (cells: FallingPiece["cells"]): number =>
      Math.max(...cells.map((cell) => cell[1])) + 1;

    const worldX = (column: number): number =>
      (column + 0.5 - columns / 2) * CELL;

    const collides = (
      cells: FallingPiece["cells"],
      column: number,
      row: number
    ): boolean =>
      cells.some(([cellRow, cellColumn]) => {
        const gridRow = row + cellRow;
        const gridColumn = column + cellColumn;
        if (gridColumn < 0 || gridColumn >= columns) return true;
        if (gridRow < 0) return true;
        if (gridRow < rows && grid[gridRow][gridColumn]) return true;
        return false;
      });

    const addCell = (
      gridColumn: number,
      gridRow: number,
      colorIndex: number
    ): void => {
      const mesh = new Mesh(boxGeometry, cellMaterials[colorIndex]);
      mesh.position.set(
        worldX(gridColumn),
        (gridRow + 0.5) * CELL,
        (random() - 0.5) * 0.5
      );
      board.add(mesh);
      grid[gridRow][gridColumn] = { mesh, colorIndex };
    };

    const removePiece = (): void => {
      falling = null;
      pieceMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
    };

    const clearBoard = (): void => {
      grid.forEach((rowCells, row) => {
        rowCells.forEach((cell, column) => {
          if (!cell) return;
          clearing.push({ mesh: cell.mesh, until: lastTime + 0.22 });
          grid[row][column] = null;
        });
      });
    };

    const collapseRows = (): void => {
      for (let column = 0; column < columns; column += 1) {
        const remaining: Cell[] = [];
        for (let row = 0; row < rows; row += 1) {
          const cell = grid[row][column];
          if (cell) remaining.push(cell);
        }
        for (let row = 0; row < rows; row += 1) {
          grid[row][column] = remaining[row] ?? null;
        }
        remaining.forEach((cell, row) => {
          cell.mesh.position.y = (row + 0.5) * CELL;
        });
      }
    };

    const checkRows = (): void => {
      let cleared = false;
      for (let row = 0; row < rows; row += 1) {
        const full = grid[row].every((cell) => cell !== null);
        if (!full) continue;
        cleared = true;
        grid[row].forEach((cell, column) => {
          if (!cell) return;
          clearing.push({ mesh: cell.mesh, until: lastTime + 0.2 });
          grid[row][column] = null;
        });
      }
      if (cleared) collapseRows();
    };

    const lockPiece = (): void => {
      if (!falling) return;
      for (const [cellRow, cellColumn] of falling.cells) {
        const gridRow = falling.row + cellRow;
        if (gridRow >= rows) {
          clearBoard();
          removePiece();
          return;
        }
        addCell(falling.col + cellColumn, gridRow, falling.colorIndex);
      }
      removePiece();
      checkRows();
    };

    const spawn = (): void => {
      if (falling) return;
      const cells = SHAPES[Math.floor(random() * SHAPES.length)];
      const width = columnWidth(cells);
      const column = Math.min(
        columns - width,
        2 + Math.floor(random() * Math.max(1, columns - width - 4))
      );
      const colorIndex = colorCounter++ % cellMaterials.length;
      const piece: FallingPiece = {
        col: column,
        row: rows + 2,
        colorIndex,
        cells,
        visualY: (rows + 2) * CELL,
      };
      falling = piece;
      pieceMeshes.forEach((mesh, index) => {
        mesh.visible = true;
        mesh.material = cellMaterials[colorIndex];
        const [cellRow, cellColumn] = piece.cells[index];
        mesh.position.set(
          worldX(column + cellColumn),
          (cellRow + 0.5) * CELL,
          0
        );
      });
    };

    const updatePiece = (): void => {
      if (!falling) return;
      const piece = falling;
      const targetY = piece.row * CELL;
      piece.visualY += (targetY - piece.visualY) * 0.35;
      pieceGroup.position.set(0, piece.visualY, 0.4);
      pieceMeshes.forEach((mesh, index) => {
        const [cellRow, cellColumn] = piece.cells[index];
        mesh.position.set(
          worldX(piece.col + cellColumn),
          (cellRow + 0.5) * CELL,
          0
        );
      });
    };

    const updateFalling = (delta: number): void => {
      if (!falling) return;
      stepAccumulator += delta;
      while (stepAccumulator >= stepSeconds) {
        stepAccumulator -= stepSeconds;
        if (collides(falling.cells, falling.col, falling.row - 1)) {
          lockPiece();
          break;
        }
        falling.row -= 1;
      }
      updatePiece();
    };

    const updateClearing = (now: number): void => {
      for (let index = clearing.length - 1; index >= 0; index -= 1) {
        const entry = clearing[index];
        const remaining = Math.max(0, (entry.until - now) / 0.2);
        entry.mesh.scale.setScalar(Math.max(0.001, remaining));
        if (remaining <= 0) {
          board.remove(entry.mesh);
          clearing.splice(index, 1);
        }
      }
    };

    let staticBuilt = false;
    const renderStatic = (): void => {
      // A calm seeded stack so reduced motion still shows the scene.
      if (!staticBuilt) {
        staticBuilt = true;
        for (let row = 0; row < 7; row += 1) {
          const gaps = new Set<number>();
          const gapCount = 1 + Math.floor(random() * 2);
          for (let gap = 0; gap < gapCount; gap += 1) {
            gaps.add(Math.floor(random() * columns));
          }
          for (let column = 0; column < columns; column += 1) {
            if (gaps.has(column)) continue;
            addCell(column, row, Math.floor(random() * cellMaterials.length));
          }
        }
      }
      renderer.render(scene, camera);
    };

    const resize = (): void => {
      const size = container.getBoundingClientRect();
      camera.aspect = size.width / Math.max(size.height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height);
      if (reducedMotion) renderStatic();
    };

    const animate = (now: number): void => {
      if (!active) return;
      const elapsed = (now - start) / 1000;
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      spawnTimer -= delta;
      if (spawnTimer <= 0) {
        spawnTimer = spawnSeconds;
        spawn();
      }
      updateFalling(delta);
      updateClearing(now);
      cameraX += (targetCameraX - cameraX) * 0.05;
      tiltX += (targetTiltX - tiltX) * 0.05;
      tiltY += (targetTiltY - tiltY) * 0.05;
      camera.position.x = cameraX;
      board.rotation.x = 0.06 + tiltX;
      board.rotation.y = 0.08 + Math.sin(elapsed * 0.1) * 0.015 + tiltY;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    const onPointer = (event: PointerEvent): void => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      targetColumn = Math.floor((x + 0.5) * columns);
      if (falling) {
        const width = columnWidth(falling.cells);
        const next = Math.min(columns - width, Math.max(0, targetColumn));
        if (!collides(falling.cells, next, falling.row)) {
          falling.col = next;
          updatePiece();
        }
      }
      targetCameraX = x * 2.2;
      targetTiltX = y * 0.05;
      targetTiltY = x * 0.12;
    };

    const onPointerDown = (): void => {
      if (!falling) return;
      const rotated = rotateCells(falling.cells);
      const width = columnWidth(rotated);
      const nextColumn = Math.min(columns - width, falling.col);
      if (!collides(rotated, nextColumn, falling.row)) {
        falling.cells = rotated;
        falling.col = nextColumn;
        updatePiece();
      }
    };

    const onPointerLeave = (): void => {
      targetCameraX = 0;
      targetTiltX = 0;
      targetTiltY = 0;
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
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);

    if (reducedMotion) {
      renderStatic();
      frame = requestAnimationFrame(() => {
        if (active) renderStatic();
      });
    } else {
      spawn();
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
      boxGeometry.dispose();
      cellMaterials.forEach((material) => material.dispose());
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
    current.cells.forEach((material, index) => {
      material.color.set(palette.colors[index]);
    });
    current.hemi.color.setHex(palette.hemiSky);
    current.hemi.groundColor.setHex(palette.hemiGround);
    current.hemi.intensity = palette.hemiIntensity;
    current.dir.intensity = palette.dirIntensity;
  }, [theme]);

  return <div ref={host} className="auth-backdrop" aria-hidden="true" />;
}
