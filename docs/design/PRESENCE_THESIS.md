# JARVIS · Presence — the design thesis

Written 2026-09-07 after the UI reset (E-056). This replaces every earlier UI document. It is the only
design reference besides the VibeCurb skills in `.claude/skills/`.

## 1. What went wrong before

The old interface was a cockpit. It showed the machinery: Human Gate, governed pipeline, mandate,
approval cards, consent manifests, review queues, keeper panels, telemetry cockpits. Fourteen thousand
lines of panels. That is the interface of a security product for a fleet of operators. JARVIS is one
person's intelligence. The governance still exists and still runs. It is not the product. It was never
supposed to be on the screen.

Two other failure modes were waiting behind it: the chatbot window (bubbles, avatars, "typing…") and
the sci-fi toy (glowing rings, reactors, cyan on black). Both read as cartoons next to a real
instrument. Neither is what a calm, capable presence looks like.

## 2. What the field teaches

- **OpenClaw** has no interface at all and 215k stars. People message it like a coworker inside the
  apps they already use, it remembers them, it checks in on its own. The lesson: the loved part is the
  relationship and the proactivity, not a screen.
- **Grok Bot** gives each job a named teammate with its own computer. Work runs end to end and the
  teammate "only comes back when something needs your approval." The lesson: there is exactly one
  kind of interruption, and it should be a plain question, not a control.
- **OpenBot's workbench** shows a thought/response timeline and live file edits. The lesson: when you
  do show work, show it as a timeline of what is happening right now, in words.
- **The category's complaint**: tools that are "not a personal assistant" all lack persistent identity,
  memory you can see, and proactivity. Those three are the product.
- **Geist / VibeCurb**: monochrome first, one accent with meaning, display typography that behaves like
  architecture, extreme whitespace, spring motion with a personality lock, and a frequency gate: what
  you touch a hundred times a day never animates.

## 3. What a personal intelligence system is

It is two things and only two things.

**A presence.** Something you can talk to at any moment, that is visibly _there_ when it listens and
speaks, and otherwise stays out of the way. Voice first (Lewis), text always available. When idle the
screen is almost empty: the time, one line about what it is holding for you, and the mark.

**A desk.** The place where the work it does for you appears: jobs as threads, each with a live
account of what it is doing, the results as things you can open, and the single interruption
("needs you") as a sheet with a plain question and two answers.

Everything else, memory included, is reached from those two: "what do you know about me" and "what
are you" are questions you ask the presence, answered from the Self Model, not panels you monitor.

## 4. The direction, committed

| Decision       | Choice                                                                                                                                                             | Why                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Mode           | Dark, warm. Ground `#0B0B0A`, surface `#141311`, text `#F2EFE9`, muted `rgba(242,239,233,.55)`                                                                     | Off-black holds atmosphere; warm neutrals feel like a room, not a terminal                         |
| Accent         | One: brass `#C9A46B`, used only for focus, the listening state and "needs you"                                                                                     | A single warm metal reads as an instrument. No cyan, no purple, no neon                            |
| Display type   | **Fraunces** (already in the repo) at 300/400, tight tracking, italic for emphasis                                                                                 | An editorial serif is the opposite of a dashboard and of a chatbot. It reads as a considered voice |
| Body / labels  | Geist Sans; JetBrains Mono for times, ids and paths only                                                                                                           | Geist is quiet; mono marks the mechanical facts                                                    |
| Motion         | **Physical** personality (spring snappy / spring smooth / ease-snap), three curves total                                                                           | Objects with weight, no bounce toys. Reduced-motion → opacity only                                 |
| Frequency gate | The transcript, input and job list never animate beyond 150 ms. Only arrivals (a "needs you" sheet, a finished result) and the presence itself use the full budget | The things used all day must be instant                                                            |
| The mark       | A physical object rendered in Blender (brushed obsidian disc with one seam of light), shown as a real image with light driven by voice state. No CSS glow rings    | CSS cannot fake material; a render can. Restraint keeps it from becoming a toy                     |
| Language       | "Needs you", "did", "working", "done", "asked". Never gate, pipeline, mandate, approval, execution, tier, mutation                                                 | The vocabulary of a colleague, not of an audit                                                     |
| Layout         | One screen, three states (Presence · Conversation · Desk), one responsive layout, the same in the packaged app and the browser                                     | A person has one relationship with it, not five routes                                             |

## 5. The screens

**Presence (idle).** Full-viewport ground. Top-left, small mono: the time and "listening" /
"quiet". Centre-left, the mark at rest. Below it, one Fraunces line at display scale: what it is
holding for you ("Nothing needs you. Two jobs are running.") One input at the bottom, a single line,
no button. Press-and-hold or say the wake phrase to talk.

**Conversation.** The same screen; the transcript rises from the input as typeset paragraphs, not
bubbles. Speaker in small caps mono ("YOU", "JARVIS"). Live voice transcript renders as it is heard.
What JARVIS does mid-turn appears as an italic aside in the muted colour ("read three files in
~/dev/jarvis", "checked the calendar"), never a card. Long results become an artifact link at the end
of the turn.

**Desk.** A list of threads: title, one-line status in plain words, last activity time. Open one: the
live timeline (words, times, artifacts) and the thread's own conversation. "Needs you" items float to
the top and open as a sheet: the question in Fraunces, the context in one sentence, two answers.

**Needs you.** The only interruption. When JARVIS has to ask, the sheet slides up over whatever is
on screen (spring smooth), the brass accent appears for the first time, Lewis says the question if
voice is on. Answer by voice or by touch. It leaves the way it came.

## 6. What is kept from the old build

The backend is untouched: chat streaming with tools, approvals, memory, projects, the Self Model, the
packaged app, the voice engines. The token and design-language code files stay as plumbing until the
new tokens replace them. The old pages, panels, orb, cockpit, showcase and their tests are retired in a
separate commit once the new shell renders, so nothing is ever without a screen.

## 7. Acceptance, in Prince's terms

- It does not look like a cockpit, a chatbot or a cartoon.
- Nothing on screen says gate, pipeline, mandate or approval.
- The idle screen is calm enough to leave open all day.
- Talking to it works from the first screen, with Lewis, and you can interrupt.
- A job it does for you shows up as words you would say to a colleague, not as a log.
- Screenshot next to linear.app and vercel.com: same planet.
