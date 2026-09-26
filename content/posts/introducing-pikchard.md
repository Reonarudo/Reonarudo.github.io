---
title: "Make it so: introducing Pikchard"
date: 2026-09-26T02:07:10+02:00
summary: "Pikchard is a live editor for Pikchr diagrams, for the web and the desktop, inspired by MermaLaid. Version 0.1.0 is out. Here's what it does, what it borrowed, and what it deliberately doesn't do."
---

I started using PlantUML about ten years ago, and it's still how I document and plan most
engineering work. More recently I've been using Mermaid, although I still fall back to
PlantUML. Lately I've been trying [D2](https://d2lang.com) and [Pikchr](https://pikchr.org),
and I have to say Pikchr is growing on me.

The first thing that caught my eye was the railroad diagrams. SQLite's syntax diagrams are
drawn in Pikchr, and it's very good at them. Here is a simplified Pikchr statement, drawn in
Pikchr:

```pikchr {alt="A railroad diagram: an optional LABEL and colon, then an object class, then zero or more attributes" caption="A Pikchr statement, simplified: an optional label, an object class, then any number of attributes."}
linerad = 8px
S: circle rad 0.05 fill black at (0,0)
line from S.e to (0.3,0)

arrow from (0.3,0) right 0.2 then up 0.45 then right 0.2
L: oval "LABEL" width 0.8 height 0.28 with .w at (0.7,0.45)
arrow from L.e right 0.2
C: oval ":" width 0.3 height 0.28
line from C.e right 0.2 then down 0.45 then right 0.2
arrow from (0.3,0) to (2.5,0)

K: box "object class" width 1.2 height 0.3 with .w at (2.5,0)
E: circle rad 0.05 fill black at (5.5,0)
arrow from K.e to E.w

arrow from (4.9,0) right 0.2 then down 0.45 then left 0.2
A: box "attribute" width 0.9 height 0.3 with .e at (4.9,-0.45)
arrow from A.w left 0.2 then up 0.45 then right 0.2
```

Then, doing some hardware/software architecture and stack analysis (the diagrams in
[my NPU post](/posts/taking-the-npu-back/) came out of that), I needed block diagrams where
I decide where every box goes. The other tools don't give me that much control. At first I
leaned towards D2, which let me build animations out of slides, but it wasn't enough, at
least not yet. Pikchr was. It is a small language, a descendant of PIC, and every box is
exactly where you put it.

By now I'm invested. This blog renders Pikchr fences into SVG when the site is built, and I
published a VS Code extension,
[Pikchr Diagram Preview](https://marketplace.visualstudio.com/items?itemName=ReoX86.pikchr-diagram-preview),
so the Markdown preview shows the same diagrams while I write.

The one thing I didn't have was a good place to *write* it: an editor where the drawing
updates as you type and the errors point at the right place.

So I built one, with a lot of help from AI: mostly Claude Code, with some Codex. **Pikchard**
is a live Pikchr editor that runs in the browser and as a desktop app on macOS, Windows and
Linux. Version 0.1.0 was tagged tonight.

## The name, and the Captain

Pikchard is Pikchr + Picard. When you open a new document you get this:

```text
# Uniform: black shoulders, command red below
box wid 2.6 ht 1.2 rad 0.4 fill black at 0,-0.6
box wid 2.6 ht 0.72 fill 0xB22222 at 0,-0.84
# Neck and collar
box wid 0.42 ht 0.4 fill 0xE8B896 at 0,0.05
ellipse wid 0.7 ht 0.25 fill black at 0,-0.17
# The head, what is left of the hair, and the ears
Head: ellipse wid 1.05 ht 1.35 fill 0xE8B896 at 0,0.82
ellipse wid 0.12 ht 0.4 fill 0xA8A8A8 color 0x808080 at Head.c+(-0.5,0.08)
ellipse wid 0.12 ht 0.4 fill 0xA8A8A8 color 0x808080 at Head.c+(0.5,0.08)
ellipse wid 0.18 ht 0.34 fill 0xE8B896 at Head.c+(-0.55,-0.12)
ellipse wid 0.18 ht 0.34 fill 0xE8B896 at Head.c+(0.55,-0.12)
# The face, placed on the head
line from Head.c+(-0.33,0.14) to Head.c+(-0.12,0.1) thickness 0.045
line from Head.c+(0.33,0.14) to Head.c+(0.12,0.1) thickness 0.045
ellipse wid 0.14 ht 0.08 fill white at Head.c+(-0.22,0.02)
ellipse wid 0.14 ht 0.08 fill white at Head.c+(0.22,0.02)
circle rad 0.03 fill black at Head.c+(-0.22,0.02)
circle rad 0.03 fill black at Head.c+(0.22,0.02)
line from Head.c+(-0.02,0.04) to Head.c+(-0.07,-0.2) to Head.c+(0.05,-0.22)
line from Head.c+(-0.15,-0.4) to Head.c+(0,-0.38) to Head.c+(0.15,-0.4)
# Combadge, and a captain's four pips
ellipse wid 0.3 ht 0.2 fill 0xD4AF37 at 0.6,-0.3
line from 0.6,-0.17 to 0.69,-0.4 to 0.6,-0.34 to 0.51,-0.4 close fill 0xC0C0C0
circle rad 0.035 fill 0xD4AF37 at -0.45,-0.1
circle rad 0.035 fill 0xD4AF37 at -0.55,-0.1
circle rad 0.035 fill 0xD4AF37 at -0.65,-0.1
circle rad 0.035 fill 0xD4AF37 at -0.75,-0.1
text "Make it so." italic at 0,-1.45
```

which draws this:

```pikchr {alt="A Pikchr drawing of Captain Picard: bald head with a grey fringe, stern eyebrows, black-and-red uniform with a gold combadge and four pips, captioned 'Make it so.'" caption="The seed document every new Pikchard file opens with."}
# Uniform: black shoulders, command red below
box wid 2.6 ht 1.2 rad 0.4 fill black at 0,-0.6
box wid 2.6 ht 0.72 fill 0xB22222 at 0,-0.84
# Neck and collar
box wid 0.42 ht 0.4 fill 0xE8B896 at 0,0.05
ellipse wid 0.7 ht 0.25 fill black at 0,-0.17
# The head, what is left of the hair, and the ears
Head: ellipse wid 1.05 ht 1.35 fill 0xE8B896 at 0,0.82
ellipse wid 0.12 ht 0.4 fill 0xA8A8A8 color 0x808080 at Head.c+(-0.5,0.08)
ellipse wid 0.12 ht 0.4 fill 0xA8A8A8 color 0x808080 at Head.c+(0.5,0.08)
ellipse wid 0.18 ht 0.34 fill 0xE8B896 at Head.c+(-0.55,-0.12)
ellipse wid 0.18 ht 0.34 fill 0xE8B896 at Head.c+(0.55,-0.12)
# The face, placed on the head
line from Head.c+(-0.33,0.14) to Head.c+(-0.12,0.1) thickness 0.045
line from Head.c+(0.33,0.14) to Head.c+(0.12,0.1) thickness 0.045
ellipse wid 0.14 ht 0.08 fill white at Head.c+(-0.22,0.02)
ellipse wid 0.14 ht 0.08 fill white at Head.c+(0.22,0.02)
circle rad 0.03 fill black at Head.c+(-0.22,0.02)
circle rad 0.03 fill black at Head.c+(0.22,0.02)
line from Head.c+(-0.02,0.04) to Head.c+(-0.07,-0.2) to Head.c+(0.05,-0.22)
line from Head.c+(-0.15,-0.4) to Head.c+(0,-0.38) to Head.c+(0.15,-0.4)
# Combadge, and a captain's four pips
ellipse wid 0.3 ht 0.2 fill 0xD4AF37 at 0.6,-0.3
line from 0.6,-0.17 to 0.69,-0.4 to 0.6,-0.34 to 0.51,-0.4 close fill 0xC0C0C0
circle rad 0.035 fill 0xD4AF37 at -0.45,-0.1
circle rad 0.035 fill 0xD4AF37 at -0.55,-0.1
circle rad 0.035 fill 0xD4AF37 at -0.65,-0.1
circle rad 0.035 fill 0xD4AF37 at -0.75,-0.1
text "Make it so." italic at 0,-1.45
```

Instead of the usual hello-world example, `box "Hello"` → `box "Pikchr"`, which is fine but
boring, we spiced it up. The Captain has a second job, though. Pikchard has no onboarding
screen, and that's on purpose: the note that closed the ticket says *"the seed is the
onboarding"*. You get thirty lines of script next to the picture they make, and nothing to
dismiss. The face is placed relative to a `Head` label, so while you're finding the eyebrows
you're also learning labels and positions. All of it is there to invite you to play.

## Inspired by MermaLaid, not copied from it

[MermaLaid](https://github.com/highvoltag3/mermalaid) ([mermalaid.com](https://mermalaid.com))
by highvoltag3 is a free Mermaid editor: *"lightweight native macOS & Windows apps for
creating, editing, and exporting Mermaid diagrams."* It has live preview, a drag-and-drop
flowchart editor, SVG/PNG/ASCII export, encrypted share URLs, themes, autosave and AI syntax
fixing. It was the model for Pikchard from day one, and if you write Mermaid you should look
at it.

MermaLaid is licensed CC BY-NC-SA 4.0, which is source-available and non-commercial. I wanted
Pikchard to be MIT, so I wrote it from scratch. The first decision record says it plainly:
*mermalaid is the guide for features and shape only.* Every other place where the two differ
is also written down in a decision record:

| | MermaLaid | Pikchard |
|---|---|---|
| Code | CC BY-NC-SA 4.0 | Written from scratch, MIT |
| Shape | Web app + Tauri desktop app | The same: web and desktop are equal targets from one codebase |
| Editor | Monaco, loaded from a CDN at runtime, even on desktop | CodeMirror 6 with a hand-written Lezer grammar: about 10× smaller and fully offline |
| Server | Serverless functions for share previews, OG images and Slack | None, ever. Static files, no accounts, no analytics |
| Layout | One app | A monorepo, because no CodeMirror grammar for Pikchr existed and it's useful on its own |

The same rule applies to documentation. Pikchr itself is 0BSD, but its documentation prose
has no license, so when Pikchard gets hover docs they'll be written in its own words.

## Under the hood

**It runs a patched Pikchr.** Pikchard builds its own WebAssembly from a pinned upstream
check-in (`a7f1c35b`, Pikchr 1.0, 3 April 2026) plus one 182-line patch. The patch tags every
shape in the SVG with `data-pik="<offset>"`, which points at the statement that drew it. That's
how a picture gets linked back to its script. The `.wasm` is about 127 KB.

**Proof that the patch only annotates.** Every upstream test and example is rendered with the
patched build, the annotations are stripped, and the result has to match unpatched Pikchr
byte for byte. The reference files come from an unpatched *WASM* build, not a native one,
because arm64 and wasm32 settle some floating-point layout comparisons
differently, so a native reference fails for reasons that have nothing to do with the patch.

**Two grammars, one winner.** I built two prototype Lezer grammars and measured them. The
flat one was half the size and twice as fast, and it also accepted `circle wid wid wid at at`
without complaint. The faithful port of `pikchr.y` won. It parses all 261 upstream scripts
cleanly, except `divzero`, which is supposed to fail. (It's 261 and not 270 because nine
scripts in the user manual appear twice.)

**A multi-byte bug.** Pikchr measures an unrecognised token as one byte. When that token is an
emoji, the error underline shrank to nothing. Pikchard now rounds the end up to the whole
character.

**Errors are shown word for word.** You see `3:5  syntax error`, exactly as Pikchr says it.
Rewording it would put *"our words between the user and the language they are actually
learning."*

## How it was built

Work started on 11 September, and `v0.1.0` was tagged on 26 September at 01:17. In those
fifteen days it grew to about 21k lines of TypeScript, Rust, CSS, grammar and scripts, and 82
test files. The end-to-end tests run on Chromium, Firefox and
WebKit.

All of it was developed with the assistance of AI, mostly Claude Code and some Codex. Most
of it was designed before it was written: 11 decision records, a glossary, design
interviews that ran past thirty questions, and research and prototype branches that never
merged. The tracker is a self-hosted Redmine, and a Claude Code agent created every Epic,
Story and Task in it. I wrote about [how I work with AI](/posts/this-post-was-written-with-ai/)
a week ago. This project is that post in practice.

The first release had a scare. The first real tag built only on macOS, because
`RunEvent::Opened` exists only there and Windows and Linux didn't compile. It was fixed at
00:42. macOS signing and notarisation landed 35 minutes before the tag.

## What you can install

- **Web:** on GitHub Pages. It works offline after one visit.
- **macOS:** a signed and notarised universal `.dmg`.
- **Linux:** an `.AppImage` or a `.deb`. Only the `.deb` registers file associations.
- **Windows:** an unsigned `.exe`. CI builds it, but I haven't tested it by hand. If it breaks,
  please tell me.

## Not in 0.1.0

These are planned for 1.1 or later: autocomplete, hover docs, lints, clicking a shape to jump
to its code, drag-to-edit, reloading when the file changes on disk, share links, and a mobile
layout.

## Try it

Open [reonarudo.github.io/pikchard](https://reonarudo.github.io/pikchard/), delete the
Captain, and draw something. Or keep him and give him a fifth pip.
