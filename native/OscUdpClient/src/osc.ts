import { Buffer } from 'buffer';

function padOscString(s: string): Buffer {
  const enc = Buffer.from(`${s}\0`, 'utf8');
  const pad = (4 - (enc.length % 4)) % 4;
  return Buffer.concat([enc, Buffer.alloc(pad)]);
}

/** Un mensaje OSC: dirección + float32 (valor físico; sin recortar a 0–1). */
export function encodeOscFloat(address: string, value: number): Buffer {
  const v = Number.isFinite(value) ? value : 0;
  const addr = padOscString(address);
  const tags = padOscString(',f');
  const f = Buffer.allocUnsafe(4);
  f.writeFloatBE(v, 0);
  return Buffer.concat([addr, tags, f]);
}
