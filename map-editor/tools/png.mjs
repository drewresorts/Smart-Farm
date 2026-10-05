// Minimal PNG reader/writer for 8-bit RGBA, non-interlaced images (no dependencies).
import { inflateSync, deflateSync } from "node:zlib";
import { crc32 } from "../src/zip.js";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** @returns {{width:number, height:number, data:Uint8Array}} RGBA pixels */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG file");
  let pos = 8;
  let width = 0, height = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || colour !== 6 || interlace !== 0) {
        throw new Error("Only 8-bit RGBA, non-interlaced PNGs are supported");
      }
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = data.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? out[i - 4] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= 4 ? prev[i - 4] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = v & 255;
    }
  }
  return { width, height, data };
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
}

export function encodePng({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

export function blank(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Copies a rectangle of `src` onto `dst` at (dx, dy), skipping fully transparent pixels. */
export function blit(dst, src, dx, dy, sx = 0, sy = 0, w = src.width, h = src.height) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((sy + y) * src.width + sx + x) * 4;
      if (!src.data[si + 3]) continue;
      const tx = dx + x, ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
      dst.data.set(src.data.subarray(si, si + 4), (ty * dst.width + tx) * 4);
    }
  }
}

/** Halves an image: each 2x2 block becomes one pixel, preferring dark outline colours. */
export function halve(img) {
  const out = blank(Math.floor(img.width / 2), Math.floor(img.height / 2));
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const counts = new Map();
      let opaque = 0;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = ((y * 2 + oy) * img.width + x * 2 + ox) * 4;
        if (img.data[i + 3] < 128) continue;
        opaque++;
        const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
        const luma = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
        counts.set(key, (counts.get(key) || 0) + (luma < 70 ? 1.6 : 1));
      }
      if (opaque < 2) continue;
      let best = 0, bw = -1;
      for (const [k, w] of counts) if (w > bw) { best = k; bw = w; }
      out.data.set([best >> 16, (best >> 8) & 255, best & 255, 255], (y * out.width + x) * 4);
    }
  }
  return out;
}

export function crop(img, x, y, w, h) {
  const out = blank(w, h);
  blit(out, img, 0, 0, x, y, w, h);
  return out;
}
