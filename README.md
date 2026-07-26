# Gruvboxitator Web

A browser-based port of `gruvboxitator.py`. It converts local images to Gruvbox Material Dark Hard without uploading them.

## Features

- Four presets matching the Python application
- Local PNG, JPEG, WebP, and AVIF processing
- Before and after comparison
- PNG export
- Optional Gruvbox palette swatch export
- Gruvbox Material Dark Hard interface, dark-locked, built with shadcn/ui and Tailwind v4

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run build
npm run lint
```

## Implementation notes

The image pipeline ports the original tonal ramp, HLS accent selection, percentile normalization, vignette, deterministic grain, contrast, Gaussian unsharp masking, and Dark Hard black floor. Image processing runs entirely in the browser.
