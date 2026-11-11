const mediaTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".m4a": "audio/mp4",
  ".m4v": "video/mp4",
  ".map": "application/json",
  ".md": "text/markdown",
  ".mjs": "text/javascript",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".vtt": "text/vtt",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
}

export function fromPath(path: string, options?: { charset?: boolean }): string {
  const dotIndex = path.lastIndexOf(".")
  const extension = dotIndex === -1 ? "" : path.slice(dotIndex).toLowerCase()
  const mediaType = mediaTypes[extension] ?? "application/octet-stream"
  return options?.charset !== false && mediaType.startsWith("text/")
    ? `${mediaType}; charset=utf-8`
    : mediaType
}
