import * as Schema from "effect/Schema"

export class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", {
  message: Schema.String,
}) {
  static readonly status = 400
}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {
  message: Schema.String,
}) {
  static readonly status = 401
}

export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  message: Schema.String,
}) {
  static readonly status = 403
}

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  message: Schema.String,
}) {
  static readonly status = 404
}

export class MethodNotAllowed extends Schema.TaggedError<MethodNotAllowed>()("MethodNotAllowed", {
  message: Schema.String,
}) {
  static readonly status = 405
}

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", {
  message: Schema.String,
}) {
  static readonly status = 409
}

export class Gone extends Schema.TaggedError<Gone>()("Gone", {
  message: Schema.String,
}) {
  static readonly status = 410
}

export class UnprocessableEntity extends Schema.TaggedError<UnprocessableEntity>()(
  "UnprocessableEntity",
  { message: Schema.String },
) {
  static readonly status = 422
}

export class TooManyRequests extends Schema.TaggedError<TooManyRequests>()("TooManyRequests", {
  message: Schema.String,
}) {
  static readonly status = 429
}

export class InternalServerError extends Schema.TaggedError<InternalServerError>()(
  "InternalServerError",
  { message: Schema.String },
) {
  static readonly status = 500
}

export class NotImplemented extends Schema.TaggedError<NotImplemented>()("NotImplemented", {
  message: Schema.String,
}) {
  static readonly status = 501
}

export class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()(
  "ServiceUnavailable",
  { message: Schema.String },
) {
  static readonly status = 503
}
