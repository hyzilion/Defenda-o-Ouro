const { app, BrowserWindow, Menu } = require('electron')

function createWindow() {
  const win = new BrowserWindow({ width: 1280, height: 720 })
  win.loadFile('index.html')
  Menu.setApplicationMenu(null)
}

app.whenReady().then(createWindow)