# yt-dlp-compgui
Electron interface for yt-dlp that parses the live `--help` output, splits options into tabs by section header, and renders each option with an editable value field.

## Features

- Loads the current `yt-dlp --help` output at startup.
- Splits options into tabs using the help section headers, such as General and Network.
- Shows every parsed option in a table with a text box for its value.
- Displays the full option description on hover.
- Runs yt-dlp against a required link.
- Exports the selected options as a config file.

## Run

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.

If `yt-dlp` is not on your PATH, set `YTDLP_BINARY` to the full executable path before launching the app.
