export type Region = { left: number; top: number; width: number; height: number };

export type ElementDescriptor = {
  selector: string;
  tag: string;
  id?: string;
  classes?: string[];
  role?: string | null;
  ariaLabel?: string | null;
  text?: string | null;
  rect: { left: number; top: number; width: number; height: number };
};

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (!style || style.visibility === "hidden" || style.display === "none" || parseFloat(style.opacity || "1") === 0) return false;
  const rect = (el as HTMLElement).getBoundingClientRect();
  if (rect.width < 6 || rect.height < 6) return false;
  return true;
}

function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = (el as HTMLElement).id;
  if (id) return `#${CSS.escape(id)}`;
  const classList = Array.from((el as HTMLElement).classList).slice(0, 3);
  if (classList.length) return `${tag}.${classList.map((c) => CSS.escape(c)).join('.')}`;
  // fallback path up to two ancestors with ids/classes
  const parent = el.parentElement;
  if (!parent) return tag;
  const pId = parent.id ? `#${CSS.escape(parent.id)}` : parent.classList.length ? `${parent.tagName.toLowerCase()}.${Array.from(parent.classList).slice(0,2).map(CSS.escape).join('.')}` : parent.tagName.toLowerCase();
  return `${pId} > ${tag}`;
}

function textSnippet(el: Element): string | null {
  const text = (el as HTMLElement).innerText || (el as HTMLElement).textContent || "";
  const s = text.trim().replace(/\s+/g, " ");
  if (!s) return null;
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

export function collectRegionDiagnostics(region: Region, limit = 30): { region: Region; elements: ElementDescriptor[]; env: Record<string, any> } {
  const viewportLeft = 0;
  const viewportTop = 0;
  const viewportRight = window.innerWidth;
  const viewportBottom = window.innerHeight;

  const regionRight = region.left + region.width;
  const regionBottom = region.top + region.height;

  const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
  const inRegion: ElementDescriptor[] = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    // Skip elements completely outside viewport (saves work)
    if (r.right < viewportLeft || r.bottom < viewportTop || r.left > viewportRight || r.top > viewportBottom) continue;
    // Intersect with region
    if (r.right < region.left || r.bottom < region.top || r.left > regionRight || r.top > regionBottom) continue;
    if (!isVisible(el)) continue;

    const role = el.getAttribute("role");
    const ariaLabel = el.getAttribute("aria-label");
    const id = el.id || undefined;
    const classes = Array.from(el.classList);
    const selector = buildSelector(el);
    const desc: ElementDescriptor = {
      selector,
      tag: el.tagName.toLowerCase(),
      id,
      classes: classes.length ? classes.slice(0, 6) : undefined,
      role: role || null,
      ariaLabel: ariaLabel || null,
      text: textSnippet(el),
      rect: { left: Math.floor(r.left), top: Math.floor(r.top), width: Math.floor(r.width), height: Math.floor(r.height) },
    };
    inRegion.push(desc);
    if (inRegion.length >= limit) break;
  }

  const env = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
    screen: { width: window.screen.width, height: window.screen.height, availWidth: window.screen.availWidth, availHeight: window.screen.availHeight },
    pageUrl: location.href,
    referrer: document.referrer,
    timestamp: new Date().toISOString(),
  };

  return { region, elements: inRegion, env };
}


