---
title: "This Post Was Written With AI"
date: 2026-09-20T00:40:18+02:00
summary: "A new kind of purity test is forming around creative and technical work. But the presence of a tool tells you surprisingly little about the quality of the result."
---

There is a new kind of purity test forming around creative and technical work.

Someone suspects AI was involved and suddenly the work itself becomes secondary.

*Was this written by AI?*

Sometimes that question is reasonable. There is a lot of low-effort AI-generated material online: unverified code, fabricated claims, empty articles, automated noise.

I don't particularly want more of that internet either.

But something strange happens when the reaction shifts from judging the work to judging the tool.

A paragraph can be clear and useful until someone learns that AI helped write it. Code can work, pass tests, and make sense, yet its provenance suddenly matters more than its behaviour.

The tool contaminates the result retroactively.

That seems difficult to reconcile with how we already build things.

## Tools have always moved effort around

I write software.

I don't translate Swift into machine instructions by hand. A compiler does that. I don't keep every API in my head. I use documentation, autocomplete, search, debuggers, old code, and now language models.

When I work with hardware, I don't consider an oscilloscope dishonest because my eyes cannot resolve a high-frequency signal.

Tools extend what we can do and reduce the effort required to do it.

That does not make every result good. A compiler can compile terrible code. CAD can help design a terrible mechanism. AI can generate terrible software and terrible prose.

The existence of assistance tells you surprisingly little about the quality of the result.

## AI is more interesting to me than code generation

I like using AI throughout the software development lifecycle.

It can help me explore a problem, challenge an architecture, generate a prototype, explain an unfamiliar API, suggest tests, look for failure modes, review code, compare approaches, or turn an investigation into documentation.

I use it less like this:

```text
requirement -> AI -> finished software
```

and more like this:

```pikchr
scale = 0.9

E: box "Explore" width 1.3 height 0.5
D: box "Design"  width 1.3 height 0.5 at E - (0,0.92)
B: box "Build"   width 1.3 height 0.5 at D - (0,0.92)
T: box "Test"    width 1.3 height 0.5 at B - (0,0.92)
R: box "Review"  width 1.3 height 0.5 at T - (0,0.92)

arrow from E.s to D.n
arrow from D.s to B.n
arrow from B.s to T.n
arrow from T.s to R.n

H:  box "Human" bold width 1.3 height 0.5 at E + (0,1.32)
AI: box "AI"         width 1.3 height 0.5 at B + (2.6,0)

arrow from H.s to E.n

arrow from AI.w to E.e
arrow from AI.w to D.e
arrow from AI.w to B.e
arrow from AI.w to T.e
arrow from AI.w to R.e

arrow from H.e right 1.95 then to AI.n
arrow from R.w left 1.25 then up 3.7 then to E.w

text "asks, checks, rejects, decides" at H + (0,0.6)
text "proposes, explains," "generates, critiques" at AI + (0,-0.8)
```

The important part is the loop.

I still decide what problem I am solving. I decide what to trust. I run the code. I inspect the results. I change direction when the evidence disagrees with the model.

AI participates in the process, but it does not own the process.

## It changes what I can attempt

One of the things I find most useful about AI is that unfamiliar tools become less of a barrier.

In software, that may mean using a language or ecosystem I do not know particularly well because it is the most frictionless choice for the problem.

I can bring my existing software engineering knowledge with me: architecture, data structures, state, concurrency, APIs, testing, failure modes. AI helps bridge some of the incidental gap in syntax and tooling.

That does not suddenly make me an expert.

It means the question can shift from:

*Which tools do I already know well enough to use?*

to:

*Which tool is the best fit for what I am trying to do?*

Recently I have been experimenting with the same idea in FreeCAD. I am not a CAD expert, but with AI helping me navigate the tool and turn ideas into models, I have been able to get useful results with some degree of success.

Electronics is another area I want to explore in future posts: circuits, simulation, component selection, schematics, PCB workflows, debugging, and the path from an idea to something physical on the bench.

What interests me is whether AI can reduce enough friction that moving between software, CAD, electronics, and hardware does not require every boundary to become a project of its own.

## It can reduce friction without reducing curiosity

AI can also offload cognitive work.

Software development contains a lot of bookkeeping: syntax, boilerplate, API details, repetitive transformations, scaffolding, documentation lookup.

Some of that thinking matters.

Some of it is just friction.

If I can move part of that load into a tool, I get something valuable back: attention.

I can spend less time remembering how to express something and more time asking whether the idea itself makes sense. Less time translating an experiment into code and more time designing the experiment. Less time on mechanical work and more time following the strange idea that might actually lead somewhere interesting.

That is not avoiding thought.

It is choosing where to spend it.

And the opposite is also true: AI can be used to go deeper.

I want to use it to research AI itself: models, quantization, numerical formats, compilers, NPUs, memory bandwidth, and the boundaries between software and hardware.

Those subjects often pull me into areas where my knowledge is incomplete, particularly mathematics. A lot of the maths I learned in college has become rusty over the years, and many of the things I want to understand now keep leading me back to it.

AI gives me a way to revisit that material interactively.

I can ask for missing steps, alternative explanations, diagrams, executable examples, or a translation between equations and code. I can keep changing the representation until something finally clicks.

The same applies to research. I can ask for terminology I do not know, explore whether two ideas are actually related, or ask what experiment would falsify a hypothesis.

Then I can go and check.

That last part matters.

Using AI for research does not mean replacing sources with a chatbot. It means using the chatbot to navigate the search space, expose gaps in my understanding, generate hypotheses, and help design experiments.

Used lazily, AI can absolutely become a way not to learn.

Used deliberately, it can also be a very effective way to learn.

## Delegation is not abdication

This is where responsibility matters.

AI makes it extremely easy to generate complexity that nobody has properly inspected.

If I blindly accept a critical implementation because it looks plausible, and it later fails, saying *the AI got it wrong* is not much of a defence.

I chose to ship it.

I chose what to delegate.

I chose what to review.

The amount of scrutiny should depend on the consequence of failure. A throwaway script does not need the same treatment as authentication code, a PCB power stage, or software controlling physical hardware.

That was true before AI.

AI simply makes it possible to create unverified complexity much faster.

Used responsibly, delegation lets me concentrate attention where it matters most.

Used irresponsibly, it lets me manufacture blind spots at extraordinary speed.

## And yes, this article used AI

This article was written with the help of AI.

But that fact alone does not tell you very much.

It does not tell you which ideas were mine, which sentences were rewritten, what I rejected, how many times the argument changed, or whether any of it is correct.

Most importantly, it does not tell you whether the article is any good.

That part is still yours to decide.

This site is a lab notebook: half-finished experiments, notes to my future self, and the occasional write-up that reached a conclusion.

It would be odd to document the tools I use to build software and hardware while pretending that one of the most interesting tools currently on my desk does not exist.

So AI will appear here.

In the research, the code, the diagrams, the CAD experiments, eventually the electronics, and in the things I am trying to learn.

It will also appear in the boring work I would rather delegate so I can spend more time on the things I actually want to think about.

And, yes, it will appear in the writing.

Including this writing.

The important distinction, at least for me, is not whether a machine participated.

It is whether, when I press **publish**, I can say:

*I understand what I am putting my name on.*

*I accept responsibility if it is wrong.*

*And I mean this.*