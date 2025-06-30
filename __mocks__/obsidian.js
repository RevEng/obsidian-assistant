// Mock for Obsidian API
// This file mocks the Obsidian API for testing

// Mock Plugin class
class Plugin {
  constructor() {
    this.app = {
      workspace: {
        getLeavesOfType: jest.fn().mockReturnValue([]),
        getRightLeaf: jest.fn().mockReturnValue({
          setViewState: jest.fn().mockResolvedValue(undefined),
        }),
        revealLeaf: jest.fn(),
        on: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      },
      vault: {
        getMarkdownFiles: jest.fn().mockReturnValue([]),
        read: jest.fn().mockResolvedValue(''),
        on: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      },
    };
  }

  loadData() {
    return Promise.resolve({});
  }

  saveData() {
    return Promise.resolve();
  }

  registerView() {}
  addRibbonIcon() {}
  addCommand() {}
  addSettingTab() {}
  registerEvent() {}
}

// Mock ItemView class
class ItemView {
  constructor(leaf) {
    this.leaf = leaf;
    this.containerEl = {
      children: [
        {},
        {
          empty: jest.fn(),
          createEl: jest.fn().mockReturnValue({
            createDiv: jest.fn().mockReturnValue({
              createEl: jest.fn().mockReturnValue({}),
            }),
          }),
          createDiv: jest.fn().mockReturnValue({
            createDiv: jest.fn().mockReturnValue({
              createEl: jest.fn().mockReturnValue({
                addEventListener: jest.fn(),
              }),
              createDiv: jest.fn().mockReturnValue({
                createEl: jest.fn().mockReturnValue({
                  addEventListener: jest.fn(),
                }),
              }),
            }),
            createEl: jest.fn().mockReturnValue({}),
          }),
        },
      ],
    };
  }
}

// Mock WorkspaceLeaf
class WorkspaceLeaf {
  constructor() {}
}

// Mock App
class App {
  constructor() {
    this.workspace = {
      getLeavesOfType: jest.fn().mockReturnValue([]),
      getRightLeaf: jest.fn().mockReturnValue({
        setViewState: jest.fn().mockResolvedValue(undefined),
      }),
      revealLeaf: jest.fn(),
    };
    this.vault = {
      getMarkdownFiles: jest.fn().mockReturnValue([]),
      read: jest.fn().mockResolvedValue(''),
    };
  }
}

// Mock PluginSettingTab
class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {
      empty: jest.fn(),
      createEl: jest.fn().mockReturnValue({}),
    };
  }
}

// Mock Setting
class Setting {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }

  setName() {
    return this;
  }

  setDesc() {
    return this;
  }

  addText() {
    return this;
  }

  addDropdown() {
    return this;
  }

  addTextArea() {
    return this;
  }
}

// Mock Notice
class Notice {
  constructor(message) {
    this.message = message;
  }
}

// Mock TFile
class TFile {
  constructor(path, basename, extension) {
    this.path = path;
    this.basename = basename;
    this.extension = extension;
  }
}

// Export all mocks
module.exports = {
  Plugin,
  ItemView,
  WorkspaceLeaf,
  App,
  PluginSettingTab,
  Setting,
  Notice,
  TFile,
};
