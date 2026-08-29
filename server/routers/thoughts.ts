import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createIdea,
  createThought,
  deleteThought,
  getThoughtsByIds,
  linkThoughtsToIdea,
  listArchivedThoughts,
  listDeletedThoughts,
  listThoughts,
  listThoughtsForIdea,
  listUnlinkedThoughts,
  restoreThought,
  setThoughtArchived,
  softDeleteThought,
  updateThought,
} from "../db";

const thoughtIds = z.array(z.number().int().positive()).min(1).max(50);

export const thoughtsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listThoughts(ctx.user.id)),

  /** Thoughts with no idea attached yet — the merge candidates. */
  listUnlinked: protectedProcedure.query(({ ctx }) =>
    listUnlinkedThoughts(ctx.user.id)
  ),

  /** The side rail in the editor: everything feeding this one idea. */
  listForIdea: protectedProcedure
    .input(z.object({ ideaId: z.number().int().positive() }))
    .query(({ ctx, input }) => listThoughtsForIdea(input.ideaId, ctx.user.id)),

  listDeleted: protectedProcedure.query(({ ctx }) =>
    listDeletedThoughts(ctx.user.id)
  ),

  /** The capture box. Deliberately minimal — content is the only requirement. */
  create: protectedProcedure
    .input(
      z.object({
        content: z.string().trim().min(1, "Write something first.").max(5000),
        tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      createThought({
        userId: ctx.user.id,
        content: input.content,
        tags: input.tags?.length ? JSON.stringify(input.tags) : null,
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        content: z.string().trim().min(1).max(5000).optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tags, ...rest } = input;
      const updated = await updateThought(id, ctx.user.id, {
        ...rest,
        ...(tags ? { tags: JSON.stringify(tags) } : {}),
      });
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That thought no longer exists.",
        });
      }
      return updated;
    }),

  /**
   * Promotes a single raw thought into a full idea, keeping the thought linked
   * so the original wording isn't lost.
   */
  promoteToIdea: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(200),
        category: z.string().trim().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [thought] = await getThoughtsByIds([input.id], ctx.user.id);
      if (!thought) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That thought no longer exists.",
        });
      }

      const idea = await createIdea({
        userId: ctx.user.id,
        title: input.title,
        description: thought.content,
        category: input.category,
        status: "draft",
      });

      await linkThoughtsToIdea([thought.id], idea.id, ctx.user.id);
      return idea;
    }),

  /**
   * The forge: several scattered thoughts become one idea.
   *
   * The thoughts stay put and stay linked rather than being consumed — the pile
   * is a record of how the piece came together, and the editor's side rail
   * reads from exactly this link.
   */
  mergeIntoIdea: protectedProcedure
    .input(
      z.object({
        ids: thoughtIds,
        title: z.string().trim().min(1, "Give the idea a title.").max(200),
        category: z.string().trim().min(1, "Pick a category.").max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const thoughts = await getThoughtsByIds(input.ids, ctx.user.id);
      if (thoughts.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Those thoughts no longer exist.",
        });
      }

      const idea = await createIdea({
        userId: ctx.user.id,
        title: input.title,
        description: `Built from ${thoughts.length} thought${thoughts.length === 1 ? "" : "s"}.`,
        category: input.category,
        status: "draft",
      });

      await linkThoughtsToIdea(
        thoughts.map(thought => thought.id),
        idea.id,
        ctx.user.id
      );

      return { idea, merged: thoughts.length };
    }),

  /** Attach or detach thoughts from an idea, from the editor's side rail. */
  link: protectedProcedure
    .input(
      z.object({
        ids: thoughtIds,
        ideaId: z.number().int().positive().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const linked = await linkThoughtsToIdea(
        input.ids,
        input.ideaId,
        ctx.user.id
      );
      return { linked };
    }),

  /** Moves to the bin. Undoable from the toast, or from the bin later. */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await softDeleteThought(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That thought no longer exists.",
        });
      }
      return { success: true, id: input.id } as const;
    }),

  listArchived: protectedProcedure.query(({ ctx }) =>
    listArchivedThoughts(ctx.user.id)
  ),

  /** Same shape as the ideas router: state, not direction, so undo is trivial. */
  setArchived: protectedProcedure
    .input(
      z.object({ id: z.number().int().positive(), archived: z.boolean() })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await setThoughtArchived(
        input.id,
        ctx.user.id,
        input.archived
      );
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That thought no longer exists.",
        });
      }
      return { success: true, id: input.id, archived: input.archived } as const;
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const restored = await restoreThought(input.id, ctx.user.id);
      if (!restored) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That thought is gone for good.",
        });
      }
      return restored;
    }),

  deleteForever: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteThought(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That thought no longer exists.",
        });
      }
      return { success: true } as const;
    }),
});
