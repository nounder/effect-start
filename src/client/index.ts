/**
 * This module is intended to be imported in a browser bundle in a development.
 * It is responsible for live reloading the page when bundle changes.
 * When NODE_ENV=production, it does nothing.
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import type {
  BundleEvent,
  BundleManifest,
} from "../Bundle.ts"
import * as ScrollState from "./ScrollState.ts"

function reload() {
  ScrollState.persist()
  window.location.reload()
}

async function loadAllEntrypoints() {
  const manifest: BundleManifest = await fetch("/_bundle/manifest.json")
    .then(v => v.json())

  Object
    .keys(manifest.artifacts)
    .filter(v => v.endsWith(".js"))
    .forEach((outFile) => {
      console.log(outFile)
      const script = document.createElement("script")
      script.src = `/_bundle/${outFile}`
      script.type = "module"
      script.onload = () => {
        console.debug("Bundle reloaded")
      }
      document.body.appendChild(script)
    })
}

function handleBundleEvent(event: BundleEvent) {
  if (event.type === "Change") {
    console.debug("Bundle change detected...")
    reload()
  }
}

function listen() {
  const eventSource = new EventSource("/_bundle/events")

  eventSource.addEventListener("message", (event) => {
    try {
      reloadAllMetaLinks()
      const data = JSON.parse(event.data)

      handleBundleEvent(data)
    } catch (error) {
      console.error("Error parsing SSE event", {
        error,
        event,
      })
    }
  })

  eventSource.addEventListener("error", error => {
    console.error("SSE connection error:", error)
  })

  return () => {
    eventSource.close()
  }
}

function reloadAllMetaLinks() {
  for (const link of document.getElementsByTagName("link")) {
    const url = new URL(link.href)

    if (url.host === window.location.host) {
      const next = link.cloneNode() as HTMLLinkElement
      // TODO: this won't work when link already has query params
      next.href = next.href + "?" + Math.random().toString(36).slice(2)
      next.onload = () => link.remove()
      link.parentNode!.insertBefore(next, link.nextSibling)
      return
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  window.addEventListener("load", () => {
    ScrollState.restore()
    listen()
  })
}
