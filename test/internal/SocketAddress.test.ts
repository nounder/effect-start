import * as test from "bun:test"
import * as SocketAddress from "../../src/internal/SocketAddress.ts"

test.describe("hostname", () => {
  test.test("returns the TcpAddress hostname", () => {
    test
      .expect(SocketAddress.hostname(SocketAddress.tcp("example.com", 8080)))
      .toBe("example.com")
  })

  test.test("returns the WorkerAddress hostname", () => {
    test
      .expect(SocketAddress.hostname(SocketAddress.worker("my-worker.workers.dev", 443)))
      .toBe("my-worker.workers.dev")
  })

  test.test("falls back to localhost for UnixAddress", () => {
    test
      .expect(SocketAddress.hostname(SocketAddress.unix("/tmp/app.sock")))
      .toBe("localhost")
  })
})

test.describe("port", () => {
  test.test("returns the TcpAddress port", () => {
    test
      .expect(SocketAddress.port(SocketAddress.tcp("example.com", 8080)))
      .toBe(8080)
  })

  test.test("returns the WorkerAddress port", () => {
    test
      .expect(SocketAddress.port(SocketAddress.worker("example.com", 8443)))
      .toBe(8443)
  })

  test.test("falls back to 0 for UnixAddress", () => {
    test
      .expect(SocketAddress.port(SocketAddress.unix("/tmp/app.sock")))
      .toBe(0)
  })
})

test.describe("worker", () => {
  test.test("defaults to workers.dev on port 443", () => {
    const address = SocketAddress.worker()

    test
      .expect(address)
      .toEqual({ _tag: "WorkerAddress", hostname: "workers.dev", port: 443 })
  })

  test.test("accepts a custom hostname and port", () => {
    const address = SocketAddress.worker("my-app.example.com", 8443)

    test
      .expect(address)
      .toEqual({ _tag: "WorkerAddress", hostname: "my-app.example.com", port: 8443 })
  })
})

test.describe("urlOf", () => {
  test.test("uses https by default for a WorkerAddress", () => {
    test
      .expect(SocketAddress.urlOf(SocketAddress.worker("my-app.workers.dev", 443)))
      .toBe("https://my-app.workers.dev:443")
  })

  test.test("uses http by default for a TcpAddress", () => {
    test
      .expect(SocketAddress.urlOf(SocketAddress.tcp("example.com", 3000)))
      .toBe("http://example.com:3000")
  })

  test.test("rewrites wildcard binds to localhost", () => {
    test
      .expect(SocketAddress.urlOf(SocketAddress.tcp("0.0.0.0", 3000)))
      .toBe("http://localhost:3000")
    test
      .expect(SocketAddress.urlOf(SocketAddress.tcp("::", 3000)))
      .toBe("http://localhost:3000")
  })

  test.test("drops the path for a UnixAddress", () => {
    test
      .expect(SocketAddress.urlOf(SocketAddress.unix("/tmp/app.sock")))
      .toBe("http://localhost")
  })

  test.test("accepts an explicit scheme override", () => {
    test
      .expect(SocketAddress.urlOf(SocketAddress.tcp("example.com", 443), "https"))
      .toBe("https://example.com:443")
  })
})
