# hugo-theme-lab

Minimal text-first Hugo blog theme. Light/dark toggle, reading time, cover images, prev/next navigation, and build-time rendering of `pikchr` and `gnuplot` code fences.

## Setup

```sh
hugo new site myblog && cd myblog
git init
git submodule add https://github.com/yourname/hugo-theme-lab themes/hugo-theme-lab
cp themes/hugo-theme-lab/exampleSite/hugo.toml .
cp -r themes/hugo-theme-lab/exampleSite/content .
mkdir -p .github/workflows && cp themes/hugo-theme-lab/.github/workflows/hugo.yml .github/workflows/
hugo server
```

New post: `hugo new posts/my-post.md` (front matter comes from `archetypes/posts.md`).

## GitHub Pages

Push to `main`; in repo Settings → Pages set Source to **GitHub Actions**. The workflow builds and deploys automatically.

## Front matter

- `summary` — shown on the list page (falls back to auto summary)
- `cover.image`, `cover.alt`, `cover.caption` — optional hero image
- Reading time and dates are automatic

## Diagram fences

A ```` ```pikchr ```` or ```` ```gnuplot ```` fence is rendered to inline SVG at build
time, so it matches what the VS Code Markdown preview shows and needs no JavaScript,
no network service, and no client-side wasm.

````markdown
```pikchr
box "parser" fit; arrow right 0.4; box "renderer" fit
```

```gnuplot
set grid
plot sin(x) title "sin(x)"
```
````

Optional attributes, on the info line:

````markdown
```pikchr {alt="Parser pipeline" caption="How a fence becomes SVG."}
box "md" fit; arrow right 0.4; box "svg" fit
```
````

`alt` sets `role="img"` plus `aria-label`; `caption` adds a `<figcaption>`; `class` is
appended to the figure's classes; `align` is `left`, `center` (the default) or `right`,
and anything else fails the build. Any other fence language is left alone.

A diagram is shown at its natural size, shrinking to fit the column but never stretching
past it.

### How it works

`scripts/render-diagrams.mjs` scans `content/`, renders each diagram fence through the
[`@reonarudo/pikchr-renderer`](https://github.com/Reonarudo/pikchr-renderer) and
[`@reonarudo/gnuplot-renderer`](https://github.com/Reonarudo/gnuplot-renderer) libraries,
and writes `assets/diagrams/<lang>/<key>.svg`. Every render hook in
`layouts/_default/_markup/` calls `layouts/partials/diagram.html`, which computes the same
key and inlines the SVG. The key is `sha256(<page folder> "\n" <dialect> "\n" <fence body>)`:
the page folder is Hugo's `.Page.File.Dir`, so two posts with the same fence and different
data files never share an SVG; the dialect is empty for pikchr and gnuplot.

A fence the libraries reject fails the renderer with a `file:line:column` message, and a
fence with no matching SVG **fails the build** rather than publishing a page with a hole
in it. The renderer wipes `assets/diagrams/` on every run; add it to the site repo's
`.gitignore` — it is generated output.

### Requirements

The site repo needs a `package.json` that depends on the libraries and has a `diagrams`
script, an `.npmrc` with `allow-git=root` (npm refuses git dependencies without it) and
an `.nvmrc`; reonarudo.github.io has all three. Locally that means Node 22 or later and
`npm ci`. Nothing native: the libraries carry their engines as wasm.

### Local preview

`hugo server` does not re-run the renderer, so re-run it after editing a fence:

```sh
npm run diagrams && hugo server
```

### Constraints

The libraries treat fence source as untrusted. gnuplot owns the terminal and output, so
`set terminal` / `set output` are rejected, as are `load` and `call`. Data files
referenced by `plot "./data/x.csv"` resolve relative to the Markdown file and may not
leave `content/`. Sources are capped at 64 000 characters, and a render that runs past 3
seconds fails. gnuplot draws on an 800×500 canvas.

### Authoring both fence types in VS Code

Install **Gnuplot Markdown Preview** (`ReoX86.gnuplot-markdown-preview`) and the pikchr
extension built from the `fix/delegate-non-pikchr-fences` branch. Earlier pikchr builds
replace *every* non-pikchr fence in the preview with raw unescaped text; the branch makes
the plugin delegate fences it does not own, so both extensions coexist in either load
order. The site build is independent of both — it renders from the Markdown source.
