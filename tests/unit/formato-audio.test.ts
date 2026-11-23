import { describe, expect, it } from "vitest";
import { formatoAudio } from "@/lib/formato-audio";

const bytes = (...b: (number | string)[]) =>
  new Uint8Array(b.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("formatoAudio", () => {
  it.each([
    ["MP3 con ID3", bytes("ID3", 4, 0, 0, 0), "audio/mpeg"],
    ["MP3 sin ID3", bytes(0xff, 0xfb, 0x90, 0x64), "audio/mpeg"],
    ["Ogg", bytes("OggS", 0, 2), "audio/ogg"],
    ["WAV", bytes("RIFF", 0, 0, 0, 0, "WAVE"), "audio/wav"],
  ])("%s", (_, b, tipo) => {
    expect(formatoAudio(b)).toBe(tipo);
  });

  it.each([
    ["HTML", bytes("<!DOCTYPE html>")],
    ["JSON", bytes('{"error": 1}')],
    ["vacío", bytes()],
  ])("rechaza %s", (_, b) => {
    expect(formatoAudio(b)).toBeNull();
  });
});
