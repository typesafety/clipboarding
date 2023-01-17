const { app, clipboard } = require('electron')
const { WebSocketServer } = require('ws')

// How often the clipboard should be checked for changes, in milliseconds.
const POLLING_INTERVAL = 100

// WebSocketServer options.
// See https://github.com/websockets/ws/blob/HEAD/doc/ws.md#serverclients
const WEBSOCKET_SERVER_OPTIONS = {
    clientTracking: true,
    port: 8080,
}

/**
 * Start a loop that polls the clipboard every POLLING_INTERVAL milliseconds.
 *
 * @param {Function} callback - Optional.  Each time the clipboard is polled and
 * a change is detected, this function will be called on the contents of the
 * clipboard.  The callback takes a single String parameter.  If the callback
 * returns `null`, the loop exits.  If the callback is not falsey, it will not
 * be called and the loop will run forever.
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
                const text = clipboard.readText()
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
 * Start the Websocket server.
 *
 * @returns {WebSocketServer} - The created WebSocketServer object.
 */
function startWs() {
    const wss = new WebSocketServer(WEBSOCKET_SERVER_OPTIONS)

    wss.on('connection', function connection(ws, request) {
        // Start clipboard polling for incoming connections.
        console.log(`New connection: ${JSON.stringify(request.headers)}`)
        pollClipboard(text => ws.send(text))
    })

    const { address, port, family } = wss.address()
    console.log(
        `Started new websocket server: ` +
        `family=${family} address=${address} port=${port}`
    )
    return wss
}

/**
 * Main entry point to the application.
 */
function main() {
    console.log('Starting.')
    const wss = startWs()
}

app.whenReady().then(main)
