export function isElementInsideCrossOriginIframe(el: Element): boolean {
  try {
    const doc = el.ownerDocument;
    const frameEl = (doc?.defaultView as any)?.frameElement as HTMLIFrameElement | null;
    if (!frameEl) return false;
    void frameEl.contentDocument;
    return false;
  } catch {
    return true;
  }
}

export async function pickElement(): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[2147483647] cursor-crosshair bg-neutral-200/20 pointer-events-none";

    const box = document.createElement("div");
    box.className = "fixed border-2 border-neutral-500 bg-neutral-200/20 pointer-events-none";
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let last: HTMLElement | null = null;

    const updateBoxTo = (el: HTMLElement | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, {
        left: `${Math.floor(r.left)}px`,
        top: `${Math.floor(r.top)}px`,
        width: `${Math.max(1, Math.floor(r.width))}px`,
        height: `${Math.max(1, Math.floor(r.height))}px`,
        display: "block",
      } as CSSStyleDeclaration);
    };

    const onMove = (e: MouseEvent) => {
      // Ensure we hit the element beneath our overlay by temporarily hiding pointer interception
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (el && el !== last) {
        last = el;
        updateBoxTo(last);
      }
    };

    const cleanup = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      overlay.remove();
    };

    const onClick = (e: MouseEvent) => {
      // Intercept the click in capture phase to avoid triggering app UIs
      e.preventDefault();
      e.stopPropagation();
      const chosen = last || document.body;
      cleanup();
      resolve(chosen);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
  });
}

export async function pickArea(): Promise<DOMRect> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      cursor: "crosshair",
    } as CSSStyleDeclaration);
    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "fixed",
      border: "2px solid #1d4ed8",
      background: "rgba(29,78,216,0.1)",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let startX = 0;
    let startY = 0;
    let dragging = false;

    function onMouseDown(e: MouseEvent) {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      updateBox(e.clientX, e.clientY);
    }
    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      updateBox(e.clientX, e.clientY);
    }
    function updateBox(x: number, y: number) {
      const left = Math.min(startX, x);
      const top = Math.min(startY, y);
      const width = Math.abs(x - startX);
      const height = Math.abs(y - startY);
      Object.assign(box.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    }
    function finish(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      dragging = false;
      const rect = box.getBoundingClientRect();
      cleanup();
      resolve(new DOMRect(rect.left, rect.top, rect.width, rect.height));
    }
    function cleanup() {
      overlay.removeEventListener("mousedown", onMouseDown, true);
      overlay.removeEventListener("mousemove", onMouseMove, true);
      overlay.removeEventListener("mouseup", finish, true);
      overlay.remove();
    }
    overlay.addEventListener("mousedown", onMouseDown, true);
    overlay.addEventListener("mousemove", onMouseMove, true);
    overlay.addEventListener("mouseup", finish, true);
  });
}


