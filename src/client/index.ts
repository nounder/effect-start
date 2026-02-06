/**
 * This module is intended to be imported in a browser bundle in a development.
 * It is responsible for live reloading the page when bundle changes.
 * When NODE_ENV=production, it does nothing.
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import type * as Bundle from "../bundler/Bundle.ts"
import * as Overlay from "./Overlay.ts"
import * as ScrollState from "./ScrollState.ts"

const BUNDLE_URL = globalThis._BUNDLE_URL ?? "/_bundle"

function reload() {
  ScrollState.persist()
  window.location.reload()
}

async function loadAllEntrypoints() {
  const manifest: Bundle.BundleManifest = await fetch(`/${BUNDLE_URL}/manifest.json`).then((v) =>
    v.json(),
  )

  manifest.artifacts
    .filter((v) => v.path.endsWith(".js"))
    .forEach((artifact) => {
      console.log(artifact.path)
      const script = document.createElement("script")
      script.src = `${BUNDLE_URL}/${artifact.path}`
      script.type = "module"
      script.onload = () => {
        console.debug("Bundle reloaded")
      }
      document.body.appendChild(script)
    })
}

function handleBundleEvent(event: Bundle.BundleEvent) {
  switch (event._tag) {
    case "Change":
      console.debug("Bundle change detected...")
      reload()
      break
    case "BuildError":
      Overlay.showBuildError(event.error)
      break
  }
}

function listen() {
  const eventSource = new EventSource(`${BUNDLE_URL}/events`)

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

  eventSource.addEventListener("error", (error) => {
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
