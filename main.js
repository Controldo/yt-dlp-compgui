const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function normalizeSectionTitle(title) {
  return title.replace(/\s+Options$/i, '').trim();
}

function isSectionHeader(line) {
  return /^[A-Za-z][A-Za-z0-9 /&().,-]* Options:$/.test(line.trim());
}

function isValueToken(token) {
  return /^[A-Z][A-Z0-9_./:-]*(?:\.\.\.)?$/.test(token) || /^\[[^\]]+\]$/.test(token);
}

function parseOptionSpec(spec) {
  const segments = spec.split(',').map((segment) => segment.trim()).filter(Boolean);
  const flags = [];
  let valuePlaceholder = '';

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const tokens = segment.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      continue;
    }

    if (index === segments.length - 1) {
      const lastToken = tokens[tokens.length - 1];
      if (isValueToken(lastToken)) {
        valuePlaceholder = lastToken.replace(/[\[\]]/g, '');
        tokens.pop();
      }
    }

    const normalized = tokens.join(' ').trim();
    if (normalized) {
      flags.push(normalized);
    }
  }

  return {
    spec,
    flags,
    valuePlaceholder,
    expectsValue: valuePlaceholder.length > 0,
  };
}

function parseHelpText(text) {
  const lines = stripAnsi(text).replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let currentSection = null;
  let lastOption = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, '');
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (isSectionHeader(line)) {
      currentSection = {
        title: normalizeSectionTitle(trimmed.replace(/ Options:$/i, '')),
        options: [],
      };
      sections.push(currentSection);
      lastOption = null;
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const optionMatch = line.match(/^\s{2,}(.+?)\s{2,}(.+)$/);
    if (optionMatch && /-/.test(optionMatch[1])) {
      const spec = optionMatch[1].trim();
      const description = optionMatch[2].trim();
      const option = parseOptionSpec(spec);

      option.description = description;
      option.id = `${currentSection.title}-${currentSection.options.length}`;
      currentSection.options.push(option);
      lastOption = option;
      continue;
    }

    if (lastOption && /^\s{4,}/.test(line)) {
      lastOption.description = `${lastOption.description} ${trimmed}`.trim();
    }
  }

  return sections.filter((section) => section.options.length > 0);
}

function collectCommandParts(optionsById, sections) {
  const parts = [];

  for (const section of sections) {
    for (const option of section.options) {
      const entry = optionsById[option.id];

      if (option.expectsValue) {
        const value = String(entry || '').trim();
        if (!value) {
          continue;
        }
        parts.push(option.flags[0], value);
      } else {
        if (!entry) {
          continue;
        }
        parts.push(option.flags[0]);
      }
    }
  }

  return parts;
}

function spawnCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function loadHelpData() {
  const executable = process.env.YTDLP_BINARY || 'yt-dlp';
  const result = await spawnCommand(executable, ['--help']);
  const output = stripAnsi((result.stdout || result.stderr || '').trim());

  if (!output) {
    throw new Error(`Unable to read help output from ${executable}`);
  }

  return {
    executable,
    sections: parseHelpText(output),
  };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    backgroundColor: '#101418',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('help:load', async () => {
  return loadHelpData();
});

ipcMain.handle('yt:run', async (_event, payload) => {
  const executable = payload.executable || process.env.YTDLP_BINARY || 'yt-dlp';
  const url = String(payload.url || '').trim();
  const args = collectCommandParts(payload.options || {}, payload.sections || []);

  if (!url) {
    throw new Error('A link is required before running yt-dlp.');
  }

  args.push(url);
  const result = await spawnCommand(executable, args);

  return {
    command: [executable, ...args].join(' '),
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  };
});

ipcMain.handle('config:save', async (_event, payload) => {
  const sections = payload.sections || [];
  const options = payload.options || {};
  const lines = [];

  for (const section of sections) {
    for (const option of section.options) {
      const raw = options[option.id];

      if (option.expectsValue) {
        const value = String(raw || '').trim();
        if (!value) {
          continue;
        }
        lines.push(`${option.flags[0]} ${value}`);
      } else {
        if (!raw) {
          continue;
        }
        lines.push(option.flags[0]);
      }
    }
  }

  const response = await dialog.showSaveDialog(mainWindow, {
    title: 'Save yt-dlp config file',
    defaultPath: 'yt-dlp.conf',
    filters: [{ name: 'Config files', extensions: ['conf', 'txt'] }],
  });

  if (response.canceled || !response.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(response.filePath, `${lines.join('\r\n')}\r\n`, 'utf8');

  return { canceled: false, filePath: response.filePath };
});

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});