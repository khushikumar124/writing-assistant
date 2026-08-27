import { publicProcedure, router } from "./_core/trpc";
import { accountRouter } from "./routers/account";
import { authRouter } from "./routers/auth";
import { categoriesRouter } from "./routers/categories";
import { draftsRouter } from "./routers/drafts";
import { ideasRouter } from "./routers/ideas";
import { profileRouter } from "./routers/profile";
import { promptsRouter } from "./routers/prompts";
import { searchRouter } from "./routers/search";
import { statsRouter } from "./routers/stats";
import { thoughtsRouter } from "./routers/thoughts";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    at: new Date().toISOString(),
  })),
  auth: authRouter,
  account: accountRouter,
  ideas: ideasRouter,
  categories: categoriesRouter,
  drafts: draftsRouter,
  thoughts: thoughtsRouter,
  stats: statsRouter,
  prompts: promptsRouter,
  profile: profileRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
