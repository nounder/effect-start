const mediaTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".map": "application/json",
  ".md": "text/markdown",
  ".mjs": "text/javascript",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
}

export function fromPath(path: string): string {
  const dotIndex = path.lastIndexOf(".")
  const extension = dotIndex === -1 ? "" : path.slice(dotIndex).toLowerCase()
  const mediaType = mediaTypes[extension] ?? "application/octet-stream"
  return mediaType.startsWith("text/") ? `${mediaType}; charset=utf-8` : mediaType
}
