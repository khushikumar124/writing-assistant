import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { PLATFORMS } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCategory,
  deleteCategory,
  getPreferences,
  listCategories,
  updateCategory,
  updatePreferences,
} from "../db";

const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour like #0d5f5f.");

export const categoriesRouter = router({
  list: protectedProcedure.query(({ ctx }) => listCategories(ctx.user.id)),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Name the category.").max(100),
        description: z.string().trim().max(500).optional(),
        color: hexColor.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await listCategories(ctx.user.id);
      const created = await createCategory({
        userId: ctx.user.id,
        name: input.name,
        description: input.description,
        color: input.color ?? "#0d5f5f",
        sortOrder: existing.length,
      });

      // `onConflictDoNothing` returns nothing when the name is already taken.
      if (!created) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `You already have a category called "${input.name}".`,
        });
      }
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(100).optional(),
        description: z.string().trim().max(500).optional(),
        color: hexColor.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const updated = await updateCategory(id, ctx.user.id, updates);
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That category no longer exists.",
        });
      }
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteCategory(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That category no longer exists.",
        });
      }
      return { success: true } as const;
    }),

  getPreferences: protectedProcedure.query(({ ctx }) =>
    getPreferences(ctx.user.id)
  ),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        defaultPlatform: z.enum(PLATFORMS).optional(),
        onboardingCompleted: z.boolean().optional(),
        /** 0 turns the goal off. Capped so a typo can't set an absurd target. */
        dailyWordGoal: z.number().int().min(0).max(20_000).optional(),
      })
    )
    .mutation(({ ctx, input }) => updatePreferences(ctx.user.id, input)),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        categories: z
          .array(z.string().trim().min(1).max(100))
          .max(20)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await listCategories(ctx.user.id);
      const known = new Set(
        existing.map(category => category.name.toLowerCase())
      );

      let sortOrder = existing.length;
      for (const name of input.categories ?? []) {
        if (known.has(name.toLowerCase())) continue;
        known.add(name.toLowerCase());
        await createCategory({
          userId: ctx.user.id,
          name,
          color: "#0d5f5f",
          sortOrder: sortOrder++,
        });
      }

      await updatePreferences(ctx.user.id, { onboardingCompleted: true });
      return { success: true } as const;
    }),
});
