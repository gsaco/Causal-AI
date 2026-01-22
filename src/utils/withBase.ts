export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  if (path.startsWith("http")) return path;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}` || "/";
}
