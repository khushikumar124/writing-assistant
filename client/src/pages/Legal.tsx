import { Button } from "@/components/ui/button";
import { Feather } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

/**
 * Privacy and terms.
 *
 * Written as plain sentences rather than boilerplate, because the reader is a
 * person deciding whether to trust this with unpublished work, and a wall of
 * borrowed legalese answers none of what they actually want to know. Google's
 * OAuth consent screen also wants a privacy URL, so this has to exist before
 * anyone can sign in at all.
 *
 * This is an honest description of what the software does — it is not legal
 * advice, and if the project ever takes money or grows a company around it,
 * both documents should be reviewed by someone qualified.
 */

const UPDATED = "28 August 2026";

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Feather className="size-5 text-primary" aria-hidden />
            <span className="font-semibold tracking-tight text-primary">
              Writing Assistant
            </span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Back</Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-2xl py-16">
        <h1 className="mb-2 text-4xl">{title}</h1>
        <p className="typewriter mb-10 text-muted-foreground">
          Last updated {UPDATED}
        </p>
        <div className="space-y-8 leading-relaxed">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="container flex h-16 items-center gap-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl">{heading}</h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Privacy() {
  return (
    <Frame title="Privacy">
      <p className="text-lg text-foreground">
        Short version: your writing is yours, it is never used to train
        anything, it is never sold, and you can take it with you or delete it
        outright at any moment without asking anyone.
      </p>

      <Section heading="What is stored">
        <p>
          <strong className="text-foreground">
            From Google, when you sign in:
          </strong>{" "}
          your name, email address, profile picture URL, and the account
          identifier Google uses for you. That is the whole of it — the sign-in
          asks for no other permission, and has no access to your Gmail, Drive,
          contacts or anything else.
        </p>
        <p>
          <strong className="text-foreground">What you write:</strong> the
          thoughts you capture, the ideas you build, the drafts you type, the
          prompts you add, and the record of which days you wrote on. This is
          held so the app can show it back to you.
        </p>
        <p>
          <strong className="text-foreground">If you turn on reminders:</strong>{" "}
          a push subscription for that browser, your chosen schedule, and your
          timezone.
        </p>
      </Section>

      <Section heading="What is never done with it">
        <p>
          Your drafts are not used to train a model, and no model reads them.
          The app contains no AI features at all — every prompt in it was
          written by a person. Nothing is sold, rented or shared with
          advertisers. There is no advertising, no third-party analytics, and no
          tracking pixels.
        </p>
      </Section>

      <Section heading="Who can see your writing">
        <p>
          Only you, unless you deliberately publish. Marking a piece as shipped
          and switching your shelf to public exposes exactly four things about
          those pieces: the title, the description you wrote, where and when it
          was published, and the link. Draft prose, thoughts, streaks and
          anything in the bin are never exposed by that setting.
        </p>
        <p>
          The person operating this server can technically read the database, as
          is true of any self-hosted application. Nobody else has access.
        </p>
      </Section>

      <Section heading="How long it is kept">
        <p>
          Deleted ideas and thoughts sit in the bin for 30 days so a stray click
          is survivable, then they are removed. Sandbox accounts from the "try
          it without an account" button delete themselves, and everything in
          them, after 24 hours. Everything else is kept until you delete it.
        </p>
      </Section>

      <Section heading="Taking it with you, or leaving">
        <p>
          Settings has a{" "}
          <strong className="text-foreground">Download everything</strong>{" "}
          button that exports every thought, idea and draft as a single file,
          including whatever is in the bin.
        </p>
        <p>
          The same page has{" "}
          <strong className="text-foreground">Delete your account</strong>. That
          is a real deletion, not a deactivation: the account row and everything
          attached to it is removed immediately and permanently, and it cannot
          be recovered afterwards — not by you, and not by whoever runs the
          server. You do not have to email anyone or explain yourself.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          One cookie, holding your signed-in session. It is not used for
          tracking, and there are no third-party cookies, which is why this site
          has no consent banner.
        </p>
      </Section>

      <Section heading="Where it is stored">
        <p>
          On a single server, in whichever region the operator chose, in one
          SQLite database file. If you are in a country with data-protection law
          — the GDPR in Europe, the DPDP Act in India, and others — the rights
          those laws describe are the same ones the two buttons above already
          give you, without a request process.
        </p>
      </Section>

      <Section heading="Changes and contact">
        <p>
          If this document changes in a way that matters, the date at the top
          changes with it. Questions go to whoever operates this instance.
        </p>
      </Section>
    </Frame>
  );
}

export function Terms() {
  return (
    <Frame title="Terms">
      <p className="text-lg text-foreground">
        Short version: it is a writing app, it is provided as-is, your work is
        yours, and please do not use it to hurt anyone.
      </p>

      <Section heading="What you are agreeing to">
        <p>
          Using the app means accepting what is written here and in the{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            privacy note
          </Link>
          . If you do not, the honest answer is not to use it.
        </p>
      </Section>

      <Section heading="Your writing belongs to you">
        <p>
          Everything you write here stays yours. No ownership of it is claimed,
          no licence to republish it is taken, and nothing you write is used for
          any purpose beyond showing it back to you. Publishing a shelf is a
          choice you make piece by piece.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          One person per account, and you are responsible for what happens under
          yours. Access depends on your Google account: if you lose that, there
          is no password fallback and no recovery path, because the app never
          held a second credential to fall back on.
        </p>
      </Section>

      <Section heading="What is not allowed">
        <p>
          Do not use this to store or publish anything illegal, to harass
          anyone, to impersonate someone, or to attack the service — scraping
          it, hammering it, or trying to reach other people's writing. Accounts
          doing any of that can be removed without notice.
        </p>
      </Section>

      <Section heading="No guarantees">
        <p>
          This is offered as-is, with no warranty. It may be unavailable, it may
          lose data, and it may stop existing. Keep your own copy of anything
          you would be upset to lose — the export button exists for exactly
          this, and using it occasionally is a reasonable habit for any hosted
          tool.
        </p>
        <p>
          To the extent the law allows, the operator is not liable for losses
          arising from using or being unable to use the app.
        </p>
      </Section>

      <Section heading="Ending it">
        <p>
          Delete your account whenever you like, from Settings, with no notice
          period and no exit interview. The operator may close accounts that
          break these terms, or shut the service down entirely — in which case
          reasonable notice will be given so you can export your work.
        </p>
      </Section>
    </Frame>
  );
}
