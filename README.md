# debugging reality

An amusement park of things I have built. Rides may break in production.

The park is a 3D map you turn and click; each attraction opens a plain, readable
page. Everything in it is also reachable as an ordinary list of links, so the
site works without WebGL, without a pointer, and without JavaScript.

## Layout

| Path | What lives there |
| --- | --- |
| `app/` | Routes. One directory per attraction, all server-rendered. |
| `src/park/` | The 3D navigation layer. Client-only. |
| `src/design/` | Design tokens and the chrome the pages share. |
| `src/content/` | The park's content, as plain data. |
| `assets/` | The Blender build script and the export pipeline. |
| `docs/` | [DESIGN.md](docs/DESIGN.md) and [ASSETS.md](docs/ASSETS.md). |

Start with `docs/DESIGN.md`. It records the navigation reference the park is
built against, the design system, the budgets, and which decisions are settled.
`docs/ASSETS.md` covers the Blender pipeline and the baked-unlit contract the
runtime depends on.

## Development

```sh
npm install
npm run dev
```

## Gates

```sh
npm run check        # typecheck, lint, test, build, byte budgets
npm run test:e2e     # navigation in chromium, firefox, webkit, mobile webkit
npm run contrast     # WCAG contrast table for the palette
npm run size         # shipped-byte budgets
```

`npm run check` is what CI runs, plus the end-to-end suite. Everything is
expected to be green before a merge; nothing here is advisory.

Working on the park's geometry needs Blender and the commands in
`docs/ASSETS.md`.
