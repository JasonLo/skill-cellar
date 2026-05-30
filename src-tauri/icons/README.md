# Icons

Bundle icons are generated, not hand-committed. Before the first
`bun run tauri build`, generate them from a source PNG (1024×1024 recommended):

```bash
bunx tauri icon path/to/logo.png
```

This populates `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, and
`icon.ico` referenced by `tauri.conf.json`.
