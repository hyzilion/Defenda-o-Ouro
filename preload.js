const { contextBridge, ipcRenderer } = require('electron');

function sync(channel, payload) {
  return ipcRenderer.sendSync(channel, payload);
}

contextBridge.exposeInMainWorld('__defendaNativeStore', {
  loadAll() {
    return sync('defenda-save:load-all');
  },
  loadAccount() {
    return sync('defenda-save:load-account');
  },
  saveAccount(account) {
    return sync('defenda-save:save-account', account);
  },
  loadSettings() {
    return sync('defenda-save:load-settings');
  },
  saveSettings(settings) {
    return sync('defenda-save:save-settings', settings);
  },
  setFullscreen(on) {
    return sync('defenda-window:set-fullscreen', !!on);
  },
  exitApp() {
    return sync('defenda-app:exit');
  }
});
