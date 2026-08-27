import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clearSessionCookie } from "../_core/auth";
import { protectedProcedure, router } from "../_core/trpc";
import { deleteAccount, exportAccount, findUserById } from "../db";

/**
 * Leaving.
 *
 * Deletion is irreversible and immediate — no grace period, no "deactivated"
 * limbo. If someone asks to be gone, the honest thing is to be gone, and the
 * bin's 30-day window is for stray clicks inside the app, not for this.
 *
 * The export exists so that decision never costs someone their writing.
 */
export const accountRouter = router({
  /** Everything the account owns, as one JSON document the client saves. */
  exportData: protectedProcedure.query(({ ctx }) => exportAccount(ctx.user.id)),

  /**
   * Deletes the account and all of its writing.
   *
   * The typed confirmation is checked on the server as well as in the dialog:
   * a client-side-only guard is a suggestion, and this is the one call in the
   * app that nothing can undo.
   */
  delete: protectedProcedure
    .input(z.object({ confirmation: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await findUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found.",
        });
      }

      // Match on the email so the phrase is specific to this account, which
      // makes it useless to muscle-memory through.
      if (
        input.confirmation.trim().toLowerCase() !== user.email.toLowerCase()
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That didn't match your email address, so nothing was deleted.",
        });
      }

      const deleted = await deleteAccount(user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not delete the account. Nothing was changed.",
        });
      }

      // The session now points at a row that no longer exists; clear it so the
      // browser isn't left holding a cookie for a deleted account.
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),
});
