/**
 * Ported from effect@4.0.0-rc.112.
 */
import type * as FileSystem from "effect/FileSystem"
import type * as Layer from "effect/Layer"
import * as NodeFileSystem from "../node/NodeFileSystem.ts"

export const layer: Layer.Layer<FileSystem.FileSystem> = NodeFileSystem.layer
