const electron = require('electron')
const fs = require('fs')
const http = require('http')
const ws = require('ws')

// How often the clipboard should be checked for changes, in milliseconds.
const POLLING_INTERVAL = 100

// http.Server options.
// See https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener
const HTTP_SERVER_OPTIONS = {
    port: 8080,
}

/**
 * Start a loop that polls the clipboard every POLLING_INTERVAL milliseconds.
 *
 * @param {Function} callback - Optional.  Each time the clipboard is polled and
 * a change is detected, this function will be called on the contents of the
 * clipboard.  The callback takes a single String parameter.  If the callback
 * returns `null`, the loop exits.  If the callback is falsy, it will not be
 * called and the loop will run forever.
 */
async function pollClipboard(callback) {
    console.log(`Polling the clipboard every ${POLLING_INTERVAL} milliseconds.`)

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
            }, POLLING_INTERVAL)
        })
    }

    let polling = true
    while (polling) {
        const newText = await checkClipboard(callback)
        if (newText === null) {
            continue
        }

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
 * @returns {http.Server} - The created Server object.
 */
function startServer() {
    // Set up a HTTP web server with websocket listeners.
    const server = http.createServer(HTTP_SERVER_OPTIONS)
    const wss = new ws.WebSocketServer({ server })

    // Websocket listeners.
    wss.on('connection', function connection(ws, request) {
        // Start clipboard polling for incoming connections.
        console.log(`Websocket connection: ${JSON.stringify(request.headers)}`)
        pollClipboard(text => ws.send(text))
    })

    // HTTP server listeners.
    server.on('request', (req, res) => {
        console.log(`HTTP ${req.method}: ${JSON.stringify(req.headers)}`)
        fs.readFile('./index.html', (_err, data) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html')
            res.setHeader('Content-Length', data.length)
            res.write(data)
            res.end()
        })
    })

    server.listen(HTTP_SERVER_OPTIONS.port)

    const { address, port, family } = server.address()
    console.log(
        'Web server is listening: ' +
        `family=${family} address=${address} port=${port}`
    )

    return server
}

/**
 * Main entry point to the application.
 */
function main() {
    console.log('Starting.')
    startServer()
}

electron.app.whenReady().then(main)
