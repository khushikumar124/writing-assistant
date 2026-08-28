import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import { consume, WRITE_LIMIT } from "./rateLimit";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Every mutation is rate limited per account. Reads are left alone: they are
 * cheap, cached by the client, and throttling them would break the app under
 * normal use long before it stopped anyone malicious.
 */
const limitWrites = t.middleware(async opts => {
  if (opts.type === "mutation" && opts.ctx.user) {
    consume(`write:${opts.ctx.user.id}`, WRITE_LIMIT);
  }
  return opts.next();
});

export const protectedProcedure = t.procedure.use(requireUser).use(limitWrites);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
