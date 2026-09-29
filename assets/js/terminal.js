(() => {
  const root = document.getElementById('tashi-website');
  if (!root) return;
  const terminalForm = root.querySelector('[data-terminal-form]');
  if (!terminalForm) return;
  const terminalInput = terminalForm.querySelector('input');
  const terminalBody = root.querySelector('[data-terminal-body]');
  const terminalHistory = root.querySelector('[data-terminal-history]');
  const terminalPrompt = root.querySelector('[data-terminal-prompt]');
  const terminalTitle = root.querySelector('[data-terminal-title]');
  // A browser-only filesystem for portfolio notes. Commands never run on a server.
  const homePath = '/Users/visitor';
  const projectPath = homePath + '/projects';
  const projectFiles = JSON.parse(root.querySelector('[data-project-files]').textContent);
  // Jekyll's Markdown output may contain entities such as &amp;.
  // Decode the tag-free body in a detached element, then render with textContent.
  projectFiles.forEach(project => {
    const text = document.createElement('div');
    text.innerHTML = project.body;
    project.body = text.textContent;
  });
  const projectIds = projectFiles.map(project => project.id);
  const filesystem = new Map([
    ['/', {type:'directory'}], ['/Users', {type:'directory'}],
    [homePath, {type:'directory'}], [projectPath, {type:'directory'}],
    [projectPath + '/README.md', {type:'file', text:'Selected projects\n\n' + projectFiles.map(project => project.id + '/  ' + project.title).join('\n') + '\n\nUse cd <project>, then cat README.md.\nUse cd .. to go back.'}]
  ]);
  projectFiles.forEach(project => {
    const folder = projectPath + '/' + project.id;
    filesystem.set(folder, {type:'directory'});
    filesystem.set(folder + '/README.md', {type:'file', text:[project.title, project.meta, '', project.body, '', 'More: cat methods.txt'].join('\n')});
    filesystem.set(folder + '/methods.txt', {type:'file', text:project.methods});
  });
  const commandNames = ['cat', 'cd', 'clear', 'help', 'ls', 'pwd'];
  let workingPath = projectPath;
  let previousPath = workingPath;
  const commandHistory = ['ls'];
  let historyIndex = commandHistory.length;
  let historyDraft = '';
  function resolvePath(value = '.', base = workingPath) {
    const expanded = value === '~' ? homePath : value.startsWith('~/') ? homePath + value.slice(1) : value;
    const parts = (expanded.startsWith('/') ? expanded : base + '/' + expanded).split('/');
    const resolved = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') resolved.pop();
      else resolved.push(part);
    }
    return '/' + resolved.join('/');
  }
  function entriesAt(path) {
    const prefix = path === '/' ? '/' : path + '/';
    return [...filesystem.keys()].filter(key => key !== path && key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
      .map(key => ({name:key.slice(prefix.length), type:filesystem.get(key).type}))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  function folderLabel() {
    return workingPath === homePath ? '~' : workingPath.split('/').pop() || '/';
  }
  function promptText() { return 'visitor@portfolio ' + folderLabel() + ' %'; }
  function updatePrompt() {
    terminalPrompt.textContent = promptText();
    terminalTitle.textContent = folderLabel() + ' — zsh';
    terminalInput.placeholder = workingPath === projectPath ? 'cd mace' : workingPath.startsWith(projectPath + '/') ? 'cat README.md' : 'ls';
  }
  function revealProject(path) {
    const project = path.slice(projectPath.length + 1).split('/')[0];
    if (!path.startsWith(projectPath + '/') || !projectIds.includes(project)) return;
    root.querySelectorAll('[data-project]').forEach(item => { item.open = item.dataset.project === project; });
  }
  function appendCommand(command) {
    const entry = document.createElement('div');
    entry.className = 'terminal-entry';
    const line = document.createElement('div');
    line.className = 'terminal-command';
    const prompt = document.createElement('span');
    prompt.className = 'terminal-prompt';
    prompt.textContent = promptText() + ' ';
    line.append(prompt, document.createTextNode(command));
    entry.appendChild(line);
    terminalHistory.appendChild(entry);
    // Bound retained scrollback without changing the current directory.
    while (terminalHistory.children.length > 80) terminalHistory.firstElementChild.remove();
    return entry;
  }
  function appendOutput(entry, text, entries) {
    if (!text && !entries) return;
    const output = document.createElement('pre');
    output.className = 'terminal-output';
    if (entries) {
      entries.forEach((item, index) => {
        if (index) output.appendChild(document.createTextNode('  '));
        const name = document.createElement('span');
        if (item.type === 'directory') name.className = 'terminal-prompt';
        name.textContent = item.name + (item.type === 'directory' ? '/' : '');
        output.appendChild(name);
      });
    } else output.textContent = text;
    entry.appendChild(output);
  }
  function clearTerminal() {
    terminalHistory.replaceChildren();
    const welcome = root.querySelector('.terminal-welcome');
    welcome.hidden = true;
  }
  function execute(words, entry) {
    const [command, ...args] = words;
    const fail = message => { appendOutput(entry, message); return false; };
    if (command === 'clear') {
      if (args.length) return fail('usage: clear');
      clearTerminal();
    } else if (command === 'help') {
      appendOutput(entry, 'ls                 List files\ncd mace            Enter a project\ncd ..              Go up one folder\ncat README.md      Read a file\npwd                Show current path\nclear              Clear the window\n\n↑↓ command history · Tab completion\nChain commands with &&.');
    } else if (command === 'pwd') {
      if (args.length) return fail('usage: pwd');
      appendOutput(entry, workingPath);
    } else if (command === 'cd') {
      if (args.length > 1) return fail('cd: too many arguments');
      const target = args[0] === '-' ? previousPath : resolvePath(args[0] || '~');
      const node = filesystem.get(target);
      if (!node) return fail('cd: no such file or directory: ' + args[0]);
      if (node.type !== 'directory') return fail('cd: not a directory: ' + args[0]);
      previousPath = workingPath;
      workingPath = target;
      revealProject(target);
      if (args[0] === '-') appendOutput(entry, workingPath);
    } else if (command === 'ls') {
      const unsupported = args.find(arg => arg.startsWith('-') && !['-a', '-F', '-aF', '-Fa'].includes(arg));
      if (unsupported) return fail('ls: unsupported option: ' + unsupported + '\nTry ls or ls -a.');
      const paths = args.filter(arg => !arg.startsWith('-'));
      if (paths.length > 1) return fail('usage: ls [-a] [path]');
      const target = resolvePath(paths[0] || '.');
      const node = filesystem.get(target);
      if (!node) return fail('ls: no such file or directory: ' + paths[0]);
      if (node.type === 'file') appendOutput(entry, target.split('/').pop());
      else {
        const entries = entriesAt(target);
        if (args.some(arg => arg.includes('a') && arg.startsWith('-'))) entries.unshift({name:'.',type:'directory'}, {name:'..',type:'directory'});
        appendOutput(entry, '', entries);
      }
    } else if (command === 'cat') {
      if (!args.length) return fail('usage: cat <file>\nTry cat README.md.');
      let success = true;
      for (const arg of args) {
        const target = resolvePath(arg);
        const node = filesystem.get(target);
        if (!node) { fail('cat: ' + arg + ': No such file or directory'); success = false; }
        else if (node.type === 'directory') { fail('cat: ' + arg + ': Is a directory'); success = false; }
        else { appendOutput(entry, node.text); revealProject(target); }
      }
      return success;
    } else return fail('zsh: command not found: ' + command + '\nType help for available commands.');
    return true;
  }
  terminalForm.addEventListener('submit', event => {
    event.preventDefault();
    const command = terminalInput.value.trim();
    if (!command) return;
    commandHistory.push(command);
    if (commandHistory.length > 100) commandHistory.shift();
    historyIndex = commandHistory.length;
    historyDraft = '';
    let entry = appendCommand(command);
    // Only interpret this small command set; never evaluate user input as code.
    for (const part of command.split('&&')) {
      const words = (part.trim().match(/"[^"]*"|'[^']*'|\S+/g) || []).map(word => word.replace(/^(["'])(.*)\1$/, '$2'));
      if (!words.length) { appendOutput(entry, 'zsh: parse error near &&'); break; }
      if (!entry.isConnected) { entry = document.createElement('div'); entry.className = 'terminal-entry'; terminalHistory.appendChild(entry); }
      if (!execute(words, entry)) break;
    }
    terminalInput.value = '';
    updatePrompt();
    terminalBody.scrollTop = terminalBody.scrollHeight;
  });
  terminalInput.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === commandHistory.length) historyDraft = terminalInput.value;
      historyIndex = Math.max(0, Math.min(commandHistory.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      terminalInput.value = historyIndex === commandHistory.length ? historyDraft : commandHistory[historyIndex];
      terminalInput.setSelectionRange(terminalInput.value.length, terminalInput.value.length);
    } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      clearTerminal();
    } else if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      appendCommand(terminalInput.value + '^C');
      terminalInput.value = '';
      historyIndex = commandHistory.length;
      historyDraft = '';
      terminalBody.scrollTop = terminalBody.scrollHeight;
    } else if (event.key === 'Tab' && !event.shiftKey && terminalInput.selectionStart === terminalInput.value.length) {
      const value = terminalInput.value;
      const tokens = value.split(/\s+/);
      const fragment = tokens[tokens.length - 1];
      let candidates;
      if (tokens.length === 1) candidates = commandNames.filter(name => name.startsWith(fragment));
      else {
        const slash = fragment.lastIndexOf('/');
        const prefix = slash >= 0 ? fragment.slice(0, slash + 1) : '';
        const partial = fragment.slice(slash + 1);
        candidates = entriesAt(resolvePath(prefix || '.'))
          .filter(item => item.name.startsWith(partial) && (tokens[0] !== 'cd' || item.type === 'directory'))
          .map(item => prefix + item.name + (item.type === 'directory' ? '/' : ''));
      }
      if (candidates.length === 1) {
        event.preventDefault();
        terminalInput.value = value.slice(0, value.length - fragment.length) + candidates[0] + (tokens.length === 1 ? ' ' : '');
        terminalInput.setSelectionRange(terminalInput.value.length, terminalInput.value.length);
      }
    }
  });
})();
