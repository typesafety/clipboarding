const { app, clipboard } = require('electron')

// How often the clipboard should be checked for changes, in milliseconds.
const POLLING_INTERVAL = 100

/**
 * TODO: Do something useful in here.
 */
function sendText(text) {
    if (text === 'exit') {
        return null
    }
    console.log(`Sending "${text}".`)
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

        console.log('Clipboard text changed.')
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
 * Main entry point to the application.
 */
function main() {
    pollClipboard(sendText)
    console.log('Polling finished.')
}

app.whenReady().then(main)