const assert = require('node:assert/strict')
const electron = require('electron')
const fs = require('fs')
const http = require('http')
const path = require('node:path')
const process = require('node:process')
const ws = require('ws')

const APP_SETTINGS = {
    // How often the clipboard should be checked for changes, in
    // milliseconds.
    pollingInterval: 100,

    // The default port for the server and client to use if not specified
    // elsewhere (CLI args).
    port: 8080
}

const CLIENT_PATH = path.join(__dirname, 'client.html')
const ICON_PATH = path.join(__dirname, 'icon.ico')
const PRELOAD_PATH = path.join(__dirname, 'preload.js')
const WINDOW_PATH = path.join(__dirname, 'window.html')

/**
 * Start a loop that polls the clipboard every POLLING_INTERVAL milliseconds.
 *
 * @param {Number} pollingInterval - How often to poll the clipboard for
 * changes, in milliseconds.
 * @param {Function} callback - Optional.  Each time the clipboard is polled and
 * a change is detected, this function will be called on the contents of the
 * clipboard.  The callback takes a single String parameter.  If the callback
 * returns `null`, the loop exits.  If the callback is falsy, it will not be
 * called and the loop will run forever.
 */
async function pollClipboard(pollingInterval, callback) {
    assert(!isNaN(pollingInterval))

    console.log(`Polling the clipboard every ${pollingInterval} milliseconds.`)

    // Return a Promise to check the text in the clipboard after
    // POLLING_INTERVAL milliseconds.  If the text has changed, resolves with
    // the new text, otherwise `null`.
    let buffer = null
    function checkClipboard() {
        return new Promise(resolve => {
            setTimeout(() => {
                const text = electron.clipboard.readText()
                if (text !== buffer) {
                    buffer = text
                    resolve(buffer)
                } else {
                    resolve(null)
                }
            }, pollingInterval)
        })
    }

    let polling = true
    while (polling) {
        const newText = await checkClipboard(callback)
        if (newText === null) {
            continue
        }

        console.log('new message')
        window.webContents.send('clipboard-changed', newText)

        if (callback) {
            const res = callback(newText)
            if (res === null) {
                polling = false
                console.log('Callback returned null, stopping polling.')
            }
        }
    }
}

/**
 * Start a web server with a websocket server.
 *
 * @param {Object} httpServerOptions - `http.Server` options.
 * See https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener
 * @returns {http.Server} - The created Server object.
 */
function startServer(httpServerOptions) {
    // Set up a HTTP web server with websocket listeners.
    const server = http.createServer(httpServerOptions)
    const wss = new ws.WebSocketServer({ server })

    // Websocket listeners.
    wss.on('connection', function connection(ws, request) {
        // Start clipboard polling for incoming connections.
        console.log(`Websocket connection: ${JSON.stringify(request.headers)}`)
        pollClipboard(APP_SETTINGS.pollingInterval, text => ws.send(text))
    })

    // HTTP server listeners.
    server.on('request', (req, res) => {
        console.log(`HTTP ${req.method}: ${JSON.stringify(req.headers)}`)

        if (req.method === 'GET') {
            // Encoding is needed to get the data as a string so that we can
            // use string.replace().
            fs.readFile(CLIENT_PATH, 'utf-8', (_err, data) => {
                const replaced = data.replace(
                    '{{PLACEHOLDER:WS_PORT}}',
                    APP_SETTINGS.port)
                res.statusCode = 200
                res.setHeader('Content-Type', 'text/html')
                res.setHeader('Content-Length', replaced.length)
                res.write(replaced)
                res.end()
            })
        } else {
            res.statusCode = 405
            res.setHeader('Content-Type', 'text/plain')
            res.write('Method Not Allowed\n')
            res.end()
        }
    })

    server.listen(APP_SETTINGS.port)

    const { address, port, family } = server.address()
    console.log(
        'Web server is listening: ' +
        `family=${family} address=${address} port=${port}`
    )

    return server
}

/**
 * Start the client in the system's default browser (pointing to localhost).
 *
 * @param {number} port - The port to connect to.
 */
function startClient(port) {
    assert(!isNaN(port))
    electron.shell.openExternal(`http://localhost:${port}`)
}

/**
 * Get CLI args.
 *
 * @returns {Object} - Key-value pair of parsed arguments.
 */
function getArgs() {
    const args = process.argv.slice(2)
    const ret = {}
    args.forEach((elem, ix) => {
        if (ix === 0 && !isNaN(Number(elem))) {
            ret.port = Number(elem)
        }
    })
    return ret
}

/**
 * Main entry point to the application.
 */
function main() {
    // Read CLI args and set up global settings.
    const args = getArgs()
    Object.assign(APP_SETTINGS, args)
    console.log(`APP_SETTINGS: ${JSON.stringify(APP_SETTINGS)}`)

    // Start the server and open a tab in the system browser.
    //
    // Also open an Electron BrowserWindow to have something visual attached to
    // the process (show some debug output, dies when the window is closed etc.)
    console.log('Starting server.')
    startServer({ port: APP_SETTINGS.port })

    console.log('Starting client in web browser.')
    startClient(APP_SETTINGS.port)

    console.log('Creating BrowserWindow.')
    window = new electron.BrowserWindow({
        autoHideMenuBar: true,
        fullscreenable: false,
        width: 320,
        height: 160,
        minWidth: 320,
        minHeight: 160,
        icon: ICON_PATH,
        webPreferences: {
            preload: PRELOAD_PATH,
        },
    })
    window.loadFile(WINDOW_PATH)
}

// Define here for global access, but we can't instantiate a BrowserWindow until
// the app is "ready".
let window

electron.app.whenReady().then(main)
