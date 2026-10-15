"use client";

import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { SettingsSection } from "@/components/settings";
import { Toggle } from "@/components/toggle";
import { Button, fieldClass, Notice } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const label = (zone: string) => zone.replaceAll("_", " ");

function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** A time zone list plus an hour list. Every IANA zone the browser knows is offered. */
function ZoneHour({
  zone,
  hour,
  onZone,
  onHour,
  disabled,
  id,
}: {
  zone: string;
  hour: number;
  onZone: (zone: string) => void;
  onHour: (hour: number) => void;
  disabled?: boolean;
  id: string;
}) {
  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf("timeZone");
    return all.includes(zone) ? all : [zone, ...all];
  }, [zone]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={fieldClass}
        value={hour}
        disabled={disabled}
        onChange={(e) => onHour(Number(e.target.value))}
        aria-label="Posting hour"
        id={`${id}-hour`}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}:00
          </option>
        ))}
      </select>
      <select
        className={`${fieldClass} max-w-[260px]`}
        value={zone}
        disabled={disabled}
        onChange={(e) => onZone(e.target.value)}
        aria-label="Time zone"
        id={`${id}-zone`}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {label(z)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PublishingSettings() {
  const { workspace, member } = useWorkspace();
  const update = useMutation(api.workspaces.update);
  const setMine = useMutation(api.members.setMySchedule);
  const owner = member.role === "owner";
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [myZone, setMyZone] = useState(member.timezone ?? workspace.timezone);
  const [myHour, setMyHour] = useState(member.postHour ?? workspace.postHour);
  const myChanged = myZone !== (member.timezone ?? workspace.timezone) || myHour !== (member.postHour ?? workspace.postHour);
  const detected = browserZone();

  const [zone, setZone] = useState(workspace.timezone);
  const [hour, setHour] = useState(workspace.postHour);
  const changed = zone !== workspace.timezone || hour !== workspace.postHour;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: ok });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {message && <Notice tone={message.ok ? "ok" : "error"}>{message.text}</Notice>}
      <SettingsSection
        title="Your posting time"
        description="When you approve a draft without choosing a time, it goes out the next weekday at this hour, in your time zone. Each person sets their own, so a team across countries posts at a good local time."
      >
        <div className="flex flex-col gap-3">
          <ZoneHour id="mine" zone={myZone} hour={myHour} onZone={setMyZone} onHour={setMyHour} />
          <div className="flex flex-wrap items-center gap-2">
            {detected && detected !== myZone && (
              <Button variant="ghost" onClick={() => setMyZone(detected)}>
                Use {label(detected)}
              </Button>
            )}
            {member.timezone && (
              <Button
                variant="ghost"
                onClick={() =>
                  void run(() => setMine({ workspaceId: workspace._id, timezone: null, postHour: null }), "Back to the workspace default.")
                }
              >
                Use the workspace default
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={!myChanged}
              onClick={() =>
                void run(() => setMine({ workspaceId: workspace._id, timezone: myZone, postHour: myHour }), "Your posting time is saved.")
              }
            >
              Save
            </Button>
          </div>
          {!member.timezone && (
            <p className="text-[12px] text-muted">
              You are on the workspace default: {String(workspace.postHour).padStart(2, "0")}:00, {label(workspace.timezone)}.
            </p>
          )}
        </div>
      </SettingsSection>

      {owner && (
        <SettingsSection
          title="Workspace default and company page"
          description="Company-page posts go out at this time. People who have not set their own time also use it."
        >
          <div className="flex flex-col gap-3">
            <ZoneHour id="workspace" zone={zone} hour={hour} onZone={setZone} onHour={setHour} />
            <Button
              variant="secondary"
              className="self-start"
              disabled={!changed}
              onClick={() => void run(() => update({ workspaceId: workspace._id, timezone: zone, postHour: hour }), "Workspace posting time saved.")}
            >
              Save
            </Button>
          </div>
        </SettingsSection>
      )}

      {owner && (
        <SettingsSection
          title="Write drafts for people"
          description="After each scan, opentopost writes each person's best idea as a draft and sends it to them in Slack, so they approve or edit instead of starting from a blank page. It writes at most one draft per person per scan, and nothing is scheduled until a person approves."
        >
          <div className="flex items-center gap-3">
            <Toggle
              checked={workspace.autoDraft}
              onChange={(value) => void run(() => update({ workspaceId: workspace._id, autoDraft: value }), "Saved.")}
              label="Write drafts for people"
            />
            <span className="text-[14px]">{workspace.autoDraft ? "On: drafts are waiting for people each week" : "Off: people claim ideas themselves"}</span>
          </div>
        </SettingsSection>
      )}

      {owner && (
        <SettingsSection
          title="Autopilot"
          description="Finished drafts are scheduled without anyone clicking. Only personal LinkedIn posts where every claim has a source, by people who connected LinkedIn. Company-page posts and posts that need review always wait for a person."
        >
          <div className="flex items-center gap-3">
            <Toggle
              checked={workspace.autopilot}
              onChange={(value) => void run(() => update({ workspaceId: workspace._id, autopilot: value }), "Saved.")}
              label="Autopilot"
            />
            <span className="text-[14px]">
              {workspace.autopilot ? "On: sourced drafts publish at the next slot" : "Off: a person approves every post"}
            </span>
          </div>
          <p className="text-[12px] text-muted">
            Anyone can still edit or cancel a scheduled post from the calendar, Slack, or the API until it goes out.
          </p>
        </SettingsSection>
      )}
    </div>
  );
}
