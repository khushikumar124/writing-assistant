import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { REMINDER_LABELS, REMINDER_FREQUENCIES } from "@shared/domain";
import type { ReminderFrequency } from "@shared/domain";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Reminders.
 *
 * Two separate things, deliberately shown as two steps: the browser's
 * permission (which only the browser can grant, and only from a click), and the
 * schedule (which is ours). Collapsing them into one switch is how you end up
 * with someone who has set a schedule and receives nothing.
 */
export default function ReminderSettings() {
  const { state, enable, disable } = usePushSubscription();
  const utils = trpc.useUtils();

  const { data: settings } = trpc.reminders.settings.useQuery();
  const [frequency, setFrequency] = useState<ReminderFrequency>("off");
  const [time, setTime] = useState("09:00");
  const [days, setDays] = useState<number[]>([]);

  useEffect(() => {
    if (!settings) return;
    setFrequency(settings.frequency as ReminderFrequency);
    setTime(settings.time);
    setDays(settings.days);
  }, [settings]);

  const update = trpc.reminders.update.useMutation({
    onSuccess: async () => {
      await utils.reminders.settings.invalidate();
      toast.success("Reminder schedule saved.");
    },
    onError: error => toast.error(error.message),
  });

  const test = trpc.reminders.test.useMutation({
    onSuccess: result => toast(result.message),
    onError: error => toast.error(error.message),
  });

  if (state === "unconfigured") {
    return (
      <Card className="space-y-2 p-6">
        <h2 className="text-xl">Reminders</h2>
        <p className="text-sm text-muted-foreground">
          Not available on this server — it has no push keys configured.
        </p>
      </Card>
    );
  }

  if (state === "unsupported") {
    return (
      <Card className="space-y-2 p-6">
        <h2 className="text-xl">Reminders</h2>
        <p className="text-sm text-muted-foreground">
          This browser can't receive notifications. On an iPhone, add the app to
          your home screen first and open it from there.
        </p>
      </Card>
    );
  }

  const toggleDay = (day: number) =>
    setDays(current =>
      current.includes(day)
        ? current.filter(value => value !== day)
        : [...current, day].sort()
    );

  const save = () =>
    update.mutate({
      frequency,
      time,
      days,
      // Sent every save so a reminder follows someone who moves country.
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-xl">Reminders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A nudge, on your schedule, in your timezone. No email — these arrive
          as a notification, and you can turn them off here or in your browser
          at any time.
        </p>
      </div>

      {/* Step one: the browser's permission. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          {state === "on" ? (
            <BellRing className="size-5 text-primary" aria-hidden />
          ) : (
            <BellOff className="size-5 text-muted-foreground" aria-hidden />
          )}
          <div>
            <p className="font-semibold">
              {state === "on"
                ? "This browser will receive them"
                : "This browser isn't listening yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {state === "denied"
                ? "Notifications are blocked. Allow them in your browser's site settings first."
                : settings?.devices
                  ? `${settings.devices} browser${settings.devices === 1 ? "" : "s"} subscribed.`
                  : "Each browser or device needs allowing separately."}
            </p>
          </div>
        </div>

        {state === "on" ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              Send a test
            </Button>
            <Button variant="outline" size="sm" onClick={() => void disable()}>
              Turn off here
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            disabled={state === "denied" || state === "working"}
            onClick={() => void enable()}
          >
            {state === "working" && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Allow notifications
          </Button>
        )}
      </div>

      {/* Step two: the schedule. */}
      <div className="space-y-3">
        <Label>How often</Label>
        <div className="flex flex-wrap gap-2">
          {REMINDER_FREQUENCIES.map(option => (
            <Button
              key={option}
              size="sm"
              variant={frequency === option ? "default" : "outline"}
              onClick={() => setFrequency(option)}
            >
              {REMINDER_LABELS[option]}
            </Button>
          ))}
        </div>
      </div>

      {frequency !== "off" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="reminder-time">At what time</Label>
            <Input
              id="reminder-time"
              type="time"
              className="w-40"
              value={time}
              onChange={event => setTime(event.target.value)}
            />
          </div>

          {(frequency === "weekly" || frequency === "custom") && (
            <div className="space-y-2">
              <Label>
                {frequency === "weekly" ? "Which day" : "Which days"}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      frequency === "weekly" ? setDays([day]) : toggleDay(day)
                    }
                    aria-pressed={days.includes(day)}
                    className={cn(
                      "typewriter plate border px-2.5 py-1.5 transition-colors",
                      days.includes(day)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-line bg-muted text-muted-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequency === "monthly" && (
            <div className="space-y-2">
              <Label htmlFor="reminder-dom">Day of the month</Label>
              <Input
                id="reminder-dom"
                inputMode="numeric"
                className="w-24"
                value={days[0] ?? 1}
                onChange={event => {
                  const day = Number(event.target.value.replace(/[^0-9]/g, ""));
                  setDays([Math.min(28, Math.max(1, day || 1))]);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Capped at 28 so it lands every month, February included.
              </p>
            </div>
          )}
        </>
      )}

      <Button onClick={save} disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save schedule"}
      </Button>

      {frequency !== "off" && state !== "on" && (
        <p className="text-sm text-coral">
          Saved schedules do nothing until you allow notifications above.
        </p>
      )}
    </Card>
  );
}
