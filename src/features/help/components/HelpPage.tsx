"use client";

import { useState } from "react";

import { copyToClipboard } from "@/shared/lib/clipboard";

import "./help.css";
import {
  Dots,
  Flag,
  FlagLabel,
  HelpCard,
  MiniToast,
  PlayerMarker,
  PlayerName,
  Shot,
  type CompanionDot,
  type HelpTag,
} from "./HelpParts";

import type { ReactNode } from "react";

type Filter = "all" | HelpTag;

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "keys", label: "Keyboard" },
  { id: "setup", label: "Set up" },
];

const INSTALL_COMMAND = "powershell -NoProfile -ExecutionPolicy Bypass -File .\\install.ps1";

const NEW_KEYS: readonly HelpTag[] = ["new", "keys"];
const SETUP: readonly HelpTag[] = ["setup"];

/** A group heading with the "where it lives" line, and an optional extra on the right. */
function GroupHead({
  title,
  where,
  children,
}: {
  title: string;
  where?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grp-head">
      <h2>{title}</h2>
      {where === undefined ? null : <span className="where">{where}</span>}
      {children}
    </div>
  );
}

/** The one-line rule for the orange and green dots. */
function DotLegend() {
  return (
    <div className="legend" aria-label="What the dots mean">
      <span>
        <i className="dot orange" /> Orange: needs the companion running
      </span>
      <span>
        <i className="dot green" /> Green: works without it
      </span>
      <span>
        <i className="dot orange" />
        <i className="dot green" /> Both: has parts of each
      </span>
    </div>
  );
}

/** The install line: the whole box copies it. */
function CommandBox() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={copied ? "cmd done" : "cmd"}
      onClick={() => {
        void copyToClipboard(INSTALL_COMMAND).then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => {
            setCopied(false);
          }, 1600);
        });
      }}
      style={{ margin: 0, textAlign: "left", font: "inherit", color: "inherit" }}
    >
      <code>{INSTALL_COMMAND}</code>
      <span className="hint">{copied ? "Copied" : "Click to copy"}</span>
    </button>
  );
}

/** One arrow-key scenario card (no snip yet, after a snip, not in a raid). */
function Scenario({
  name,
  hidden,
  cycle,
  route,
}: {
  name: string;
  hidden: boolean;
  cycle: string;
  route: string;
}) {
  return (
    <div className={hidden ? "sc hide" : "sc"} data-tags="keys new">
      <Dots kinds={["orange"]} />
      <div className="head">
        <h3>{name}</h3>
      </div>
      <div className="in">
        <div className="ln">
          <kbd>←→</kbd>
          <span>{cycle}</span>
        </div>
        <div className="ln">
          <kbd>←+→</kbd>
          <span>{route}</span>
        </div>
      </div>
    </div>
  );
}

const ORANGE: readonly CompanionDot[] = ["orange"];

/**
 * The help page: every companion and map feature as a short card, grouped by
 * where the feature lives. Each card carries an orange (needs the companion),
 * green (works without it) or both dots.
 */
export function HelpPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [plain, setPlain] = useState(false);

  const shows = (tags: readonly HelpTag[]) => filter === "all" || tags.includes(filter);
  const hides = (tags: readonly HelpTag[]) => !shows(tags);

  return (
    <div className={plain ? "help plain" : "help"}>
      <div className="wrap">
        <header className="top">
          <div>
            <h1>EFT Companion Help</h1>
            <p className="sub">Everything the companion can do. Pictures are redrawn examples.</p>
          </div>
        </header>

        <div className="filters">
          <div className="group">
            <span className="label">Show</span>
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? "pill active" : "pill"}
                aria-pressed={filter === item.id}
                onClick={() => {
                  setFilter(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="group">
            <button
              type="button"
              className="pill"
              aria-pressed={plain}
              onClick={() => {
                setPlain(!plain);
              }}
            >
              {plain ? "Colors: off" : "Colors: on"}
            </button>
          </div>
        </div>

        {/* ===== Companion panel ===== */}
        <section className="grp">
          <GroupHead title="Companion panel" where="the radio button in the site header">
            <DotLegend />
          </GroupHead>
          <div className="grid">
            <HelpCard
              name="Install"
              tags={SETUP}
              dots={["green"]}
              hidden={hides(SETUP)}
              tall
              art={
                <Shot
                  src="/help/install.jpg"
                  alt="The companion panel with download and install steps"
                  width={414}
                  height={288}
                />
              }
              tip="To update, repeat. To remove, run uninstall.ps1."
            >
              <p>
                <span className="a1">Download the zip</span> from the radio button,{" "}
                <span className="a2">
                  extract it, open a terminal in the folder, paste the line.
                </span>
              </p>
              <CommandBox />
              <p>
                <span className="see">Reload the site. The dot turns teal.</span>
              </p>
            </HelpCard>

            <HelpCard
              name="The five switches"
              tags={SETUP}
              dots={ORANGE}
              hidden={hides(SETUP)}
              tall
              art={
                <Shot
                  src="/help/switches.jpg"
                  alt="The five switches in the companion panel"
                  width={414}
                  height={346}
                />
              }
              tip="Profile search and Exit list both use Win+Shift+S. In a raid, the exit list gets the snip first."
            >
              <p>
                <span className="a1">Each switch is on its own.</span> Turn on only what you want.
              </p>
              <p>
                <span className="a2">Exit list from snip</span> also turns on the arrow keys.
              </p>
            </HelpCard>

            <HelpCard
              name="Mirror devices"
              tags={SETUP}
              dots={["orange", "green"]}
              hidden={hides(SETUP)}
              tall
              art={
                <Shot
                  src="/help/sync.jpg"
                  alt="Sync my devices box in the companion panel"
                  width={414}
                  height={140}
                />
              }
              tip="The code is the only key. Don't post it."
            >
              <p>
                <span className="a1">Sync now</span> redoes quests and profile.{" "}
                <span className="a2">Sync my devices:</span> the PC makes a code, your phone enters
                it.
              </p>
            </HelpCard>
          </div>
        </section>

        {/* ===== Exit flow in a raid ===== */}
        <section className="grp">
          <GroupHead
            title="Exit flow in a raid"
            where="snip, pick, go: keys you press in the game"
          />
          <div className="flow">
            <HelpCard
              name="Snip the exit list"
              step={1}
              isNew
              tags={NEW_KEYS}
              dots={ORANGE}
              hidden={hides(NEW_KEYS)}
              art={
                <div className="cap">
                  <Shot src="/help/map-east.jpg" alt="" width={490} height={245} className="bg" />
                  <Flag kind="extract" left="7%" top="8%" />
                  <FlagLabel kind="extract" left="calc(7% + 40px)" top="calc(8% + 9px)">
                    Crossroads
                  </FlagLabel>
                  <Flag kind="extract" left="54%" top="8%" />
                  <FlagLabel kind="extract" left="calc(54% + 40px)" top="calc(8% + 9px)">
                    Ruins
                  </FlagLabel>
                  <Flag kind="unknown" left="7%" top="40%" />
                  <FlagLabel kind="unknown" left="calc(7% + 40px)" top="calc(40% + 9px)">
                    <span className="q">???</span> Old Gate
                  </FlagLabel>
                  <Flag kind="transit" left="54%" top="40%" />
                  <FlagLabel kind="transit" left="calc(54% + 40px)" top="calc(40% + 9px)">
                    To Customs
                  </FlagLabel>
                  <MiniToast
                    message="Exits on the map: 3 extracts (1 unknown), 1 transit."
                    action="UNDO"
                  />
                </div>
              }
              tip={'Tick "Exit list from snip" in the panel first.'}
            >
              <p>
                <span className="a1">
                  In a raid, press <kbd>O</kbd>
                </span>{" "}
                <span className="a2">
                  then <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> around the list.
                </span>
              </p>
              <p>
                <span className="see">This raid&apos;s exits appear as flags.</span>
              </p>
            </HelpCard>

            <HelpCard
              name="Pick an exit"
              step={2}
              isNew
              tags={NEW_KEYS}
              dots={ORANGE}
              hidden={hides(NEW_KEYS)}
              art={
                <div className="keysbig">
                  <div className="row">
                    <div>
                      <kbd>←</kbd>
                      <kbd>→</kbd>
                      <small>extracts</small>
                    </div>
                    <div>
                      <kbd>↑</kbd>
                      <kbd>↓</kbd>
                      <small>transits</small>
                    </div>
                  </div>
                </div>
              }
              tip="Only works while the game is in front."
            >
              <p>
                <span className="a1">
                  <kbd>←</kbd>
                  <kbd>→</kbd> cycle extracts,
                </span>{" "}
                <span className="a2">
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> cycle transits.
                </span>
              </p>
              <p>
                <span className="see">The flag is picked. &quot;Going to: Ruins&quot;.</span>
              </p>
              <p>
                <span className="fix">
                  Until you snip the exit list (<kbd>O</kbd>), <kbd>←</kbd>
                  <kbd>→</kbd> just cycle through all of the map&apos;s exits.
                </span>{" "}
                After the snip, only this raid&apos;s exits.
              </p>
            </HelpCard>

            <HelpCard
              name="Go there"
              step={3}
              isNew
              tags={NEW_KEYS}
              dots={ORANGE}
              hidden={hides(NEW_KEYS)}
              art={
                <Shot
                  src="/help/go-there.jpg"
                  alt="Dashed route from your position to the closest exit"
                  width={800}
                  height={321}
                />
              }
              tip="Needs a position: take a game screenshot."
            >
              <p>
                <span className="a1">
                  Press <kbd>←</kbd> and <kbd>→</kbd> together,
                </span>{" "}
                <span className="a2">or click Go to Exit.</span>
              </p>
              <p>
                <span className="see">
                  A dashed route with distance and time. Closest exit if none picked.
                </span>
              </p>
            </HelpCard>
          </div>

          <div className="sub2">Arrow keys, before and after a snip</div>
          <div className="scen">
            <Scenario
              name="No snip yet"
              hidden={hides(NEW_KEYS)}
              cycle="cycle the map's own exits"
              route={'route to the picked one. Nothing picked: "Snip the exit list first"'}
            />
            <Scenario
              name="After a snip"
              hidden={hides(NEW_KEYS)}
              cycle="cycle only your snipped exits"
              route="route to the picked one, or the closest if none"
            />
            <Scenario
              name="Not in a raid"
              hidden={hides(NEW_KEYS)}
              cycle="cycle the exits of the open map tab"
              route="same, but a route needs a position"
            />
          </div>
        </section>

        {/* ===== Maps page buttons ===== */}
        <section className="grp">
          <GroupHead title="Maps page buttons" where="under and beside the map on the site" />
          <div className="grid">
            <HelpCard
              name="Show all exits"
              isNew
              tags={["new"]}
              dots={["green"]}
              hidden={hides(["new"])}
              art={
                <Shot
                  src="/help/show-all-exits.jpg"
                  alt="Every exit on Reserve shown as a flag"
                  width={800}
                  height={340}
                />
              }
              tip="Not on Terminal or Icebreaker."
            >
              <p>
                <span className="a1">Click Show all exits.</span>
              </p>
              <p>
                <span className="see">Every exit appears, unlisted ones in gray.</span>
              </p>
            </HelpCard>

            <HelpCard
              name="Ruler"
              isNew
              tags={["new"]}
              dots={["green"]}
              hidden={hides(["new"])}
              art={
                <Shot
                  src="/help/ruler.jpg"
                  alt="Ruler route from A to B with distance and walking time"
                  width={800}
                  height={328}
                />
              }
              tip="A third click starts over. Turning it off clears it."
            >
              <p>
                <span className="a1">Click the ruler button, top right.</span>{" "}
                <span className="a2">Click the map for A, then B.</span>
              </p>
              <p>
                <span className="see">Walking distance and time between them.</span>
              </p>
            </HelpCard>
          </div>
        </section>

        {/* ===== Screenshots and snips ===== */}
        <section className="grp">
          <GroupHead title="Screenshots and snips" where="things you capture while playing" />
          <div className="grid">
            <HelpCard
              name="Your position"
              tags={SETUP}
              dots={ORANGE}
              hidden={hides(SETUP)}
              art={
                <div className="cap">
                  <Shot src="/help/map-east.jpg" alt="" width={490} height={245} className="bg" />
                  <PlayerMarker left="calc(50% - 23px)" top="calc(54% - 23px)" degrees={38} />
                  <PlayerName left="calc(50% - 16px)" top="calc(54% - 46px)">
                    You
                  </PlayerName>
                </div>
              }
              tip="Screenshot again to update. Ignored after you die."
            >
              <p>
                <span className="a1">In a raid, take a game screenshot.</span>
              </p>
              <p>
                <span className="see">Your marker appears, facing where you looked.</span>
              </p>
            </HelpCard>

            <HelpCard
              name="Profile search"
              tags={["keys", "setup"]}
              dots={ORANGE}
              hidden={hides(["keys", "setup"])}
              art={
                <div className="keysbig">
                  <div className="row">
                    <div>
                      <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>
                      <small>around a player&apos;s name</small>
                    </div>
                  </div>
                </div>
              }
              tip="Snip the name tightly, nothing else."
            >
              <p>
                <span className="a1">Turn it on in the panel.</span>{" "}
                <span className="a2">On the raid-end screen, snip a player&apos;s name.</span>
              </p>
              <p>
                <span className="see">Their tarkov.dev stats open.</span>
              </p>
            </HelpCard>
          </div>
        </section>

        {/* ===== If something is off ===== */}
        <section className="grp">
          <GroupHead title="If something is off" />
          <div className="fixgrid">
            <div className="fixcard">
              <b>Panel says &quot;Not running&quot;</b>
              Allow &quot;Apps&quot; in the site&apos;s permissions. Try a private window.
            </div>
            <div className="fixcard">
              <b>No flags after a snip</b>
              Read the chip next to the buttons. It says why.
            </div>
            <div className="fixcard">
              <b>Flags, but I see nothing</b>
              Click the bar that offers a map view that can show them.
            </div>
            <div className="fixcard">
              <b>Arrow keys do nothing</b>
              Exit list switch on, companion connected, game in front. Update the companion.
            </div>
            <div className="fixcard">
              <b>Arrows work, no line</b>
              Press Left and Right together, then take a screenshot.
            </div>
            <div className="fixcard">
              <b>Marker stuck</b>
              Take a new screenshot. Screenshots are ignored after you die.
            </div>
          </div>
        </section>

        <footer>
          It reads game logs and screenshot file names only. It never touches the game&apos;s memory
          or files.
        </footer>
      </div>
    </div>
  );
}
