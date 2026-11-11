export function wsUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

export function loadOscTarget() {
  try {
    const h = localStorage.getItem("oscHost");
    const p = localStorage.getItem("oscPort");
    return {
      host: h || "",
      port: p ? Number(p) : 8000,
    };
  } catch {
    return { host: "", port: 8000 };
  }
}

export function saveOscTarget(host, port) {
  try {
    localStorage.setItem("oscHost", host);
    localStorage.setItem("oscPort", String(port));
  } catch {
    /* ignore */
  }
}

export function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export class OscBridge {
  /**
   * @param {() => { host: string; port: number }} getTarget
   */
  constructor(getTarget) {
    this.getTarget = getTarget;
    this.socket = null;
    this.open = false;
    this.queue = [];
  }

  connect(onStatus) {
    const s = new WebSocket(wsUrl());
    this.socket = s;

    s.onopen = () => {
      this.open = true;
      onStatus?.(true, "conectado");
      while (this.queue.length) {
        const line = this.queue.shift();
        s.send(line);
      }
      this.sendConfig();
    };

    s.onclose = () => {
      this.open = false;
      onStatus?.(false, "desconectado");
      setTimeout(() => this.connect(onStatus), 1500);
    };

    s.onerror = () => {
      onStatus?.(this.open, "error");
    };
  }

  /** @param {{ host?: string; port?: number }} [override] Si se omite, usa getTarget(). */
  sendConfig(override) {
    const src = override || this.getTarget();
    const h = src.host;
    const po = src.port;
    const host = (h && String(h).trim()) || "127.0.0.1";
    const port = Number.isFinite(Number(po)) ? Number(po) : 8000;
    saveOscTarget(host, port);
    this.sendJSON({
      type: "config",
      target: { host, port },
    });
  }

  sendJSON(obj) {
    const raw = JSON.stringify(obj);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(raw);
    else this.queue.push(raw);
  }

  sendFloat(address, value) {
    this.sendJSON({
      type: "osc",
      address,
      value: clamp01(value),
    });
  }
}
