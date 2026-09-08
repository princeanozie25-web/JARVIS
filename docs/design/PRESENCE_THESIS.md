# JARVIS · Presence — the design thesis

Written 2026-09-07 after the UI reset (E-056); revised 2026-09-08 (E-059) after Prince's brief:
"Think if Apple and Grok made a personal intelligence system. The simplest of Apple, the layout of
Grok Bot, and OpenBot." This replaces every earlier UI document. It is the only design reference
besides the VibeCurb skills in `.claude/skills/`.

## 1. What went wrong before

The old interface was a cockpit. It showed the machinery: Human Gate, governed pipeline, mandate,
approval cards, consent manifests, review queues, keeper panels, telemetry cockpits. Fourteen thousand
lines of panels. That is the interface of a security product for a fleet of operators. JARVIS is one
person's intelligence. The governance still exists and still runs. It is not the product. It was never
supposed to be on the screen.

The first cut of the presence (E-057) over-corrected into an editorial object: a serif voice on a
warm black ground with a brass accent. Handsome, but it was a poster, not something you use two
hundred times a day. It also did not look like the products Prince pointed at.

Two failure modes remain off the table: the chatbot window (avatars on every line, "typing…", a
provider menu) and the sci-fi toy (glowing rings, reactors, cyan on black). Both read as cartoons next
to a real instrument.

## 2. What the references actually look like

- **Grok Bot** (x.ai, "Designing Grok Bot", plus the app itself, frame by frame from the official
  getting-started video and the product page). The interface is deliberately iMessage-shaped: a
  sidebar of Bots you can pin and group, threads on messages, the same conversation continuing across
  desktop and phone. The transcript is heterogeneous: prose when prose fits the information,
  structured UI when it does not (grey bubbles from the Bot, black from you, inline cards for a
  running build or a computer step with one button, file cards, centred one-line system events like
  "Created routine · Daily blog review"). The Bot's computer sits in a pinned right panel with three
  tiers of visibility because prominence "encouraged users to supervise it". **There is no rest
  splash**: the app rests on the sidebar's last-message previews ("booked the venue and sent the…",
  "inbox at zero, 5 drafts parked", "Done.") and on the thread, which the Bot keeps posting into. A
  brand-new Bot's thread is plain white. Window chrome and metadata were removed: "Did this help
  someone delegate, or did it give them one more thing to manage?"
- **Apple's Siri app** (June 2026). Rests on a grid of your past conversations as cards with a time
  and a title, plus search and compose. No orb, no greeting, no hero object.
- **OpenClaw community dashboards** (the "control point" builds on YouTube). Rest on a morning brief:
  today, alerts, agent status, schedule. The content is right; the cockpit form is the trap.
- **Apple.** System font, a small type scale (11 / 13 / 15 / 17 / 22), an 8pt grid, hairline
  separators, semantic colours used as small lights, translucent bars floating over content, light and
  dark following the system. Clarity, deference, depth: the content is the interface.
- **OpenBot.** A workbench that shows the thought/response timeline and live file activity beside the
  conversation, never in place of it.
- **OpenClaw.** No interface and 215k stars: the loved part is the relationship and the proactivity.
- **VibeCurb.** Monochrome first, one accent with meaning, spring motion with a personality lock, and a
  frequency gate: what you touch a hundred times a day never animates.

## 3. What a personal intelligence system is

It is two things and only two things.

**A presence.** Something you can talk to at any moment, that is visibly _there_ when it listens and
speaks, and otherwise stays out of the way. Voice first (Lewis), text always available.

**A desk.** The place where the work it does for you appears: threads, each with a live account of
what it is doing, the results as things you can open, and the single interruption ("needs you") as a
plain question with two answers, inline in the thread.

Everything else, memory included, is reached from those two: "what do you know about me" and "what
are you" are questions you ask the presence, answered from the Self Model, not panels you monitor.

## 4. The direction, committed

| Decision   | Choice                                                                                                                                                                         | Why                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Shape      | iMessage-shaped, three columns: **sidebar** (JARVIS as the one roster entry, then the threads) · **thread** · **activity** (pinned, closable)                                  | Grok Bot's layout, verbatim. A person has one relationship with it, kept in threads                     |
| Mode       | System light and dark (`color-scheme: light dark`). Ground `#F2F2F4` / `#161618`, surface white / `#1E1E20`, ink `#1D1D1F` / `#F5F5F7`                                         | Apple's neutrals; it belongs on the Mac that runs it                                                    |
| Colour     | Monochrome. You speak in ink-on-ground inverted (black bubble on light, white on dark). Three small lights only: working (green), listening (red), needs you (orange)          | Grok Bot's black-and-white, Apple's semantic colours as dots, never as surfaces                         |
| Type       | The system font (SF Pro on macOS; Geist as the fallback). Scale 11 / 13 / 15 / 17 / 22. Mono (SF Mono) for times only                                                          | Apple simplicity. No display serif, no brand face                                                       |
| Transcript | Heterogeneous: your turns as bubbles, JARVIS's words as plain prose, what it is doing as a small hairline block of short lines, "needs you" as an inline card with two answers | Prose where prose fits, structured UI where it does not (Grok Bot). No card for every tool              |
| Status     | Three tiers: a dot on the avatar and one line under the name → the activity panel → never a takeover                                                                           | Prominence invites supervision; the point is delegation                                                 |
| Chrome     | One bar (the name, voice, activity) and one composer (a pill with a mic that becomes send), both translucent and floating over the thread. Hairlines everywhere else           | Liquid-glass restraint: the content is the interface                                                    |
| Motion     | **Physical** personality (spring snappy / spring smooth / ease-snap), three curves total. Panels slide, cards arrive, the transcript and lists never animate                   | Objects with weight, no bounce toys. Reduced-motion → opacity only                                      |
| Rest       | No mascot, no splash, no greeting box. A fresh thread opens on the **standing brief**: a time line, then what JARVIS has to tell you now, in sentences built from real state   | Grok Bot rests on what the teammates last did; Siri's app rests on your history. Nobody rests on an orb |
| Voice      | Hold the mic (or ⌥ anywhere) to talk; replies are spoken; starting to talk cuts JARVIS off; a speaker toggle in the bar                                                        | Voice first, never voice only                                                                           |
| Language   | "Needs you", "working", "went ahead", "left it alone". Never gate, pipeline, mandate, approval, execution, tier, mutation                                                      | The vocabulary of a colleague, not of an audit                                                          |

## 5. The screens

**Sidebar.** "Threads" and a `+`. Then JARVIS: a status light, the name, and one line beneath it
("Nothing needs you", "Working", the current step in plain words, "Needs you"). Then "Recent": threads
with title, one-line status and time. Selecting one continues that conversation.

**Rest.** A fresh thread is not empty and not a splash. JARVIS has already spoken: a small time line
("Today 6:41 AM"), then the standing brief in its own words, built from real state by
`/api/presence/brief`: a greeting for the hour, whether anything needs you, what it finished today
(title and outcome), what is still waiting on it, and whether its brain, voice or memory are down
("My brain is offline, so I can't think until Ollama is back."). The needs-you card, if any, sits
right under it. Nothing else. This is what Grok Bot's sidebar previews and Siri's history grid do:
the rest page is the state of the relationship, not a welcome.

**Thread.** The bar shows only the name, a speaker toggle and the activity toggle. A conversation
anchors at the bottom: your turns as bubbles on the right, JARVIS's prose on the left at 15pt, what it
is doing as a small block of lowercase lines (the live one has a green dot), "needs you" as a card
that arrives with a spring.

**Composer.** A pill: the field, and a round button that is a mic when the field is empty and an
arrow when it is not. Recording turns the ring red and the field says "Listening…".

**Activity.** A 300pt panel on the right, closed by default, remembered. The current status with its
dot, the turn count, then a timeline of this thread: time, and what happened, in words.

**Needs you.** An inline card at the end of the thread: an orange "Needs you" eyebrow, the question
("May I create a file?"), the request it came from, "Yes, go ahead" and "No". The avatar dot turns
orange at the same time. It leaves when answered; the outcome becomes one line in the activity block.

## 6. What is kept from the old build

The backend is untouched: chat streaming with tools, the operator decision path, memory, projects, the
Self Model, the packaged app, the voice engines. The design-token code files stay as plumbing.

## 7. Acceptance, in Prince's terms

- Screenshot next to Messages.app and Grok Bot: same family. Next to a chatbot: not the same.
- Nothing on screen says gate, pipeline, mandate or approval.
- It follows the Mac's light and dark, in the system font, and looks native in the packaged window.
- Talking to it works from the first screen, with Lewis, and you can interrupt.
- A job it does for you shows up as words you would say to a colleague, not as a log.
- It does not look like a cartoon.
