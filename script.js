document.addEventListener("DOMContentLoaded", () => {
    // -----------------------
    // Element Refs
    // -----------------------
    const numFramesEl = document.getElementById("numFrames");
    const winSizeEl = document.getElementById("winSize");
    const simulateBtn = document.getElementById("simulateBtn");
    const clearBtn = document.getElementById("clearBtn");
    const canvas = document.getElementById("timelineCanvas");
    const ctx = canvas.getContext("2d");
    const logs = document.getElementById("logs");

    const MODE_DEFS = [
        { name: "frameDelay", selectId: "frameDelayMode", userDiv: "frameDelayUserDiv", userNo: "frameDelayNo", kthDiv: "frameDelayKthDiv", kthNo: "frameDelayKth" },
        { name: "frameLost", selectId: "frameLostMode", userDiv: "frameLostUserDiv", userNo: "frameLostNo", kthDiv: "frameLostKthDiv", kthNo: "frameLostKth" },
        { name: "ackDelay", selectId: "ackDelayMode", userDiv: "ackDelayUserDiv", userNo: "ackDelayNo", kthDiv: "ackDelayKthDiv", kthNo: "ackDelayKth" },
        { name: "ackLost", selectId: "ackLostMode", userDiv: "ackLostUserDiv", userNo: "ackLostNo", kthDiv: "ackLostKthDiv", kthNo: "ackLostKth" }
    ];

    // -----------------------
    // Modal Logic
    // -----------------------
    function openModal(modal) {
        if (modal) modal.classList.add('show');
    }
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('show');
    }

    document.getElementById('learnBtn').addEventListener('click', () => openModal(document.getElementById('learnModal')));
    document.getElementById('developedByBtn').addEventListener('click', () => openModal(document.getElementById('developedByModal')));
    document.getElementById('helpBtn').addEventListener('click', () => openModal(document.getElementById('helpModal')));

    document.querySelectorAll(".modal-close").forEach((closeBtn) => {
        closeBtn.addEventListener("click", (e) => {
            const modalId = e.target.getAttribute("data-close");
            closeModal(modalId);
        });
    });
    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal")) {
            e.target.classList.remove('show');
        }
    });

    // -----------------------
    // Control Panel UI Logic
    // -----------------------
    MODE_DEFS.forEach(def => {
        const sel = document.getElementById(def.selectId);
        if (!sel) return;
        sel.addEventListener("change", () => {
            const userDiv = document.getElementById(def.userDiv);
            const kthDiv = document.getElementById(def.kthDiv);
            if (userDiv) userDiv.classList.add("hidden");
            if (kthDiv) kthDiv.classList.add("hidden");
            if (sel.value === "user" && userDiv) userDiv.classList.remove("hidden");
            if (sel.value === "kth" && kthDiv) kthDiv.classList.remove("hidden");
        });
    });

    // -----------------------
    // Log Function
    // -----------------------
    function addLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logs.insertBefore(logEntry, logs.firstChild);
    }

    // -----------------------
    // Canvas Drawing Helpers
    // -----------------------
    const COLOR_FRAME = "#28a745";
    const COLOR_ACK = "#007bff";
    const COLOR_RETRANSMIT = "#ff6b35";
    const COLOR_LOST_FRAME = "#dc3545";
    const COLOR_LOST_ACK = "#6c757d";
    const COLOR_TEXT = "#495057";
    const COLOR_LINE = "#dee2e6";
    const COLOR_TIMEOUT = "#dc3545";

    function drawArrowHead(x, y, angle, color) {
        const len = 8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * Math.cos(angle - 0.35), y - len * Math.sin(angle - 0.35));
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * Math.cos(angle + 0.35), y - len * Math.sin(angle + 0.35));
        ctx.stroke();
    }

    function drawAxes(senderX, receiverX, height) {
        ctx.font = "14px Segoe UI";
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText("Sender", senderX - 30, 22);
        ctx.fillText("Receiver", receiverX - 20, 22);
        ctx.strokeStyle = COLOR_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(senderX, 30);
        ctx.lineTo(senderX, height - 20);
        ctx.moveTo(receiverX, 30);
        ctx.lineTo(receiverX, height - 20);
        ctx.stroke();
    }

    function drawFrameLine(senderX, receiverX, y, frameNo, color, dashed) {
        ctx.strokeStyle = color;
        ctx.setLineDash(dashed ? [8, 6] : []);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(senderX, y);
        ctx.lineTo(receiverX, y + 20);
        ctx.stroke();
        ctx.setLineDash([]);
        drawArrowHead(receiverX, y + 20, Math.PI / 2, color);
        ctx.fillStyle = color;
        ctx.font = "16px Segoe UI";
        ctx.fillText(`Frame ${frameNo}`, senderX - 90, y + 5);
    }

    function drawAckLine(receiverX, senderX, y, ackNo, color, dashed) {
        ctx.strokeStyle = color;
        ctx.setLineDash(dashed ? [8, 6] : []);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(receiverX, y);
        ctx.lineTo(senderX, y + 20);
        ctx.stroke();
        ctx.setLineDash([]);
        drawArrowHead(senderX, y + 20, -Math.PI / 2, color);
        ctx.fillStyle = color;
        ctx.font = "16px Segoe UI";
        ctx.fillText(`ACK ${ackNo}`, receiverX + 10, y + 5);
    }

    // -----------------------
    // Mode/Trigger Helpers
    // -----------------------
    function readMode(def) {
        const sel = document.getElementById(def.selectId);
        if (!sel) return { type: "none", value: 0 };
        const type = sel.value;
        if (type === "user") {
            const v = parseInt(document.getElementById(def.userNo).value || "0", 10);
            return { type, value: Math.max(1, v) };
        } else if (type === "kth") {
            const v = parseInt(document.getElementById(def.kthNo).value || "2", 10);
            return { type, value: Math.max(2, v) };
        } else return { type, value: 0 };
    }

    function trigger(mode, index, type) {
        if (!mode) return false;
        if (mode.type === "none") return false;
        if (mode.type === "random") return Math.random() < 0.25;

        const key = `${type}-${index}`;
        if (mode.type === "user") {
            if (index === mode.value && !state.usedUserLoss[type].has(key)) {
                state.usedUserLoss[type].add(key);
                return true;
            }
            return false;
        }
        if (mode.type === "kth") {
            if (index > 0 && (index % mode.value === 0) && !state.usedUserLoss[type].has(key)) {
                state.usedUserLoss[type].add(key);
                return true;
            }
            return false;
        }
        return false;
    }

    // ----------------------------------
    // --- SELECTIVE REPEAT LOGIC ---
    // ----------------------------------
    let state = {};

    function resetState() {
        if (state.sentFrames) {
            state.sentFrames.forEach(frame => clearTimeout(frame.timer));
        }
        state = {
            totalFrames: 1,
            winSize: 1,
            frameDelayMode: readMode(MODE_DEFS[0]),
            frameLostMode: readMode(MODE_DEFS[1]),
            ackDelayMode: readMode(MODE_DEFS[2]),
            ackLostMode: readMode(MODE_DEFS[3]),
            y: 50,
            eventGap: 30,
            rowHeight: 90,
            senderX: 200,
            receiverX: canvas.width - 200,
            windowBase: 1,
            nextSeqNum: 1,
            sentFrames: new Map(), // Stores { y, timer }
            acknowledgedFrames: new Set(),
            receiverBase: 1,
            receiverBuffer: new Set(),
            usedUserLoss: { frame: new Set(), ack: new Set() },
            running: false
        };
    }

    function simulate() {
        if (state.running) return;

        resetState();
        state.running = true;
        state.totalFrames = Math.max(1, parseInt(numFramesEl.value || "8", 10));
        state.winSize = Math.max(1, parseInt(winSizeEl.value || "4", 10));

        const neededHeight = state.y + state.totalFrames * state.rowHeight * 1.5;
        canvas.height = Math.max(700, neededHeight);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAxes(state.senderX, state.receiverX, canvas.height);

        addLog('--- Simulation Start ---', 'success');
        addLog(`Frames: ${state.totalFrames}, Window: ${state.winSize}`, 'info');
        sendWindowFrames();
    }

    function sendWindowFrames() {
        while (state.nextSeqNum < state.windowBase + state.winSize && state.nextSeqNum <= state.totalFrames) {
            if (!state.running) return;
            const frameNo = state.nextSeqNum;
            if (!state.sentFrames.has(frameNo)) {
                // Stagger sending slightly
                (function (fn) {
                    const delay = (fn - state.nextSeqNum) * 300;
                    setTimeout(() => sendFrame(fn, false), delay);
                })(frameNo);
            }
            state.nextSeqNum++;
        }
    }

    function sendFrame(frameNo, isRetransmission) {
        if (!state.running) return;

        // Avoid re-sending if it's already acknowledged
        if (state.acknowledgedFrames.has(frameNo)) return;

        const currentY = state.y;
        state.y += state.eventGap;

        const frameLost = trigger(state.frameLostMode, frameNo, "frame");
        const frameDelay = trigger(state.frameDelayMode, frameNo, "frame");
        const frameDelayTime = frameDelay ? 1000 : 300;

        const color = frameLost ? COLOR_LOST_FRAME : isRetransmission ? COLOR_RETRANSMIT : COLOR_FRAME;
        const dashed = frameLost || isRetransmission;

        addLog(`▶️ Sending Frame ${frameNo} (re-tx: ${isRetransmission})`, 'info');
        drawFrameLine(state.senderX, state.receiverX, currentY, frameNo, color, dashed);

        setRetransmitTimeout(frameNo, currentY);

        if (frameLost) {
            addLog(`❌ Frame ${frameNo} lost!`, 'error');
            return;
        }

        setTimeout(() => {
            receiveFrame(frameNo, currentY);
        }, frameDelayTime);
    }

    function receiveFrame(frameNo, frameY) {
        if (!state.running) return;

        // Check if frame is outside the acceptable receiver window
        if (frameNo < state.receiverBase || frameNo >= state.receiverBase + state.winSize) {
            addLog(`📬 Receiver: Discarded Frame ${frameNo} (out of window ${state.receiverBase}-${state.receiverBase + state.winSize - 1})`, 'warning');
            // Per SR, ACK even if out-of-window-low to help sender slide
            if (frameNo < state.receiverBase) {
                sendAck(frameNo, frameY + 40);
            }
            return;
        }

        addLog(`📩 Receiver: Got Frame ${frameNo}`, 'success');
        state.receiverBuffer.add(frameNo);

        const ackY = frameY + 40;
        state.y = Math.max(state.y, ackY);
        sendAck(frameNo, ackY);

        // Deliver buffered frames in sequence
        while (state.receiverBuffer.has(state.receiverBase)) {
            addLog(`... Receiver: Delivering Frame ${state.receiverBase} from buffer`, 'info');
            state.receiverBuffer.delete(state.receiverBase);
            state.receiverBase++;
        }
    }

    function sendAck(frameNo, ackY) {
        if (!state.running) return;

        const ackLost = trigger(state.ackLostMode, frameNo, "ack");
        const ackDelay = trigger(state.ackDelayMode, frameNo, "ack");
        const ackDelayTime = ackDelay ? 1000 : 400;

        const color = ackLost ? COLOR_LOST_ACK : COLOR_ACK;

        addLog(`◀️ Receiver: Sending ACK ${frameNo}`, 'info');
        drawAckLine(state.receiverX, state.senderX, ackY, frameNo, color, ackLost);

        if (ackLost) {
            addLog(`❌ ACK ${frameNo} lost!`, 'error');
            return;
        }

        setTimeout(() => {
            receiveAck(frameNo);
        }, ackDelayTime);
    }

    function receiveAck(frameNo) {
        if (!state.running) return;
        if (state.acknowledgedFrames.has(frameNo)) return; // Already seen
        if (frameNo < state.windowBase) return; // Stale ACK

        addLog(`✅ Sender: Got ACK ${frameNo}`, 'success');
        state.acknowledgedFrames.add(frameNo);

        const frameData = state.sentFrames.get(frameNo);
        if (frameData) {
            clearTimeout(frameData.timer);
            state.sentFrames.delete(frameNo);
        }

        // If this is the base of the window, slide it
        if (frameNo === state.windowBase) {
            addLog(`🎉 Sender: ACK ${frameNo} slides window base!`, 'info');
            while (state.acknowledgedFrames.has(state.windowBase)) {
                state.windowBase++;
            }
            addLog(`... New window base: ${state.windowBase}`, 'info');
            sendWindowFrames();
        }

        if (state.windowBase > state.totalFrames) {
            addLog("--- ✅ Simulation Complete ---", 'success');
            state.running = false;
        }
    }

    function setRetransmitTimeout(frameNo, frameY) {
        const existing = state.sentFrames.get(frameNo);
        if (existing) {
            clearTimeout(existing.timer);
        }
        const timeoutDuration = 5000;
        const timer = setTimeout(() => {
            retransmitFrame(frameNo);
        }, timeoutDuration);
        state.sentFrames.set(frameNo, { y: frameY, timer: timer });
    }

    function retransmitFrame(frameNo) {
        if (!state.running) return;
        if (state.acknowledgedFrames.has(frameNo)) return;

        addLog(`⏰ TIMEOUT for Frame ${frameNo}. Retransmitting...`, 'warning');
        state.y += state.rowHeight;

        ctx.fillStyle = COLOR_TIMEOUT;
        ctx.font = "14px Segoe UI";
        ctx.fillText(`Timeout (F${frameNo})`, state.senderX - 90, state.y - 10);

        sendFrame(frameNo, true);
    }

    // -----------------------
    // Main Buttons
    // -----------------------
    simulateBtn.addEventListener("click", simulate);

    clearBtn.addEventListener("click", () => {
        resetState();
        state.running = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        logs.innerHTML = "";
        canvas.height = 700;
        drawAxes(state.senderX, state.receiverX, canvas.height);
        addLog('Simulation reset', 'info');
    });

    // -----------------------------------------------------------------
    // --- BASIC DOWNLOAD LOGIC (REVERTED & SIMPLIFIED) ---
    // -----------------------------------------------------------------
    document.getElementById("downloadBtn").addEventListener("click", function () {
        try {
            // Check if jspdf objects are loaded
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
                alert('Error: PDF generation library not loaded. Please check your internet connection.');
                return;
            }

            // Use the correct constructor from the UMD module
            const doc = new window.jspdf.jsPDF();

            // --- 1. Heading ---
            doc.setFontSize(18);
            doc.text("Selective Repeat ARQ Simulation Report", 14, 20);

            // --- 2. User Inputs ---
            doc.setFontSize(12);
            doc.text("User Inputs:", 14, 30);

            const inputs = [
                ["Number of Frames (N):", document.getElementById("numFrames").value],
                ["Window Size (W):", document.getElementById("winSize").value],
                ["Frame Delay Mode:", document.getElementById("frameDelayMode").value],
                ["Frame Lost Mode:", document.getElementById("frameLostMode").value],
                ["ACK Delay Mode:", document.getElementById("ackDelayMode").value],
                ["ACK Lost Mode:", document.getElementById("ackLostMode").value]
            ];

            let y = 36;
            inputs.forEach(row => {
                doc.text(`${row[0]} ${row[1]}`, 14, y);
                y += 7; // Increased spacing
            });

            // --- 3. Timeline Diagram ---
            const canvas = document.getElementById("timelineCanvas");
            if (canvas) {
                const imgData = canvas.toDataURL("image/png");
                const imgWidth = 180;
                const imgHeight = (canvas.height / canvas.width) * imgWidth;
                y += 6;

                // Check if image fits, if not, add new page
                if (y + imgHeight > 280) {
                    doc.addPage();
                    y = 10; // Reset y
                }

                doc.addImage(imgData, "PNG", 14, y, imgWidth, imgHeight);
                y += imgHeight + 10;
            }

            // --- 4. Transmission Log ---
            doc.addPage(); // Put logs on a new page for simplicity
            doc.setFontSize(18);
            doc.text("Transmission Log", 14, 20);

            const logEntries = [];
            const logNodes = logs.querySelectorAll('.log-entry');
            // Iterate in reverse to get chronological order
            for (let i = logNodes.length - 1; i >= 0; i--) {
                logEntries.push(logNodes[i].textContent);
            }

            doc.setFontSize(10);
            doc.setFont('courier'); // Use a monospaced font for logs

            // Split text to fit width and auto-paginate
            const splitLogs = doc.splitTextToSize(logEntries.join('\n'), 180); // 180mm width
            doc.text(splitLogs, 14, 30);


            doc.save("SelectiveRepeatReport.pdf");
        } catch (e) {
            console.error("Error during PDF generation:", e);
            alert("An error occurred while generating the PDF. See console for details.");
        }
    });


    // --- Initial Draw ---
    if (!ctx) {
        simulateBtn.disabled = true;
        clearBtn.disabled = true;
        alert("Your browser does not support canvas 2D context.");
    } else {
        drawAxes(state.senderX, state.receiverX, canvas.height);
        addLog('Ready to start simulation', 'info');
    }
});