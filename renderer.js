const state = {
  executable: 'yt-dlp',
  sections: [],
  activeSectionIndex: 0,
  optionValues: {},
};

const tabBar = document.getElementById('tab-bar');
const tabPanels = document.getElementById('tab-panels');
const commandPreview = document.getElementById('command-preview');
const outputPanel = document.getElementById('output-panel');
const statusLine = document.getElementById('status-line');
const urlInput = document.getElementById('url-input');
const runButton = document.getElementById('run-button');
const configButton = document.getElementById('config-button');
const sectionCount = document.getElementById('section-count');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Outputs array of selected args (and values if applicable)
function buildCommandArgs() {
  const args = [];
  const url = urlInput.value.trim();

  for (const section of state.sections) {
    for (const option of section.options) {
      const raw = state.optionValues[option.id];

      // Either the option is a flag or requires an input value
      // Skip if option is not selected/no value was input
      if (option.expectsValue) {
        const value = String(raw || '').trim();
        if (!value) {
          continue;
        }
        args.push(option.flags[0], value);
      } else {
        if (!raw) {
          continue;
        }
        args.push(option.flags[0]);
      }
    }
  }

  if (url) {
    args.push(url);
  }

  return args;
}

function refreshCommandPreview() {
  const args = buildCommandArgs();
  commandPreview.textContent = [state.executable, ...args].join(' ');
}

// "Section" meaning the tabs, active meaning the one currently selected
function setActiveSection(index) {
  state.activeSectionIndex = index;

  for (const button of tabBar.querySelectorAll('button[data-section-index]')) {
    button.classList.toggle('active', Number(button.dataset.sectionIndex) === index);
  }

  for (const panel of tabPanels.querySelectorAll('.section-panel')) {
    panel.classList.toggle('active', Number(panel.dataset.sectionIndex) === index);
  }
}

function renderTabSections() {
  tabBar.innerHTML = '';
  tabPanels.innerHTML = '';
  sectionCount.textContent = `${state.sections.length} sections`;

  if (state.sections.length === 0) {
    tabPanels.innerHTML = '<div class="empty-state error-text">No sections were parsed from yt-dlp help output.</div>';
    return;
  }

  buildTabSections();
  setActiveSection(0);
}

function buildTabSections() {
  state.sections.forEach((section, sectionIndex) => {
    const tabButton = document.createElement('button');
    tabButton.className = 'tab-button';
    tabButton.type = 'button';
    tabButton.textContent = section.title;
    tabButton.dataset.sectionIndex = String(sectionIndex);
    tabButton.addEventListener('click', () => setActiveSection(sectionIndex)); // Change section when tab is clicked
    tabBar.appendChild(tabButton);

    const panel = document.createElement('section');
    panel.className = 'section-panel';
    panel.dataset.sectionIndex = String(sectionIndex);

    const title = document.createElement('h3');
    title.textContent = section.title;
    panel.appendChild(title);

    const table = document.createElement('table');
    table.className = 'section-table';

    table.innerHTML = `
      <thead>
        <tr>
          <th>Option</th>
          <th>Description</th>
          <th>Value</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');

    section.options.forEach((option) => {
      const row = document.createElement('tr');

      const optionCell = document.createElement('td');
      optionCell.innerHTML = `<div class="option-spec">${option.flags.map((flag) => `<code>${escapeHtml(flag)}</code>`).join('')}</div>`;

      const descriptionCell = document.createElement('td');
      descriptionCell.className = 'description-cell';
      descriptionCell.title = option.description;
      descriptionCell.textContent = option.description;

      const valueCell = document.createElement('td');
      valueCell.className = 'value-cell';

      const input = createInputForOption(option);

      valueCell.appendChild(input);
      row.append(optionCell, descriptionCell, valueCell);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    panel.appendChild(table);
    tabPanels.appendChild(panel);
  });
}

function createInputForOption(option) {
  const input = document.createElement('input');
  input.dataset.optionId = option.id;
  input.title = option.description;

  if (option.expectsValue) {
    input.type = 'text';
    input.placeholder = option.valuePlaceholder || 'value';
    input.value = state.optionValues[option.id] || '';
    input.addEventListener('input', (event) => {
      state.optionValues[option.id] = event.target.value;
      refreshCommandPreview();
    });
  } else {
    input.type = 'checkbox';
    input.checked = state.optionValues[option.id] || false;
    input.addEventListener('change', (event) => {
      state.optionValues[option.id] = event.target.checked;
      refreshCommandPreview();
    });
  }

  return input;
}

async function loadHelp() {
  try {
    const result = await window.ytDlpCompGui.loadHelp();
    state.executable = result.executable;
    state.sections = result.sections;
    statusLine.textContent = `Loaded help output from ${result.executable}.`;
    renderTabSections();
    refreshCommandPreview();
  } catch (error) {
    statusLine.textContent = `Unable to load yt-dlp help output: ${error.message}`;
    statusLine.classList.add('error-text');
    commandPreview.textContent = error.stack || error.message;
  }
}

async function runCommand() {
  const url = urlInput.value.trim();
  if (!url) {
    statusLine.textContent = 'Add a link before running yt-dlp.';
    statusLine.classList.add('error-text');
    return;
  }

  statusLine.classList.remove('error-text');
  statusLine.textContent = 'Running yt-dlp...';

  try {
    const result = await window.ytDlpCompGui.runCommand({
      executable: state.executable,
      url,
      options: state.optionValues,
      sections: state.sections,
    });

    outputPanel.textContent = [
      `Command: ${result.command}`,
      `Exit code: ${result.code}`,
      '',
      result.stdout || '(no stdout)',
      result.stderr ? ['', 'stderr:', result.stderr].join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n');

    statusLine.textContent = result.code === 0 ? 'Command finished successfully.' : `Command finished with exit code ${result.code}.`;
    if (result.code !== 0) {
      statusLine.classList.add('error-text');
    }
  } catch (error) {
    statusLine.textContent = `Failed to run yt-dlp: ${error.message}`;
    statusLine.classList.add('error-text');
  }
}

async function saveConfig() {
  try {
    const result = await window.ytDlpCompGui.saveConfig({
      options: state.optionValues,
      sections: state.sections,
    });

    if (result.canceled) {
      statusLine.textContent = 'Config export canceled.';
      return;
    }

    statusLine.classList.remove('error-text');
    statusLine.textContent = `Saved config file to ${result.filePath}.`;
  } catch (error) {
    statusLine.textContent = `Failed to save config file: ${error.message}`;
    statusLine.classList.add('error-text');
  }
}

urlInput.addEventListener('input', refreshCommandPreview);
runButton.addEventListener('click', runCommand);
configButton.addEventListener('click', saveConfig);

loadHelp();