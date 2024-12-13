import { Window } from "npm:happy-dom"

const browserWindow = new Window()

const global = globalThis

global.setTimeout = browserWindow.setTimeout
global.clearTimeout = browserWindow.clearTimeout
global.setInterval = browserWindow.setInterval
global.clearInterval = browserWindow.clearInterval
global.requestAnimationFrame = browserWindow.requestAnimationFrame
global.cancelAnimationFrame = browserWindow.cancelAnimationFrame
global.queueMicrotask = browserWindow.queueMicrotask
global.Element = browserWindow.Element
global.SVGElement = browserWindow.SVGElement
global.document = browserWindow.document
