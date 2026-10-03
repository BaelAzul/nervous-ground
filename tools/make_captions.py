#!/usr/bin/env python3
"""Make a captions file (.vtt) for a meditation from the recording and its script.

    python3 tools/make_captions.py audio/body-scan.mp3 script.txt audio/body-scan.vtt

The script has one phrase per line, in the order spoken (blank lines are ignored).
It finds the pauses in the recording with ffmpeg, then lines each phrase up with the
speech around it, giving longer phrases more time. Phrases snap to real pauses where
they're close. The result is a plain text file that can be fine-tuned by hand.
"""
import re
import subprocess
import sys


def speech_segments(audio, noise_db=-38, min_pause=0.45):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", audio, "-af",
         f"silencedetect=noise={noise_db}dB:d={min_pause}", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    total = int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3])
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    silences = list(zip(starts, ends + [total] * (len(starts) - len(ends))))
    speech, t = [], 0.0
    for s, e in silences:
        if s - t > 0.15:
            speech.append((t, s))
        t = e
    if total - t > 0.15:
        speech.append((t, total))
    return speech, silences


def align(phrases, speech, silences):
    talk = sum(e - s for s, e in speech)
    weights = [len(p) + 8 for p in phrases]  # a little time per phrase, plus its length
    whole = sum(weights)

    def at(talk_time):
        # speaking time -> real time in the recording
        acc = 0.0
        for s, e in speech:
            if acc + (e - s) >= talk_time:
                return s + (talk_time - acc)
            acc += e - s
        return speech[-1][1]

    cues, acc = [], 0.0
    for p, wgt in zip(phrases, weights):
        a, acc = acc, acc + wgt / whole * talk
        cues.append([at(a), at(acc), p])

    # Each boundary between two phrases moves to the nearest real pause (in order, never reused),
    # so a phrase ends when the voice stops and the next begins when it starts again.
    gaps = [(s, e) for s, e in silences if s > speech[0][0] and e < speech[-1][1]]
    used = -1
    for i in range(len(cues) - 1):
        b = cues[i][1]
        best = None
        for j in range(used + 1, len(gaps)):
            mid = (gaps[j][0] + gaps[j][1]) / 2
            if best is None or abs(mid - b) < abs(best[1] - b):
                best = (j, mid)
        if best and abs(best[1] - b) < 4:
            used = best[0]
            cues[i][1], cues[i + 1][0] = gaps[used]
    cues[0][0] = max(cues[0][0], speech[0][0])
    cues[-1][1] = min(cues[-1][1], speech[-1][1])
    return cues


def ts(x):
    h, x = divmod(x, 3600)
    m, s = divmod(x, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def main():
    audio, script, out = sys.argv[1:4]
    phrases = [l.strip() for l in open(script, encoding="utf-8") if l.strip()]
    speech, silences = speech_segments(audio)
    cues = align(phrases, speech, silences)
    with open(out, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for i, (a, b, p) in enumerate(cues, 1):
            f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{p}\n\n")
    print(f"{len(cues)} phrases, {len(speech)} stretches of speech -> {out}")


if __name__ == "__main__":
    main()
