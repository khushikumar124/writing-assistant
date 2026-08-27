/**
 * Single entry point for shared types.
 *
 * Table row types are re-exported `type`-only, so importing this from the
 * client never drags the Drizzle runtime into the browser bundle. Runtime
 * values (the enums) come from `./domain`, which has no dependencies.
 */

export type * from "../drizzle/schema";
export * from "./domain";
export * from "./_core/errors";
