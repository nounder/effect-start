export function createLoggingProxy(target, trace = false) {
  const log = trace ? console.trace : console.log

  return new Proxy(target, {
    get(obj, prop) {
      log(`Accessing property: ${String(prop)}`)
      return Reflect.get(obj, prop)
    },
    set(obj, prop, value) {
      log(`Setting property: ${String(prop)} to ${value}`)
      return Reflect.set(obj, prop, value)
    },
    deleteProperty(obj, prop) {
      log(`Deleting property: ${String(prop)}`)
      return Reflect.deleteProperty(obj, prop)
    },
    has(obj, prop) {
      log(`Checking existence of property: ${String(prop)}`)
      return Reflect.has(obj, prop)
    },
    ownKeys(obj) {
      log(`Retrieving own keys`)
      return Reflect.ownKeys(obj)
    },
    defineProperty(obj, prop, descriptor) {
      log(
        `Defining property: ${String(prop)} with descriptor:`,
        descriptor,
      )
      return Reflect.defineProperty(obj, prop, descriptor)
    },
    getOwnPropertyDescriptor(obj, prop) {
      log(`Getting descriptor for property: ${String(prop)}`)
      return Reflect.getOwnPropertyDescriptor(obj, prop)
    },
    getPrototypeOf(obj) {
      log(`Getting prototype`)
      return Reflect.getPrototypeOf(obj)
    },
    setPrototypeOf(obj, proto) {
      log(`Setting prototype`)
      return Reflect.setPrototypeOf(obj, proto)
    },
    isExtensible(obj) {
      log(`Checking if object is extensible`)
      return Reflect.isExtensible(obj)
    },
    preventExtensions(obj) {
      log(`Preventing extensions on object`)
      return Reflect.preventExtensions(obj)
    },
    apply(target, thisArg, args) {
      log(`Calling function with args:`, args)
      return Reflect.apply(target, thisArg, args)
    },
    construct(target, args, newTarget) {
      log(`Constructing object with args:`, args)
      return Reflect.construct(target, args, newTarget)
    },
  })
}
