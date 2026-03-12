import type {
  GroupedTranscriptWords,
  SubtitleDensity,
  TranscriptWord,
  TranscriptWordTrack
} from "@/lib/types";

const GAP_BREAK_MS = 900;
const NO_SPACE_PREFIXES = [".", ",", "!", "?", ":", ";", "%", ")", "]", "}"];
const NO_SPACE_SUFFIXES = ["(", "[", "{", "$", "#", "\""];

function getTrackText(word: TranscriptWord, track: TranscriptWordTrack): string {
  if (track === "translation" && word.translatedText.trim()) {
    return word.translatedText;
  }

  return word.originalText;
}

function getMaxWords(density: SubtitleDensity): number {
  if (density === "compact") {
    return 3;
  }

  if (density === "balanced") {
    return 6;
  }

  return Number.POSITIVE_INFINITY;
}

function shouldBreakOnPunctuation(word: TranscriptWord): boolean {
  const text = word.originalText.trim();

  if (!text) {
    return false;
  }

  return /[.!?]$/.test(text);
}

function shouldInsertSpace(text: string, token: string): boolean {
  if (!text) {
    return false;
  }

  return !NO_SPACE_PREFIXES.some((prefix) => token.startsWith(prefix))
    && !NO_SPACE_SUFFIXES.some((suffix) => text.endsWith(suffix));
}

export function joinTranscriptTokens(tokens: string[]): string {
  let text = "";

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    text += shouldInsertSpace(text, token) ? ` ${token}` : token;
  }

  return text;
}

export function groupTranscriptWords(
  words: TranscriptWord[],
  density: SubtitleDensity,
  track: TranscriptWordTrack
): GroupedTranscriptWords[] {
  if (!words.length) {
    return [];
  }

  const groups: GroupedTranscriptWords[] = [];
  const maxWords = getMaxWords(density);
  let current: TranscriptWord[] = [];

  function flush() {
    if (!current.length) {
      return;
    }

    groups.push({
        id: `${current[0]?.position ?? 0}-${current[current.length - 1]?.position ?? 0}`,
      text: joinTranscriptTokens(current.map((word) => getTrackText(word, track))),
      startMs: current[0]?.startMs ?? 0,
      endMs: current[current.length - 1]?.endMs ?? 0,
      words: [...current]
    });
    current = [];
  }

  for (const word of words) {
    const previous = current[current.length - 1];
    const gapMs = previous ? word.startMs - previous.endMs : 0;

    if (current.length && gapMs >= GAP_BREAK_MS) {
      flush();
    }

    current.push(word);

    if (current.length >= maxWords || shouldBreakOnPunctuation(word)) {
      flush();
    }
  }

  flush();
  return groups;
}

export function buildRenderCues(
  words: TranscriptWord[],
  density: SubtitleDensity
): Array<{
  id: string;
  startMs: number;
  endMs: number;
  originalText: string;
  translatedText: string;
  words: TranscriptWord[];
}> {
  const originalGroups = groupTranscriptWords(words, density, "original");
  const translationGroups = groupTranscriptWords(words, density, "translation");

  return originalGroups.map((group, index) => ({
    id: group.id,
    startMs: group.startMs,
    endMs: group.endMs,
    originalText: group.text,
    translatedText: translationGroups[index]?.text ?? "",
    words: group.words
  }));
}
