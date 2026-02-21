import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { Storage } from '../persistence/Storage';
import { ContentPack, HistoryGame, Settings } from '../shared/types';

const storage = new Storage();

function getCorePackPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', 'packs', 'core.json');
  }
  return path.join(process.cwd(), 'resources', 'packs', 'core.json');
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1150,
    minHeight: 720,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc() {
  ipcMain.handle('settings:get', () => storage.getSettings());
  ipcMain.handle('settings:save', (_evt, settings: Settings) => storage.saveSettings(settings));

  ipcMain.handle('packs:list', () => storage.listPacks());
  ipcMain.handle('packs:get', (_evt, packId: string) => storage.getPack(packId));
  ipcMain.handle('packs:save', (_evt, pack: ContentPack) => storage.savePack(pack));
  ipcMain.handle('packs:delete', (_evt, packId: string) => storage.deletePack(packId));

  ipcMain.handle('packs:import-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importer un pack JSON',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return storage.importPack(result.filePaths[0]);
  });

  ipcMain.handle('packs:export-dialog', async (_evt, packId: string) => {
    const pack = await storage.getPack(packId);
    if (!pack) return false;
    const result = await dialog.showSaveDialog({
      title: 'Exporter le pack JSON',
      defaultPath: `${pack.id}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return false;
    return storage.exportPack(packId, result.filePath);
  });

  ipcMain.handle('packs:load-active', async () => {
    const settings = await storage.getSettings();
    return storage.loadActivePacks(settings.activePackIds);
  });

  ipcMain.handle('history:append', (_evt, entry: HistoryGame) => storage.appendHistory(entry));
  ipcMain.handle('history:read', () => storage.readHistory());
}

app.whenReady().then(async () => {
  await storage.init();
  await storage.ensureCorePack(getCorePackPath());
  registerIpc();
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
