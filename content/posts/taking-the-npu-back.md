---
title: "Taking the NPU back: a tinygrad backend for the Zhouyi X2"
date: 2026-09-22T11:08:18+02:00
draft: true
summary: "The vendor toolchain wanted an x86 machine and quantised my model according to choices I could not see. So I wrote a tinygrad backend that drives the convolution engine directly, from the board, with no vendor runtime in the loop."
---

The CIX P1 (CD8180 / CD8160) has a "Zhouyi" (周易) X2 NPU on it, and the first thing that
frustrated me was that I needed an x86 machine to compile for it. The vendor's toolchain compiles a
model into a `.cix` file on an x86_64 Linux host, and the board only ever sees that file.
Then came the second frustration: everything in that compile happens in a very opaque way,
and by the time I understood it I realised I had been relinquishing a lot of control over
what was being done to my model — it was quantising it according to choices I could not see,
let alone override.

So my solution was to bypass most of it. I started adding a new backend to tinygrad, and so
far I've got a float path running on the vector cores, the fixed-function convolution engine
driven from Python with no vendor runtime in the loop, and an int8 ResNet-50 going through it
end to end, matching my own integer arithmetic bit for bit. This post is about what that
took, and what it bought me.

## The workflow I was supposed to follow

Here's the pipeline the vendor expects. The whole left half runs on an x86_64 Linux machine
with the vendor's Compass MiniPkg toolchain installed; the board only gets the artefact at
the end, where a user-mode runtime (NOE) hands it to the kernel driver.

```pikchr {alt="The vendor pipeline: trained model, parser, optimizer, GBuilder and .cix on an x86_64 host, handed to the NOE runtime, kernel driver and Zhouyi X2 on the board" caption="The vendor flow. Every interesting decision happens on the host, inside the Optimizer and GBuilder."}
scale = 0.9
boxwid = 2.3
boxht = 0.62
vs = 1.05

M: box "Trained model" "ONNX / TF / PyTorch"
P: box "Parser"                             at M - (0,vs)
O: box "Optimizer" "quantise + calibrate"   at P - (0,vs)
G: box "GBuilder" "tile, schedule, codegen" at O - (0,vs)
C: box ".cix" bold                          at G - (0,vs)

arrow from M.s to P.n
arrow from P.s to O.n
arrow from O.s to G.n
arrow from G.s to C.n

R: box "NOE runtime (UMD)" "noe_job_infer_sync" at O + (3.7,0)
K: box "kernel driver (KMD)"                    at R - (0,vs)
N: box "Zhouyi X2" bold                         at K - (0,vs)

arrow from R.s to K.n
arrow from K.s to N.n

arrow from C.e right 0.72 then up 2.1 then to R.w

HB: box width boxwid+0.55 height 4*vs+boxht+0.5 at (M.x, (M.y+C.y)/2) dashed color gray
BB: box width boxwid+0.55 height 2*vs+boxht+0.5 at (R.x, (R.y+N.y)/2) dashed color gray
text "x86_64 Linux host" "Compass MiniPkg" with .s at HB.n + (0,0.1) color gray
text "aarch64 board" "CIX P1"              with .s at BB.n + (0,0.1) color gray
```

Every interesting decision lives inside the Optimizer and GBuilder. The Optimizer decides how your
model is quantised — which calibration method, what granularity, what it does to layers it
doesn't like. GBuilder decides how each layer is tiled across the engine and scheduled. The
config file for the vendor model zoo's ResNet-50 says things like `tiling = fps` and "adaround global
calibration", and that's about all you get to know. The output is a `.cix` and a latency
number. If the accuracy dropped, you can turn knobs in a config and rebuild; you cannot see
what the compiler actually emitted, and you cannot make it emit something else.

The part that finally tipped me over was discovering that the board itself ships the vendor's
aarch64 toolchain as a library (`libaiputoolchain.so`, sitting in an onnxruntime directory)
that the official flow never uses. The compiler was on the board all along. The x86
requirement was a packaging decision, not a hardware one.

## The setup

Worth being concrete about the machine, because two things about it shaped everything that
follows.

The board is a CIX P1 based SBC — eight Cortex-A720 cores and the Zhouyi NPU: three cores of
four TECs each, plus the AIFF convolution engine. It runs Ubuntu 26.04 on the `linux-cix`
7.0.0-41 kernel.

The first thing: **there is no vendor kernel driver on that kernel.** CIX deleted the in-tree
`armchina-npu` driver in 7.0.0-41 — no module in the kernel package, no `CONFIG_ARMCHINA_*` in
its config, no replacement anywhere in the PPA. So the driver is ours too, packaged as DKMS. An
unnoticed kernel bump on this board doesn't degrade the NPU, it removes it, which is why the
kernel is pinned twice over — an `apt-mark hold` and an apt preference stanza, with independent
storage, so unholding one cannot silently erase the policy.

The second: **everything runs on the board.** The fork is cloned onto it, into a venv, against
a world-accessible `/dev/aipu`. There is no cross-compilation step and no x86 host anywhere in
the loop — which was the whole point.

The tinygrad side is a fork pinned at upstream `902edc378`, and the diff against that pin may
touch exactly four paths: the tinygrad-facing seam, the standalone support package, the tests,
and a `core-patches/` directory that records every deviation from the other three as a patch
file. A test enforces that, untracked files included. Keeping the delta small enough to read in
one sitting is what makes re-pinning affordable, because there is no hardware-free codegen
test — every rebase onto a newer upstream is verified on the board or not at all.

The one vendor component left in the loop is clang, and only as codegen: never runtime, never
in a submit path. Even that is loaded by absolute path with `RTLD_LOCAL`, because putting the
vendor library directory on the process-wide search path shadows the system libraries and
breaks tinygrad's own CPU backend — which is the oracle that every correctness claim here is
checked against.

## What I built instead

tinygrad is a small ML framework whose backends are thin: a renderer that turns a kernel's op
graph into source, a compiler that turns source into a binary, and a runtime that launches it.
Adding a device means writing those three things. I wrote them for the X2 — but the shape of
the work turned out to be less about tinygrad and more about the two very different halves of
this chip.

**The vector cores (TPC).** Each of the X2's three cores has four "TECs", small vector
processors with their own scratchpad. For these, the backend is a fairly conventional tinygrad
renderer emitting C, compiled by that on-board vendor toolchain loaded in-process, with the ELF
lifted into an image the runtime can launch. This half runs any float model tinygrad can
express. It also refuses, loudly, any data type the hardware can't do natively and runs that
kernel on the CPU instead, marked, inside the same computation — I'd rather have a correct
answer and a note than a silently narrowed one.

**The fixed-function engine (AIFF).** This is where the NPU's throughput actually lives: a
convolution engine you program by writing a chain of descriptors — register images, linked
into what the hardware calls a TCB chain — and pointing the core at them. There is no compiler for it that you're allowed to see; the vendor's
GBuilder emits those descriptors from the `.cix` flow and never shows them to you. So I wrote a
descriptor generator from the register-level documentation and then spent weeks finding out
which parts of the documentation were true.

That second half is the real story, and it needed a rule I now consider the most important
thing in the repo: **the device-facing code never imports tinygrad.** The driver interface, the
descriptor generator, the packer, the quantiser — all of it runs from a bare Python interpreter
on the board, so I could characterise the engine with small probes and a byte-exact reference
*before* a single tinygrad op existed. tinygrad only sees the result, through one custom op.

## Learning an engine by running it

You don't get an engine like this from a datasheet (also because there isn't one). Some of what
it took:

- **Register fields named by running them.** The kernel-size field is literal (a 3×3 writes 3);
  the "weight size" field is the tap count; the step fields count *input* rows, not output rows;
  a single-step kernel's step must span the whole input height or the job faults at stride 2 on
  even planes. Each of those I learned the same way: a probe that set the field the obvious
  way, and a job that faulted.
- **A tiling law that wasn't what it looked like.** Over-sized tiles don't fault — they return
  DONE with a quarter of the output wrong, which the network's top-1 happily tolerates. I first
  modelled the limit as an accumulator byte budget that "shrinks with input channels because
  weights share the buffer." That story was wrong: sweeping it properly showed the limit is an
  *output-area* cap per kernel size and input width, independent of how many output channels a
  unit produces. A byte budget only looked right because it happened to land on the same tile
  size for the shapes I'd tried.
- **A real engine bug and the rewrite around it.** Stride-2 convolutions at wide input widths
  are miscomputed natively. A 1×1 stride-2 has no spatial extent, so you subsample the *input*
  and run stride 1 — byte-identical, cheaper, and it never touches the bug. A 3×3 stride-2 has
  to run at stride 1 and subsample the output, paying 4× the arithmetic. Both are now rules the
  backend applies automatically.
- **Chaining, and where it breaks.** Submitting a convolution's row-bands as one job instead of
  one job per tile removed most of the per-job overhead — and was byte-exact at stride 1 at
  every band count, while stride-2 chaining was wrong at every band size. The first time I
  measured it I thought it was a different bug entirely; I had mis-decoded a tensor size. The
  byte-exact check caught it, not me.

- **The one convolution that gets neither optimisation.** The 7×7 stride-2 stem runs
  natively, because its input is only 32 channels wide and that is the one place the stride-2
  bug doesn't bite. But chaining is out — stride-2 chained bands are wrong at every band size,
  and one band size hung the device outright — so it takes the square-tile path. The 7×7
  accumulator ceiling at 32 input channels allows a tile of 18, the budget picks 16, and a
  112×112 output becomes 7×7 = 49 tiles: **49 jobs for one convolution**, roughly half the
  network's AIFF jobs. Each of those tiles also copies its input window to a contiguous buffer,
  because a width-window of a surface isn't contiguous and the descriptor generator has no
  input row-stride field yet. It is a good measure of what an un-optimised corner costs.

Every one of these ended as a number in a manifest with its provenance — measured, derived,
inferred, or assumed — and a test that fails if code and manifest disagree. The engine's
behaviour is data now, not folklore.

## Where it stands

The reference points, all on the same board and driver. My numbers come from a run with
`DEBUG=2`, which synchronises every launch — so they are device **plus dispatch** time, not
pure hardware occupancy.

| ResNet-50 int8, one warm image | launches | time |
|---|---:|---:|
| vendor `.cix` via the vendor runtime, three cores | | 1.7 ms |
| vendor `.cix`, pinned to one core | | 2.4 ms |
| mine — TPC elementwise: residual rescale/add, pooling | 40 | 82.6 ms |
| mine — AIFF convolution op | 53 | 31.6 ms |
| mine — copy / reduce | 4 | 0.5 ms |
| **mine — total device + dispatch** | **97** | **114.7 ms** |
| mine — wall clock through tinygrad, warm | | 1.70 s |

Four honest things fall out of that table.

I am on one core, so **2.4 ms is the number to beat**, not 1.7.

The convolution op's 31.6 ms is not engine time. The engine's own submit-and-wait inside it is
about 12 ms; the rest is the runner rebuilding and packing descriptors on every single call,
roughly 0.4 ms × 53.

It is the *elementwise* kernels, not the convolutions, that dominate — 82.6 ms across 40
launches, the worst of them 9.5 ms each on the layer-1 and layer-2 planes. I had assumed the
convolutions were the thing to optimise. They aren't, and I only know that because I measured
per-launch instead of trusting the shape of the problem.

And ~115 ms of device time against a 1.70 s wall means roughly **93% of that wall is host-side
tinygrad scheduling**, not the NPU at all. The JIT graph that would fix it exists for the vector
path and isn't wired to the engine op yet.

What I got in exchange is the thing I set out for. The quantisation is mine: BN folding,
per-unit weight scales, an int32 bias in the accumulator's domain, and an integer reference
model that every layer on the device is compared against — 83 per-layer comparisons per image,
byte-exact, with top-1 matching the fp32 model on all six of my test images except one that is
a coin-flip in fp32 too. I should be plain about what that does *not* establish: I never
measured the vendor path's accuracy, only its latency, so I am not claiming to beat it. What I
am claiming is that when my accuracy moves I can see exactly which layer and which arithmetic
moved it, because I wrote both. Nothing between the model and the hardware is a black box
anymore, and none of it needs an x86 machine.

```pikchr {alt="The replacement path: tinygrad model and scheduler splitting into a float kernel path through the on-board vendor toolchain and a quantised convolution path through a descriptor generator, both converging on a TCB chain, the kernel driver and the Zhouyi X2" caption="What replaced it. Everything above the driver runs on the board."}
scale = 0.9
boxwid = 2.5
boxht = 0.62

T: box "tinygrad model"
S: box "scheduler" at T - (0,1.0)

X: box "float kernels" "TPC renderer → C"         at S + (-1.45,-1.1)
Q: box "quantised conv op" "descriptor generator" at S + (1.45,-1.1)

TC: box "vendor toolchain" "in-process, on the board" at X - (0,1.05)

L: box "TCB chain" "dispatch"                     at S - (0,3.25)
K: box "kernel driver"                            at L - (0,1.0)
N: box "Zhouyi X2" bold "TPC cores · AIFF engine"  at K - (0,1.0)

arrow from T.s to S.n
arrow from S.s down 0.3 then left  1.45 then to X.n
arrow from S.s down 0.3 then right 1.45 then to Q.n
arrow from X.s to TC.n
arrow from TC.s to L.nw
arrow from Q.s  to L.ne
arrow from L.s to K.n
arrow from K.s to N.n

text "everything above the driver runs on the board — no vendor runtime" \
  with .n at N.s + (0,-0.3) color gray
```

## What's next

The list is short and each item now has a measurement behind it: the elementwise kernels on
the vector cores, which cost 2.6× what the convolutions do and are the largest single target;
wiring the engine op into the JIT graph so that 93% host-side wall stops being Python; hoisting
the descriptor rebuild out of the per-call path; and a completion barrier for a driver-level
race where a job reports done while its output is still landing (today I re-read until two
reads agree, which is a workaround, not a fix). Then the second and third cores.

I don't expect to beat the vendor's number. I do expect to understand every millisecond of mine.
