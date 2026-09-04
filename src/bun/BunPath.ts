/**
 * Ported from effect@4.0.0-rc.112.
 */
import type * as Layer from "effect/Layer"
import type * as Path from "effect/Path"
import * as NodePath from "../node/NodePath.ts"

export const layer: Layer.Layer<Path.Path> = NodePath.layer

export const layerPosix: Layer.Layer<Path.Path> = NodePath.layerPosix

export const layerWin32: Layer.Layer<Path.Path> = NodePath.layerWin32
