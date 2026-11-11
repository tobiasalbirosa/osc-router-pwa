const LABELS = {
  "/aX": "Accel X",
  "/aY": "Accel Y",
  "/aZ": "Accel Z",
  "/gX": "Giro X",
  "/gY": "Giro Y",
  "/gZ": "Giro Z",
};

const ORDER = ["/aX", "/aY", "/aZ", "/gX", "/gY", "/gZ"];

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function setWsUi(ok, text) {
  const dot = document.getElementById("wsDot");
  const label = document.getElementById("wsText");
  dot.classList.remove("on", "err");
  if (ok) dot.classList.add("on");
  else dot.classList.add("err");
  label.textContent = `WebSocket: ${text}`;
}

function setTargetPill(host, port) {
  const el = document.getElementById("targetPill");
  if (host == null || port == null) {
    el.textContent = "OSC: —";
    return;
  }
  el.textContent = `OSC → ${host}:${port}`;
}

const rowEls = {};

function ensureRows() {
  const root = document.getElementById("rows");
  if (root.querySelector(".row-sensor")) return;
  root.textContent = "";
  for (const addr of ORDER) {
    const wrap = document.createElement("div");
    wrap.className = "row-sensor";
    const lab = document.createElement("label");
    lab.textContent = `${addr} · ${LABELS[addr] || addr}`;
    const barWrap = document.createElement("div");
    barWrap.className = "bar";
    const barIn = document.createElement("i");
    barWrap.appendChild(barIn);
    const num = document.createElement("div");
    num.className = "num";
    num.textContent = "—";
    wrap.appendChild(lab);
    wrap.appendChild(barWrap);
    wrap.appendChild(num);
    root.appendChild(wrap);
    rowEls[addr] = { barIn, num };
  }
}

function applyValue(addr, value) {
  ensureRows();
  const row = rowEls[addr];
  if (!row) return;
  const v = Number(value);
  if (!Number.isFinite(v)) {
    row.num.textContent = "—";
    row.barIn.style.width = "0%";
    return;
  }
  const pct = `${Math.min(100, Math.max(0, v * 100))}%`;
  row.barIn.style.width = pct;
  row.num.textContent = v.toFixed(6);
}

function applySnapshot(sensors) {
  ensureRows();
  if (!sensors || typeof sensors !== "object") return;
  for (const addr of ORDER) {
    if (Object.prototype.hasOwnProperty.call(sensors, addr)) {
      applyValue(addr, sensors[addr]);
    }
  }
}

function connect() {
  ensureRows();
  const socket = new WebSocket(wsUrl());

  socket.onopen = () => {
    setWsUi(true, "conectado");
    socket.send(JSON.stringify({ type: "hello", role: "viewer" }));
  };

  socket.onclose = () => {
    setWsUi(false, "desconectado — reintentando…");
    setTimeout(connect, 1500);
  };

  socket.onerror = () => {
    setWsUi(false, "error");
  };

  socket.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (msg.type === "snapshot") {
      if (msg.target) setTargetPill(msg.target.host, msg.target.port);
      applySnapshot(msg.sensors);
      return;
    }

    if (msg.type === "config" && msg.target) {
      setTargetPill(msg.target.host, msg.target.port);
      return;
    }

    if (msg.type === "sensor" && msg.address) {
      applyValue(msg.address, msg.value);
    }
  };
}

connect();
