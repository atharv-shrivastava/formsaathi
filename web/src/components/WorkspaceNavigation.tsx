import { useEffect, useRef, useState } from "react";

type NavigationItem = {
  id: string;
  label: string;
  icon: string;
};

type WorkspaceNavigationProps = {
  items: NavigationItem[];
  selectedId: string;
  pendingCount: number;
  displayName: string;
  email: string;
  onNavigate: (id: string) => void;
  onSignOut: () => void;
};

type NavigationMesh = {
  group: import("three").Group;
  material: import("three").MeshPhysicalMaterial;
  accent: import("three").MeshStandardMaterial;
};

/**
 * A sculpted 3D navigation spine. WebGL supplies the physical glass/metal
 * object; real HTML buttons sit over each plate so navigation stays
 * accessible, keyboard friendly, and reliable on every device.
 */
export default function WorkspaceNavigation({
  items,
  selectedId,
  pendingCount,
  displayName,
  email,
  onNavigate,
  onSignOut,
}: WorkspaceNavigationProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const meshMapRef = useRef(new Map<string, NavigationMesh>());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const selectedIdRef = useRef(selectedId);
  const hoveredIdRef = useRef(hoveredId);
  selectedIdRef.current = selectedId;
  hoveredIdRef.current = hoveredId;

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || !items.length) return;

    let disposed = false;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let removeHostListeners: (() => void) | undefined;
    let renderer: import("three").WebGLRenderer | undefined;
    let scene: import("three").Scene | undefined;
    const meshes = new Map<string, NavigationMesh>();

    const roundedShape = (THREE: typeof import("three"), width: number, height: number, radius: number) => {
      const shape = new THREE.Shape();
      const x = -width / 2;
      const y = -height / 2;
      shape.moveTo(x + radius, y);
      shape.lineTo(x + width - radius, y);
      shape.quadraticCurveTo(x + width, y, x + width, y + radius);
      shape.lineTo(x + width, y + height - radius);
      shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      shape.lineTo(x + radius, y + height);
      shape.quadraticCurveTo(x, y + height, x, y + height - radius);
      shape.lineTo(x, y + radius);
      shape.quadraticCurveTo(x, y, x + radius, y);
      return shape;
    };

    void import("three").then((THREE) => {
      if (disposed || !host) return;
      try {
        const world = new THREE.Scene();
        world.background = null;

        const camera = new THREE.OrthographicCamera(-2, 2, 4.1, -4.1, 0.1, 40);
        camera.position.set(0, 0, 13);
        camera.lookAt(0, 0, 0);

        const webgl = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer = webgl;
        webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        webgl.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1), false);
        webgl.outputColorSpace = THREE.SRGBColorSpace;
        webgl.toneMapping = THREE.ACESFilmicToneMapping;
        webgl.toneMappingExposure = 1.12;
        webgl.setClearColor(0x000000, 0);
        webgl.domElement.className = "nav-object-canvas";
        webgl.domElement.setAttribute("aria-hidden", "true");
        host.appendChild(webgl.domElement);
        scene = world;

        world.add(new THREE.HemisphereLight(0xf6fff7, 0x718b77, 2.1));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
        keyLight.position.set(-3.5, 5.5, 7);
        world.add(keyLight);
        const rimLight = new THREE.PointLight(0xa2c9a9, 2.4, 12);
        rimLight.position.set(3.4, -1.6, 4.5);
        world.add(rimLight);
        const warmLight = new THREE.PointLight(0xd5b78a, 1.1, 10);
        warmLight.position.set(-2.8, 2.8, 2);
        world.add(warmLight);

        const object = new THREE.Group();
        object.rotation.y = -0.045;
        world.add(object);
        
        const spineMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x8ca992,
          metalness: 0.38,
          roughness: 0.28,
          transparent: true,
          opacity: 0.56,
          clearcoat: 1,
          clearcoatRoughness: 0.2,
        });
        const spineShape = roundedShape(THREE, 0.22, items.length * 0.96 + 0.64, 0.105);
        const spine = new THREE.Mesh(
          new THREE.ExtrudeGeometry(spineShape, {
            depth: 0.34,
            bevelEnabled: true,
            bevelSegments: 4,
            bevelSize: 0.055,
            bevelThickness: 0.045,
            curveSegments: 10,
          }),
          spineMaterial,
        );
        spine.position.set(1.53, 0, -0.31);
        object.add(spine);

        const footMaterial = new THREE.MeshStandardMaterial({
          color: 0xb99a6d,
          metalness: 0.64,
          roughness: 0.3,
        });
        const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), footMaterial);
        topCap.position.set(1.53, items.length * 0.48 + 0.36, -0.06);
        object.add(topCap);
        const bottomCap = topCap.clone();
        bottomCap.position.y *= -1;
        object.add(bottomCap);

        const plateWidth = 3.25;
        const plateHeight = 0.7;
        const spacing = 0.96;
        const geometry = new THREE.ExtrudeGeometry(
          roundedShape(THREE, plateWidth, plateHeight, 0.14),
          {
            depth: 0.2,
            bevelEnabled: true,
            bevelSegments: 5,
            bevelSize: 0.065,
            bevelThickness: 0.045,
            curveSegments: 12,
          },
        );

        items.forEach((item, index) => {
          const group = new THREE.Group();
          const y = ((items.length - 1) / 2 - index) * spacing;
          group.position.set(-0.02, y, 0.05 + (index % 2) * 0.018);

          const material = new THREE.MeshPhysicalMaterial({
            color: 0xe4ede3,
            metalness: 0.18,
            roughness: 0.25,
            transparent: true,
            opacity: 0.88,
            clearcoat: 1,
            clearcoatRoughness: 0.16,
            reflectivity: 0.78,
          });
          const plate = new THREE.Mesh(geometry, material);
          plate.castShadow = true;
          plate.receiveShadow = true;
          group.add(plate);

          const accent = new THREE.MeshStandardMaterial({
            color: 0x72967a,
            metalness: 0.4,
            roughness: 0.25,
          });
          const edge = new THREE.Mesh(
            new THREE.BoxGeometry(0.055, 0.43, 0.12),
            accent,
          );
          edge.position.set(-1.46, 0, 0.28);
          group.add(edge);

          const badge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.17, 0.17, 0.055, 40),
            new THREE.MeshPhysicalMaterial({
              color: 0xf7fbf5,
              metalness: 0.24,
              roughness: 0.23,
              clearcoat: 1,
            }),
          );
          badge.rotation.x = Math.PI / 2;
          badge.position.set(-1.12, 0, 0.27);
          group.add(badge);

          const pin = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 16, 12),
            footMaterial,
          );
          pin.position.set(1.28, 0, 0.27);
          group.add(pin);

          object.add(group);
          const entry = { group, material, accent };
          meshes.set(item.id, entry);
          meshMapRef.current.set(item.id, entry);
        });

        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.23, 0.012, 8, 80),
          new THREE.MeshBasicMaterial({ color: 0xd2b88e, transparent: true, opacity: 0.75 }),
        );
        halo.position.set(1.53, 0, -0.06);
        halo.rotation.x = Math.PI / 2;
        halo.scale.set(1, items.length * 0.38 + 0.6, 1);
        object.add(halo);

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let pointerX = 0;
        let pointerY = 0;
        let targetX = 0;
        let targetY = -0.045;

        const resize = () => {
          if (!host || !renderer) return;
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          const viewHeight = 7.8;
          const viewWidth = viewHeight * (width / height);
          camera.left = -viewWidth / 2;
          camera.right = viewWidth / 2;
          camera.top = viewHeight / 2;
          camera.bottom = -viewHeight / 2;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };

        const onPointerMove = (event: PointerEvent) => {
          if (event.pointerType !== "mouse") return;
          const bounds = host.getBoundingClientRect();
          pointerX = (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5;
          pointerY = (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5;
          targetY = -0.045 + pointerX * 0.11;
          targetX = -pointerY * 0.055;
        };
        const onPointerLeave = () => {
          targetX = 0;
          targetY = -0.045;
        };
        const interactiveSurface = host.parentElement || host;
        interactiveSurface.addEventListener("pointermove", onPointerMove);
        interactiveSurface.addEventListener("pointerleave", onPointerLeave);
        removeHostListeners = () => {
          interactiveSurface.removeEventListener("pointermove", onPointerMove);
          interactiveSurface.removeEventListener("pointerleave", onPointerLeave);
        };
        observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        const animate = () => {
          frame = window.requestAnimationFrame(animate);
          if (!object || !renderer || !scene) return;
          if (!reducedMotion) {
            object.rotation.x += (targetX - object.rotation.x) * 0.055;
            object.rotation.y += (targetY - object.rotation.y) * 0.055;
          }
          meshes.forEach((entry, id) => {
            const active = id === selectedIdRef.current;
            const hovered = id === hoveredIdRef.current;
            const targetZ = active ? 0.48 : hovered ? 0.27 : 0.05;
            entry.group.position.z += (targetZ - entry.group.position.z) * 0.12;
            entry.group.rotation.y += ((active ? -0.095 : hovered ? -0.045 : 0) - entry.group.rotation.y) * 0.12;
            const targetColour = new THREE.Color(active ? 0x315b46 : hovered ? 0xc9ddc9 : 0xe4ede3);
            entry.material.color.lerp(targetColour, 0.12);
            const accentColour = new THREE.Color(active ? 0xd8bb8e : hovered ? 0x6d9675 : 0x72967a);
            entry.accent.color.lerp(accentColour, 0.12);
            entry.material.opacity += ((active ? 0.97 : 0.88) - entry.material.opacity) * 0.12;
          });
          renderer.render(scene, camera);
        };
        animate();

      } catch (error) {
        console.error("3D navigation could not start:", error);
        if (!disposed) setWebglFailed(true);
      }
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      removeHostListeners?.();
      scene?.traverse((object) => {
        const mesh = object as import("three").Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
        else if (mesh.material) mesh.material.dispose();
      });
      meshMapRef.current.clear();
      renderer?.dispose();
      if (renderer?.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [items]);

  return (
    <aside className="sidebar workspace-sidebar workspace-3d-sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">S</div>
        <span>Saral Form</span>
      </div>

      <div className="workspace-nav-heading">
        <span className="workspace-label">YOUR WORKSPACE</span>
        <span className="workspace-nav-hint">Navigation object</span>
      </div>

      <div className={webglFailed ? "nav-object-shell fallback" : "nav-object-shell"}>
        <div className="nav-object-canvas-host" ref={canvasHostRef} aria-hidden="true" />
        <nav className="nav-object-controls" aria-label="Main navigation">
          {items.map((item, index) => {
            const active = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "nav-object-button active" : "nav-object-button"}
                aria-current={active ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
                onPointerEnter={() => setHoveredId(item.id)}
                onPointerLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(item.id)}
                onBlur={() => setHoveredId(null)}
              >
                <span className="nav-object-icon" aria-hidden="true">{item.icon}</span>
                <span className="nav-object-label">{item.label}</span>
                <span className="nav-object-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {item.id === "profile" && pendingCount > 0 && (
                  <span className="nav-object-count" aria-label={pendingCount + " details waiting for review"}>
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        {webglFailed && <span className="nav-object-fallback-note">3D preview unavailable</span>}
      </div>

      <div className="sidebar-bottom">
        <div className="user-card">
          <div className="avatar">{(displayName || email || "S").slice(0, 1).toUpperCase()}</div>
          <div className="user-meta">
            <strong>{displayName}</strong>
            <span>{email}</span>
          </div>
          <button className="icon-button signout" onClick={onSignOut} title="Sign out" aria-label="Sign out">↗</button>
        </div>
      </div>
    </aside>
  );
}
