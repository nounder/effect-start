export type HTMLOrSVG = HTMLElement | SVGElement | MathMLElement

export type DataEvent = Event & {
  signals: Record<string, any>
  actions: Record<string, (...args: Array<any>) => any>
  target: HTMLOrSVG
  window: Window & typeof globalThis
}
