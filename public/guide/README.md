# Guide step images

Drop screenshots/photos for the Local/Intra guide steps here, then reference
them from `src/lib/guide-content.ts` by path, e.g.:

```ts
{
  title: "Connect the ethernet cable",
  description: "Plug the blue cable into the port on the left side of the dock.",
  image: "/guide/local-step-1.png",
}
```

Any image format the browser supports works (png, jpg, webp, ...). No size
limit is enforced, but keep files reasonably small (a few hundred KB) so the
guide pages load quickly — a screenshot resized to ~1000px wide is usually
plenty legible.

This file itself isn't referenced anywhere; it just keeps this folder
tracked in git until real images are added.
