# yt-dlp-compgui
Graphical interface for yt-dlp that parses the live `--help` output, splits options into tabs by section header, and renders each option with an editable value field. Alternatively, provides easier viewing experience than reading the raw `--help` output or the official README.

Built with Electron on the recommendation of a friend.

## Features

- Splits options into tabs using the help section headers, such as General and Network.
- Shows every parsed option in a table with a text box for its value.
- Displays the full option description on hover.
- Runs yt-dlp with a provided link.
- Ability to export options as a config file.

## Screenshots
![App with options selected](screenshots/UI%20with%20options.png)

## Run current version

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.

If `yt-dlp` is not on your PATH, set `YTDLP_BINARY` to the full executable path before launching the app.
