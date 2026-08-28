import CaptureButton from "@/components/CaptureButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { SHORTCUTS, useShortcuts } from "@/hooks/useShortcuts";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Compass,
  Feather,
  Keyboard,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Search,
  Send,
  Settings,
  Trash2,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/thoughts", label: "Thoughts", icon: Feather },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/shipped", label: "Shipped", icon: Send },
  { href: "/discover", label: "Discover", icon: Compass },
];

/** Chrome shared by every signed-in page: nav, capture, search, account menu. */
export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, isLoggingOut } = useAuth();
  const [location] = useLocation();
  const { helpOpen, setHelpOpen } = useShortcuts();
  const { data: profile } = trpc.profile.mine.useQuery();

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* A sandbox is temporary, and saying so up front is more honest than
          letting someone write for an hour and lose it. */}
      {profile?.demoExpiresAt && (
        <div className="bg-accent px-4 py-2 text-center text-sm text-accent-foreground">
          You're in a sandbox — it clears itself{" "}
          {profile.demoExpiresAt.toLocaleDateString(undefined, {
            weekday: "long",
          })}
          .{" "}
          <Link
            href="/signin"
            className="font-semibold underline underline-offset-4"
          >
            Make an account to keep this
          </Link>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Feather className="size-5 text-primary" aria-hidden />
            <span className="hidden font-semibold tracking-tight text-primary sm:block">
              Writing Assistant
            </span>
          </Link>

          {/* Desktop nav. On small screens this moves to the bottom bar. */}
          <nav
            className="hidden flex-1 items-center gap-1 md:flex"
            aria-label="Main"
          >
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-muted text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm" aria-label="Search">
              <Link href="/search">
                <Search className="size-4" aria-hidden />
              </Link>
            </Button>

            <CaptureButton />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Account">
                  <User className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {user?.name ?? user?.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 size-4" aria-hidden />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setHelpOpen(true)}>
                  <Keyboard className="mr-2 size-4" aria-hidden />
                  Keyboard shortcuts
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/trash">
                    <Trash2 className="mr-2 size-4" aria-hidden />
                    The bin
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isLoggingOut}
                  onSelect={() => void logout()}
                >
                  <LogOut className="mr-2 size-4" aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-8">{children}</main>

      {/* Press ? anywhere. Discoverable from the account menu too, since a
          shortcut nobody knows about helps nobody. */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {SHORTCUTS.map(shortcut => (
              <li
                key={shortcut.keys}
                className="flex items-center justify-between gap-4 py-2"
              >
                <span className="text-sm">{shortcut.does}</span>
                <kbd className="typewriter plate border border-line bg-muted px-2 py-1">
                  {shortcut.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Mobile nav: thumb-reachable, because capture happens on a phone. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        aria-label="Main"
      >
        <div className="flex items-stretch justify-around">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                isActive(href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
