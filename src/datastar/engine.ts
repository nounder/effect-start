import { aliasify, hasOwn, isHTMLOrSVG, isPojo, pathToObj, snake } from "./utils.ts"

/*********
 * consts.ts
 *********/
const lol = /🖕JS_DS🚀/.source
export const DSP = lol.slice(0, 5)
export const DSS = lol.slice(4)
export const DATASTAR_FETCH_EVENT = "datastar-fetch"
export const DATASTAR_SIGNAL_PATCH_EVENT = "datastar-signal-patch"

/*********
 * types.ts
 *********/
export type JSONPatch = Record<string, any> & { length?: never }
export type Paths = Array<[string, any]>

export type DatastarFetchEvent = {
  type: string
  el: HTMLOrSVG
  argsRaw: Record<string, string>
}

export type CustomEventMap = {
  [DATASTAR_SIGNAL_PATCH_EVENT]: CustomEvent<JSONPatch>
}
export type WatcherFn<K extends keyof CustomEventMap> = (
  this: Document,
  ev: CustomEventMap[K],
) => void

export type ErrorFn = (name: string, ctx?: Record<string, any>) => void

export type ActionContext = {
  el: HTMLOrSVG
  evt?: Event
  error: ErrorFn
  cleanups: Map<string, () => void>
}

export type RequirementType = "allowed" | "must" | "denied" | "exclusive"

export type Requirement =
  | RequirementType
  | {
      key: Exclude<RequirementType, "exclusive">
      value?: Exclude<RequirementType, "exclusive">
    }
  | {
      key?: Exclude<RequirementType, "exclusive">
      value: Exclude<RequirementType, "exclusive">
    }

type Rx<B extends boolean> = (...args: Array<any>) => B extends true ? unknown : void

type ReqField<R, K extends "key" | "value", Return> = R extends "must" | { [P in K]: "must" }
  ? Return
  : R extends "denied" | { [P in K]: "denied" }
    ? undefined
    : R extends "allowed" | { [P in K]: "allowed" } | (K extends keyof R ? never : R)
      ? Return | undefined
      : never

type ReqFields<R extends Requirement, B extends boolean> = R extends "exclusive"
  ? { key: string; value: undefined; rx: undefined } | { key: undefined; value: string; rx: Rx<B> }
  : {
      key: ReqField<R, "key", string>
      value: ReqField<R, "value", string>
      rx: ReqField<R, "value", Rx<B>>
    }

export type AttributeContext<
  R extends Requirement = Requirement,
  RxReturn extends boolean = boolean,
> = {
  el: HTMLOrSVG
  mods: Modifiers
  rawKey: string
  evt?: Event
  error: ErrorFn
  loadedPluginNames: {
    actions: Readonly<Set<string>>
    attributes: Readonly<Set<string>>
  }
} & ReqFields<R, RxReturn>

export type AttributePlugin<
  R extends Requirement = Requirement,
  RxReturn extends boolean = boolean,
> = {
  name: string
  apply: (ctx: AttributeContext<R, RxReturn>) => void | (() => void)
  requirement?: R
  returnsValue?: RxReturn
  argNames?: Array<string>
}

export type WatcherContext = {
  error: ErrorFn
}

export type WatcherPlugin = {
  name: string
  apply: (ctx: WatcherContext, args: Record<string, string | undefined>) => void
}

export type ActionPlugins = Record<string, ActionPlugin>

export type ActionPlugin<T = any> = {
  name: string
  apply: (ctx: ActionContext, ...args: Array<any>) => T
}

export type MergePatchArgs = {
  ifMissing?: boolean
}

export type HTMLOrSVG = HTMLElement | SVGElement | MathMLElement

export type DataEvent = Event & {
  signals: Record<string, any>
  actions: Record<string, (...args: any[]) => any>
  target: HTMLOrSVG
  window: Window & typeof globalThis
}

export type Modifiers = Map<string, Set<string>>

export type EventCallbackHandler = (...args: Array<any>) => void

export type SignalFilter = RegExp
export type SignalFilterOptions = {
  include?: RegExp | string
  exclude?: RegExp | string
}

export type Signal<T> = {
  (): T
  (value: T): boolean
}

export type Computed<T> = () => T

export type Effect = () => void

/*********
 * signals.ts
 *********/
interface ReactiveNode {
  deps_?: Link
  depsTail_?: Link
  subs_?: Link
  subsTail_?: Link
  flags_: ReactiveFlags
}

interface Link {
  version_: number
  dep_: ReactiveNode
  sub_: ReactiveNode
  prevSub_?: Link
  nextSub_?: Link
  prevDep_?: Link
  nextDep_?: Link
}

interface Stack<T> {
  value_: T
  prev_?: Stack<T>
}

const ReactiveFlags = {
  None: 0,
  Mutable: 1 << 0,
  Watching: 1 << 1,
  RecursedCheck: 1 << 2,
  Recursed: 1 << 3,
  Dirty: 1 << 4,
  Pending: 1 << 5,
} as const
type ReactiveFlags = (typeof ReactiveFlags)[keyof typeof ReactiveFlags]
type ReactiveFlags_None = typeof ReactiveFlags.None
type ReactiveFlags_Mutable = typeof ReactiveFlags.Mutable
type ReactiveFlags_Watching = typeof ReactiveFlags.Watching
type ReactiveFlags_RecursedCheck = typeof ReactiveFlags.RecursedCheck
type ReactiveFlags_Recursed = typeof ReactiveFlags.Recursed
type ReactiveFlags_Dirty = typeof ReactiveFlags.Dirty
type ReactiveFlags_Pending = typeof ReactiveFlags.Pending

const EffectFlags = {
  Queued: 1 << 6,
} as const
type EffectFlags_Queued = typeof EffectFlags.Queued

interface AlienEffect extends ReactiveNode {
  fn_(): void
}

interface AlienComputed<T = unknown> extends ReactiveNode {
  value_?: T
  getter(previousValue?: T): T
}

interface AlienSignal<T = unknown> extends ReactiveNode {
  previousValue: T
  value_: T
}

const currentPatch: Paths = []
const queuedEffects: Array<AlienEffect | undefined> = []
let batchDepth = 0
let notifyIndex = 0
let queuedEffectsLength = 0
let prevSub: ReactiveNode | undefined
let activeSub: ReactiveNode | undefined
let version = 0

export const beginBatch = (): void => {
  batchDepth++
}

export const endBatch = (): void => {
  if (!--batchDepth) {
    flush()
    dispatch()
  }
}

export const startPeeking = (sub?: ReactiveNode): void => {
  prevSub = activeSub
  activeSub = sub
}

export const stopPeeking = (): void => {
  activeSub = prevSub
  prevSub = undefined
}

export const signal = <T>(initialValue?: T): Signal<T> => {
  return signalOper.bind(0, {
    previousValue: initialValue,
    value_: initialValue,
    flags_: 1 satisfies ReactiveFlags_Mutable,
  }) as Signal<T>
}

const computedSymbol = Symbol("computed")
export const computed = <T>(getter: (previousValue?: T) => T): Computed<T> => {
  const c = computedOper.bind(0, {
    flags_: 17 as ReactiveFlags_Mutable | ReactiveFlags_Dirty,
    getter,
  }) as Computed<T>
  // @ts-ignore
  c[computedSymbol] = 1
  return c
}

export const effect = (fn: () => void): Effect => {
  const e: AlienEffect = {
    fn_: fn,
    flags_: 2 satisfies ReactiveFlags_Watching,
  }
  if (activeSub) {
    link(e, activeSub)
  }
  startPeeking(e)
  beginBatch()
  try {
    e.fn_()
  } finally {
    endBatch()
    stopPeeking()
  }
  return effectOper.bind(0, e)
}

const flush = () => {
  while (notifyIndex < queuedEffectsLength) {
    const effect = queuedEffects[notifyIndex]!
    queuedEffects[notifyIndex++] = undefined
    run(effect, (effect.flags_ &= ~EffectFlags.Queued))
  }
  notifyIndex = 0
  queuedEffectsLength = 0
}

const update = (signal: AlienSignal | AlienComputed): boolean => {
  if ("getter" in signal) {
    return updateComputed(signal)
  }
  return updateSignal(signal, signal.value_)
}

const updateComputed = (c: AlienComputed): boolean => {
  startPeeking(c)
  startTracking(c)
  try {
    const oldValue = c.value_
    return oldValue !== (c.value_ = c.getter(oldValue))
  } finally {
    stopPeeking()
    endTracking(c)
  }
}

const updateSignal = <T>(s: AlienSignal<T>, value: T): boolean => {
  s.flags_ = 1 satisfies ReactiveFlags_Mutable
  return s.previousValue !== (s.previousValue = value)
}

const notify = (e: AlienEffect): void => {
  const flags = e.flags_
  if (!(flags & EffectFlags.Queued)) {
    e.flags_ = flags | EffectFlags.Queued
    const subs = e.subs_
    if (subs) {
      notify(subs.sub_ as AlienEffect)
    } else {
      queuedEffects[queuedEffectsLength++] = e
    }
  }
}

const run = (e: AlienEffect, flags: ReactiveFlags): void => {
  if (
    flags & (16 satisfies ReactiveFlags_Dirty) ||
    (flags & (32 satisfies ReactiveFlags_Pending) && checkDirty(e.deps_!, e))
  ) {
    startPeeking(e)
    startTracking(e)
    beginBatch()
    try {
      e.fn_()
    } finally {
      endBatch()
      stopPeeking()
      endTracking(e)
    }
    return
  }
  if (flags & (32 satisfies ReactiveFlags_Pending)) {
    e.flags_ = flags & ~(32 satisfies ReactiveFlags_Pending)
  }
  let link = e.deps_
  while (link) {
    const dep = link.dep_
    const depFlags = dep.flags_
    if (depFlags & EffectFlags.Queued) {
      run(dep as AlienEffect, (dep.flags_ = depFlags & ~EffectFlags.Queued))
    }
    link = link.nextDep_
  }
}

const signalOper = <T>(s: AlienSignal<T>, ...value: [T]): T | boolean => {
  if (value.length) {
    if (s.value_ !== (s.value_ = value[0])) {
      s.flags_ = 17 as ReactiveFlags_Mutable | ReactiveFlags_Dirty
      const subs = s.subs_
      if (subs) {
        propagate(subs)
        if (!batchDepth) {
          flush()
        }
      }
      return true
    }
    return false
  }
  const currentValue = s.value_
  if (s.flags_ & (16 satisfies ReactiveFlags_Dirty)) {
    if (updateSignal(s, currentValue)) {
      const subs_ = s.subs_
      if (subs_) {
        shallowPropagate(subs_)
      }
    }
  }
  if (activeSub) {
    link(s, activeSub)
  }
  return currentValue
}

const computedOper = <T>(c: AlienComputed<T>): T => {
  const flags = c.flags_
  if (
    flags & (16 satisfies ReactiveFlags_Dirty) ||
    (flags & (32 satisfies ReactiveFlags_Pending) && checkDirty(c.deps_!, c))
  ) {
    if (updateComputed(c)) {
      const subs = c.subs_
      if (subs) {
        shallowPropagate(subs)
      }
    }
  } else if (flags & (32 satisfies ReactiveFlags_Pending)) {
    c.flags_ = flags & ~(32 satisfies ReactiveFlags_Pending)
  }
  if (activeSub) {
    link(c, activeSub)
  }
  return c.value_!
}

const effectOper = (e: AlienEffect): void => {
  let dep = e.deps_
  while (dep) {
    dep = unlink(dep, e)
  }
  const sub = e.subs_
  if (sub) {
    unlink(sub)
  }
  e.flags_ = 0 satisfies ReactiveFlags_None
}

const link = (dep: ReactiveNode, sub: ReactiveNode): void => {
  const prevDep = sub.depsTail_
  if (prevDep && prevDep.dep_ === dep) {
    return
  }
  const nextDep = prevDep ? prevDep.nextDep_ : sub.deps_
  if (nextDep && nextDep.dep_ === dep) {
    nextDep.version_ = version
    sub.depsTail_ = nextDep
    return
  }
  const prevSub = dep.subsTail_
  if (prevSub && prevSub.version_ === version && prevSub.sub_ === sub) {
    return
  }
  const newLink =
    (sub.depsTail_ =
    dep.subsTail_ =
      {
        version_: version,
        dep_: dep,
        sub_: sub,
        prevDep_: prevDep,
        nextDep_: nextDep,
        prevSub_: prevSub,
      })
  if (nextDep) {
    nextDep.prevDep_ = newLink
  }
  if (prevDep) {
    prevDep.nextDep_ = newLink
  } else {
    sub.deps_ = newLink
  }
  if (prevSub) {
    prevSub.nextSub_ = newLink
  } else {
    dep.subs_ = newLink
  }
}

const unlink = (link: Link, sub = link.sub_): Link | undefined => {
  const dep_ = link.dep_
  const prevDep_ = link.prevDep_
  const nextDep_ = link.nextDep_
  const nextSub_ = link.nextSub_
  const prevSub_ = link.prevSub_
  if (nextDep_) {
    nextDep_.prevDep_ = prevDep_
  } else {
    sub.depsTail_ = prevDep_
  }
  if (prevDep_) {
    prevDep_.nextDep_ = nextDep_
  } else {
    sub.deps_ = nextDep_
  }
  if (nextSub_) {
    nextSub_.prevSub_ = prevSub_
  } else {
    dep_.subsTail_ = prevSub_
  }
  if (prevSub_) {
    prevSub_.nextSub_ = nextSub_
  } else if (!(dep_.subs_ = nextSub_)) {
    if ("getter" in dep_) {
      let toRemove = dep_.deps_
      if (toRemove) {
        dep_.flags_ = 17 as ReactiveFlags_Mutable | ReactiveFlags_Dirty
        do {
          toRemove = unlink(toRemove, dep_)
        } while (toRemove)
      }
    } else if (!("previousValue" in dep_)) {
      effectOper(dep_ as AlienEffect)
    }
  }
  return nextDep_
}

const propagate = (link: Link): void => {
  let next = link.nextSub_
  let stack: Stack<Link | undefined> | undefined

  top: while (true) {
    const sub = link.sub_

    let flags = sub.flags_

    if (
      !(
        flags &
        (60 as
          | ReactiveFlags_RecursedCheck
          | ReactiveFlags_Recursed
          | ReactiveFlags_Dirty
          | ReactiveFlags_Pending)
      )
    ) {
      sub.flags_ = flags | (32 satisfies ReactiveFlags_Pending)
    } else if (!(flags & (12 as ReactiveFlags_RecursedCheck | ReactiveFlags_Recursed))) {
      flags = 0 satisfies ReactiveFlags_None
    } else if (!(flags & (4 satisfies ReactiveFlags_RecursedCheck))) {
      sub.flags_ =
        (flags & ~(8 satisfies ReactiveFlags_Recursed)) | (32 satisfies ReactiveFlags_Pending)
    } else if (
      !(flags & (48 as ReactiveFlags_Dirty | ReactiveFlags_Pending)) &&
      isValidLink(link, sub)
    ) {
      sub.flags_ = flags | (40 as ReactiveFlags_Recursed | ReactiveFlags_Pending)
      flags &= 1 satisfies ReactiveFlags_Mutable
    } else {
      flags = 0 satisfies ReactiveFlags_None
    }

    if (flags & (2 satisfies ReactiveFlags_Watching)) {
      notify(sub as AlienEffect)
    }

    if (flags & (1 satisfies ReactiveFlags_Mutable)) {
      const subSubs = sub.subs_
      if (subSubs) {
        const nextSub = (link = subSubs).nextSub_
        if (nextSub) {
          stack = { value_: next, prev_: stack }
          next = nextSub
        }
        continue
      }
    }

    if ((link = next!)) {
      next = link.nextSub_
      continue
    }

    while (stack) {
      link = stack.value_!
      stack = stack.prev_
      if (link) {
        next = link.nextSub_
        continue top
      }
    }

    break
  }
}

const startTracking = (sub: ReactiveNode): void => {
  version++
  sub.depsTail_ = undefined
  sub.flags_ =
    (sub.flags_ & ~(56 as ReactiveFlags_Recursed | ReactiveFlags_Dirty | ReactiveFlags_Pending)) |
    (4 satisfies ReactiveFlags_RecursedCheck)
}

const endTracking = (sub: ReactiveNode): void => {
  const depsTail_ = sub.depsTail_
  let toRemove = depsTail_ ? depsTail_.nextDep_ : sub.deps_
  while (toRemove) {
    toRemove = unlink(toRemove, sub)
  }
  sub.flags_ &= ~(4 satisfies ReactiveFlags_RecursedCheck)
}

const checkDirty = (link: Link, sub: ReactiveNode): boolean => {
  let stack: Stack<Link> | undefined
  let checkDepth = 0
  let dirty = false

  top: while (true) {
    const dep = link.dep_
    const flags = dep.flags_

    if (sub.flags_ & (16 satisfies ReactiveFlags_Dirty)) {
      dirty = true
    } else if (
      (flags & (17 as ReactiveFlags_Mutable | ReactiveFlags_Dirty)) ===
      (17 as ReactiveFlags_Mutable | ReactiveFlags_Dirty)
    ) {
      if (update(dep as AlienSignal | AlienComputed)) {
        const subs = dep.subs_!
        if (subs.nextSub_) {
          shallowPropagate(subs)
        }
        dirty = true
      }
    } else if (
      (flags & (33 as ReactiveFlags_Mutable | ReactiveFlags_Pending)) ===
      (33 as ReactiveFlags_Mutable | ReactiveFlags_Pending)
    ) {
      if (link.nextSub_ || link.prevSub_) {
        stack = { value_: link, prev_: stack }
      }
      link = dep.deps_!
      sub = dep
      ++checkDepth
      continue
    }

    if (!dirty) {
      const nextDep = link.nextDep_
      if (nextDep) {
        link = nextDep
        continue
      }
    }

    while (checkDepth--) {
      const firstSub = sub.subs_!
      const hasMultipleSubs = firstSub.nextSub_
      if (hasMultipleSubs) {
        link = stack!.value_
        stack = stack!.prev_
      } else {
        link = firstSub
      }
      if (dirty) {
        if (update(sub as AlienSignal | AlienComputed)) {
          if (hasMultipleSubs) {
            shallowPropagate(firstSub)
          }
          sub = link.sub_
          continue
        }
        dirty = false
      } else {
        sub.flags_ &= ~(32 satisfies ReactiveFlags_Pending)
      }
      sub = link.sub_
      if (link.nextDep_) {
        link = link.nextDep_
        continue top
      }
    }

    return dirty
  }
}

const shallowPropagate = (link: Link): void => {
  do {
    const sub = link.sub_
    const flags = sub.flags_
    if (
      (flags & (48 as ReactiveFlags_Pending | ReactiveFlags_Dirty)) ===
      (32 satisfies ReactiveFlags_Pending)
    ) {
      sub.flags_ = flags | (16 satisfies ReactiveFlags_Dirty)
      if (flags & (2 satisfies ReactiveFlags_Watching)) {
        notify(sub as AlienEffect)
      }
    }
  } while ((link = link.nextSub_!))
}

const isValidLink = (checkLink: Link, sub: ReactiveNode): boolean => {
  let link = sub.depsTail_
  while (link) {
    if (link === checkLink) {
      return true
    }
    link = link.prevDep_
  }
  return false
}

export const getPath = <T = any>(path: string): T | undefined => {
  let result = root
  const split = path.split(".")
  for (const path of split) {
    if (result == null || !hasOwn(result, path)) {
      return
    }
    result = result[path]
  }
  return result as T
}

const deep = (value: any, prefix = ""): any => {
  const isArr = Array.isArray(value)
  if (isArr || isPojo(value)) {
    const deepObj = (isArr ? [] : {}) as Record<string, Signal<any>>
    for (const key in value) {
      deepObj[key] = signal(deep((value as Record<string, Signal<any>>)[key], `${prefix + key}.`))
    }
    const keys = signal(0)
    return new Proxy(deepObj, {
      get(_, prop: string) {
        if (!(prop === "toJSON" && !hasOwn(deepObj, prop))) {
          if (isArr && prop in Array.prototype) {
            keys()
            return deepObj[prop]
          }
          if (typeof prop === "symbol") {
            return deepObj[prop]
          }
          if (!hasOwn(deepObj, prop) || deepObj[prop]() == null) {
            deepObj[prop] = signal("")
            dispatch(prefix + prop, "")
            keys(keys() + 1)
          }
          return deepObj[prop]()
        }
      },
      set(_, prop: string, newValue) {
        const path = prefix + prop
        if (isArr && prop === "length") {
          const diff = (deepObj[prop] as unknown as number) - newValue
          deepObj[prop] = newValue
          if (diff > 0) {
            const patch: Record<string, any> = {}
            for (let i = newValue; i < deepObj[prop]; i++) {
              patch[i] = null
            }
            dispatch(prefix.slice(0, -1), patch)
            keys(keys() + 1)
          }
        } else if (hasOwn(deepObj, prop)) {
          if (newValue == null) {
            delete deepObj[prop]
          } else if (hasOwn(newValue, computedSymbol)) {
            deepObj[prop] = newValue
            dispatch(path, "")
          } else {
            const currentValue = deepObj[prop]()
            const pathStr = `${path}.`
            if (isPojo(currentValue) && isPojo(newValue)) {
              for (const key in currentValue) {
                if (!hasOwn(newValue, key)) {
                  delete currentValue[key]
                  dispatch(pathStr + key, null)
                }
              }
              for (const key in newValue) {
                const nextVal = newValue[key]
                if (currentValue[key] !== nextVal) {
                  currentValue[key] = nextVal
                }
              }
            } else if (deepObj[prop](deep(newValue, pathStr))) {
              dispatch(path, newValue)
            }
          }
        } else if (newValue != null) {
          if (hasOwn(newValue, computedSymbol)) {
            deepObj[prop] = newValue
            dispatch(path, "")
          } else {
            deepObj[prop] = signal(deep(newValue, `${path}.`))
            dispatch(path, newValue)
          }
          keys(keys() + 1)
        }

        return true
      },
      deleteProperty(_, prop: string) {
        delete deepObj[prop]
        keys(keys() + 1)
        return true
      },
      ownKeys() {
        keys()
        return Reflect.ownKeys(deepObj)
      },
      has(_, prop) {
        keys()
        return prop in deepObj
      },
    })
  }
  return value
}

const dispatch = (path?: string, value?: any) => {
  if (path !== undefined && value !== undefined) {
    currentPatch.push([path, value])
  }
  if (!batchDepth && currentPatch.length) {
    const detail = pathToObj(currentPatch)
    currentPatch.length = 0
    document.dispatchEvent(
      new CustomEvent<JSONPatch>(DATASTAR_SIGNAL_PATCH_EVENT, {
        detail,
      }),
    )
  }
}

export const mergePatch = (patch: JSONPatch, { ifMissing }: MergePatchArgs = {}): void => {
  beginBatch()
  for (const key in patch) {
    if (patch[key] == null) {
      if (!ifMissing) {
        delete root[key]
      }
    } else {
      mergeInner(patch[key], key, root, "", ifMissing)
    }
  }
  endBatch()
}

export const mergePaths = (paths: Paths, options?: MergePatchArgs): void =>
  mergePatch(pathToObj(paths), options)

const mergeInner = (
  patch: any,
  target: string,
  targetParent: Record<string, any>,
  prefix: string,
  ifMissing: boolean | undefined,
): void => {
  if (isPojo(patch)) {
    if (
      !(
        hasOwn(targetParent, target) &&
        (isPojo(targetParent[target]) || Array.isArray(targetParent[target]))
      )
    ) {
      targetParent[target] = {}
    }

    for (const key in patch) {
      if (patch[key] == null) {
        if (!ifMissing) {
          delete targetParent[target][key]
        }
      } else {
        mergeInner(patch[key], key, targetParent[target], `${prefix + target}.`, ifMissing)
      }
    }
  } else if (!(ifMissing && hasOwn(targetParent, target))) {
    targetParent[target] = patch
  }
}

const toRegExp = (val: string | RegExp): RegExp =>
  typeof val === "string" ? RegExp(val.replace(/^\/|\/$/g, "")) : val

export const filtered = (
  { include = /.*/, exclude = /(?!)/ }: SignalFilterOptions = {},
  obj: JSONPatch = root,
): Record<string, any> => {
  const includeRe = toRegExp(include)
  const excludeRe = toRegExp(exclude)
  const paths: Paths = []
  const stack: Array<[any, string]> = [[obj, ""]]

  while (stack.length) {
    const [node, prefix] = stack.pop()!

    for (const key in node) {
      const path = prefix + key
      if (isPojo(node[key])) {
        stack.push([node[key], `${path}.`])
      } else if (includeRe.test(path) && !excludeRe.test(path)) {
        paths.push([path, getPath(path)])
      }
    }
  }

  return pathToObj(paths)
}

export const root: Record<string, any> = deep({})

/*********
 * engine.ts (plugin system)
 *********/
const url = "https://data-star.dev/errors"

const error = (ctx: Record<string, any>, reason: string, metadata: Record<string, any> = {}) => {
  Object.assign(metadata, ctx)
  const e = new Error()
  const r = snake(reason)
  const q = new URLSearchParams({
    metadata: JSON.stringify(metadata),
  }).toString()
  const c = JSON.stringify(metadata, null, 2)
  e.message = `${reason}\nMore info: ${url}/${r}?${q}\nContext: ${c}`
  return e
}

const actionPlugins: Map<string, ActionPlugin> = new Map()
const attributePlugins: Map<string, AttributePlugin> = new Map()
const watcherPlugins: Map<string, WatcherPlugin> = new Map()

export const actions: Record<string, (ctx: ActionContext, ...args: Array<any>) => any> = new Proxy(
  {},
  {
    get: (_, prop: string) => actionPlugins.get(prop)?.apply,
    has: (_, prop: string) => actionPlugins.has(prop),
    ownKeys: () => Reflect.ownKeys(actionPlugins),
    set: () => false,
    deleteProperty: () => false,
  },
)

const removals = new Map<HTMLOrSVG, Map<string, Map<string, () => void>>>()

const queuedAttributes: Array<AttributePlugin> = []
const queuedAttributeNames = new Set<string>()
const observedRoots = new WeakSet<Node>()
export const attribute = <R extends Requirement, B extends boolean>(
  plugin: AttributePlugin<R, B>,
): void => {
  queuedAttributes.push(plugin as unknown as AttributePlugin)

  if (queuedAttributes.length === 1) {
    setTimeout(() => {
      for (const attribute of queuedAttributes) {
        queuedAttributeNames.add(attribute.name)
        attributePlugins.set(attribute.name, attribute)
      }
      queuedAttributes.length = 0
      apply()
      queuedAttributeNames.clear()
    })
  }
}

export const action = <T>(plugin: ActionPlugin<T>): void => {
  actionPlugins.set(plugin.name, plugin)
}

document.addEventListener(DATASTAR_FETCH_EVENT, ((evt: CustomEvent<DatastarFetchEvent>) => {
  const plugin = watcherPlugins.get(evt.detail.type)
  if (plugin) {
    plugin.apply(
      {
        error: error.bind(0, {
          plugin: { type: "watcher", name: plugin.name },
          element: {
            id: (evt.target as Element).id,
            tag: (evt.target as Element).tagName,
          },
        }),
      },
      evt.detail.argsRaw,
    )
  }
}) as EventListener)

export const watcher = (plugin: WatcherPlugin): void => {
  watcherPlugins.set(plugin.name, plugin)
}

const cleanupEls = (els: Iterable<HTMLOrSVG>): void => {
  for (const el of els) {
    const elCleanups = removals.get(el)
    if (elCleanups && removals.delete(el)) {
      for (const attrCleanups of elCleanups.values()) {
        for (const cleanup of attrCleanups.values()) {
          cleanup()
        }
      }
    }
  }
}

const aliasedIgnore = aliasify("ignore")
const aliasedIgnoreAttr = `[${aliasedIgnore}]`
const shouldIgnore = (el: HTMLOrSVG) =>
  el.hasAttribute(`${aliasedIgnore}__self`) || !!el.closest(aliasedIgnoreAttr)

const applyEls = (els: Iterable<HTMLOrSVG>, onlyNew?: boolean): void => {
  for (const el of els) {
    if (!shouldIgnore(el)) {
      for (const key in el.dataset) {
        applyAttributePlugin(
          el,
          key.replace(/[A-Z]/g, "-$&").toLowerCase(),
          el.dataset[key]!,
          onlyNew,
        )
      }
    }
  }
}

const observe = (mutations: Array<MutationRecord>) => {
  for (const { target, type, attributeName, addedNodes, removedNodes } of mutations) {
    if (type === "childList") {
      for (const node of removedNodes) {
        if (isHTMLOrSVG(node)) {
          cleanupEls([node])
          cleanupEls(node.querySelectorAll<HTMLOrSVG>("*"))
        }
      }

      for (const node of addedNodes) {
        if (isHTMLOrSVG(node)) {
          applyEls([node])
          applyEls(node.querySelectorAll<HTMLOrSVG>("*"))
        }
      }
    } else if (
      type === "attributes" &&
      attributeName!.startsWith("data-") &&
      isHTMLOrSVG(target) &&
      !shouldIgnore(target)
    ) {
      const key = attributeName!.slice(5)
      const value = target.getAttribute(attributeName!)
      if (value === null) {
        const elCleanups = removals.get(target)
        if (elCleanups) {
          const attrCleanups = elCleanups.get(key)
          if (attrCleanups) {
            for (const cleanup of attrCleanups.values()) {
              cleanup()
            }
            elCleanups.delete(key)
          }
        }
      } else {
        applyAttributePlugin(target, key, value)
      }
    }
  }
}

const mutationObserver = new MutationObserver(observe)

export const parseAttributeKey = (
  rawKey: string,
): {
  pluginName: string
  key: string | undefined
  mods: Modifiers
} => {
  const [namePart, ...rawModifiers] = rawKey.split("__")
  const [pluginName, key] = namePart.split(/:(.+)/)
  const mods: Modifiers = new Map()

  for (const rawMod of rawModifiers) {
    const [label, ...mod] = rawMod.split(".")
    mods.set(label, new Set(mod))
  }

  return { pluginName, key, mods }
}

export const isDocumentObserverActive = () => observedRoots.has(document.documentElement)

export const apply = (
  root: HTMLOrSVG | ShadowRoot = document.documentElement,
  observeRoot = true,
): void => {
  if (isHTMLOrSVG(root)) {
    applyEls([root], true)
  }
  applyEls(root.querySelectorAll<HTMLOrSVG>("*"), true)

  if (observeRoot) {
    mutationObserver.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
    })
    observedRoots.add(root)
  }
}

const applyAttributePlugin = (
  el: HTMLOrSVG,
  attrKey: string,
  value: string,
  onlyNew?: boolean,
): void => {
  const rawKey = attrKey
  const { pluginName, key, mods } = parseAttributeKey(rawKey)
  const plugin = attributePlugins.get(pluginName)
  if ((!onlyNew || queuedAttributeNames.has(pluginName)) && plugin) {
    const ctx = {
      el,
      rawKey,
      mods,
      error: error.bind(0, {
        plugin: { type: "attribute", name: plugin.name },
        element: { id: el.id, tag: el.tagName },
        expression: { rawKey, key, value },
      }),
      key,
      value,
      loadedPluginNames: {
        actions: new Set(actionPlugins.keys()),
        attributes: new Set(attributePlugins.keys()),
      },
      rx: undefined,
    } as AttributeContext

    const keyReq =
      (plugin.requirement &&
        (typeof plugin.requirement === "string" ? plugin.requirement : plugin.requirement.key)) ||
      "allowed"
    const valueReq =
      (plugin.requirement &&
        (typeof plugin.requirement === "string" ? plugin.requirement : plugin.requirement.value)) ||
      "allowed"

    const keyProvided = key !== undefined && key !== null && key !== ""
    const valueProvided = value !== undefined && value !== null && value !== ""

    if (keyProvided) {
      if (keyReq === "denied") {
        throw ctx.error("KeyNotAllowed")
      }
    } else if (keyReq === "must") {
      throw ctx.error("KeyRequired")
    }

    if (valueProvided) {
      if (valueReq === "denied") {
        throw ctx.error("ValueNotAllowed")
      }
    } else if (valueReq === "must") {
      throw ctx.error("ValueRequired")
    }

    if (keyReq === "exclusive" || valueReq === "exclusive") {
      if (keyProvided && valueProvided) {
        throw ctx.error("KeyAndValueProvided")
      }
      if (!keyProvided && !valueProvided) {
        throw ctx.error("KeyOrValueRequired")
      }
    }

    const cleanups = new Map<string, () => void>()
    if (valueProvided) {
      let cachedRx: GenRxFn
      ctx.rx = (...args: Array<any>) => {
        if (!cachedRx) {
          cachedRx = genRx(value, {
            returnsValue: plugin.returnsValue,
            argNames: plugin.argNames,
            cleanups,
          })
        }
        return cachedRx(el, ...args)
      }
    }

    const cleanup = plugin.apply(ctx)
    if (cleanup) {
      cleanups.set("attribute", cleanup)
    }

    let elCleanups = removals.get(el)
    if (elCleanups) {
      const attrCleanups = elCleanups.get(rawKey)
      if (attrCleanups) {
        for (const oldCleanup of attrCleanups.values()) {
          oldCleanup()
        }
      }
    } else {
      elCleanups = new Map()
      removals.set(el, elCleanups)
    }
    elCleanups.set(rawKey, cleanups)
  }
}

type GenRxOptions = {
  returnsValue?: boolean
  argNames?: Array<string>
  cleanups?: Map<string, () => void>
}

type GenRxFn = <T>(el: HTMLOrSVG, ...args: Array<any>) => T

const genRx = (
  value: string,
  { returnsValue = false, argNames = [], cleanups = new Map() }: GenRxOptions = {},
): GenRxFn => {
  if (/^\s*(?:async\s+)?(?:\(.*?\)\s*=>|[\w$]+\s*=>|function\s*[\w$]*\s*\()/.test(value)) {
    const userFn = Function(`return (${value.trim()})`)()

    return (el: HTMLOrSVG, ...args: Array<any>) => {
      const actionsProxy = new Proxy({} as Record<string, any>, {
        get:
          (_, name: string) =>
          (...actionArgs: any[]) => {
            const err = error.bind(0, {
              plugin: { type: "action", name },
              element: { id: el.id, tag: el.tagName },
              expression: { fnContent: value, value },
            })
            const fn = actions[name]
            if (fn) return fn({ el, evt: undefined, error: err, cleanups }, ...actionArgs)
            throw err("UndefinedAction")
          },
      })

      const dataEvt = args[0] instanceof Event ? args[0] : new Event("datastar:expression")
      Object.defineProperties(dataEvt, {
        target: { value: el },
        signals: { value: root },
        actions: { value: actionsProxy },
        window: { value: window },
      })

      try {
        return userFn(dataEvt)
      } catch (e: any) {
        console.error(e)
        throw error(
          {
            element: { id: el.id, tag: el.tagName },
            expression: { fnContent: value, value },
            error: e.message,
          },
          "ExecuteExpression",
        )
      }
    }
  }

  let expr = ""
  if (returnsValue) {
    const statementRe =
      /(\/(\\\/|[^/])*\/|"(\\"|[^"])*"|'(\\'|[^'])*'|`(\\`|[^`])*`|\(\s*((function)\s*\(\s*\)|(\(\s*\))\s*=>)\s*(?:\{[\s\S]*?\}|[^;){]*)\s*\)\s*\(\s*\)|[^;])+/gm
    const statements = value.trim().match(statementRe)
    if (statements) {
      const lastIdx = statements.length - 1
      const last = statements[lastIdx].trim()
      if (!last.startsWith("return")) {
        statements[lastIdx] = `return (${last});`
      }
      expr = statements.join(";\n")
    }
  } else {
    expr = value.trim()
  }

  const escaped = new Map<string, string>()
  const escapeRe = RegExp(`(?:${DSP})(.*?)(?:${DSS})`, "gm")
  let counter = 0
  for (const match of expr.matchAll(escapeRe)) {
    const k = match[1]
    const v = `__escaped${counter++}`
    escaped.set(v, k)
    expr = expr.replace(DSP + k + DSS, v)
  }

  expr = expr
    .replace(/\$\['([a-zA-Z_$\d][\w$]*)'\]/g, "$$$1")
    .replace(/\$([a-zA-Z_\d]\w*(?:[.-]\w+)*)/g, (_, signalName) =>
      signalName.split(".").reduce((acc: string, part: string) => `${acc}['${part}']`, "$"),
    )

  expr = expr.replaceAll(/@([A-Za-z_$][\w$]*)\(/g, '__action("$1",evt,')

  for (const [k, v] of escaped) {
    expr = expr.replace(k, v)
  }

  try {
    const fn = Function("el", "$", "__action", "evt", ...argNames, expr)
    return (el: HTMLOrSVG, ...args: Array<any>) => {
      const action = (name: string, evt: Event | undefined, ...args: Array<any>) => {
        const err = error.bind(0, {
          plugin: { type: "action", name },
          element: { id: el.id, tag: el.tagName },
          expression: {
            fnContent: expr,
            value,
          },
        })
        const fn = actions[name]
        if (fn) {
          return fn(
            {
              el,
              evt,
              error: err,
              cleanups,
            },
            ...args,
          )
        }
        throw err("UndefinedAction")
      }
      try {
        return fn(el, root, action, undefined, ...args)
      } catch (e: any) {
        console.error(e)
        throw error(
          {
            element: { id: el.id, tag: el.tagName },
            expression: {
              fnContent: expr,
              value,
            },
            error: e.message,
          },
          "ExecuteExpression",
        )
      }
    }
  } catch (e: any) {
    console.error(e)
    throw error(
      {
        expression: {
          fnContent: expr,
          value,
        },
        error: e.message,
      },
      "GenerateExpression",
    )
  }
}
