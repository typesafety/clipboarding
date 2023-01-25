const {
    contextBridge,
    ipcRenderer,
} = require('electron')

// Expose node functionality to the renderer.
contextBridge.exposeInMainWorld('api', {
    onClipboardChanged: f => {
        ipcRenderer.on('clipboard-changed', (ev, ...args) => f(ev, ...args))
    },
})
