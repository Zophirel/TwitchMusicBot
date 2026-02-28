export type ParseResult =
  | { type: "ignore" }
  | { type: "invalid"; reason: string }
  | { type: "ok"; query: string };

const COMMAND = "!songsplay";
const MAX_LENGTH = 80;

export function parseSongsPlay(message: string): ParseResult {
  const trimmed = message.trim();
  if (!trimmed.toLowerCase().startsWith(COMMAND)) {
    return { type: "ignore" };
  }

  const after = trimmed.slice(COMMAND.length);
  if (after.length > 0 && !after.startsWith(" ")) {
    return { type: "ignore" };
  }

  const query = after.trim();
  if (!query) {
    return { type: "invalid", reason: "Please provide a song name." };
  }
  if (query.length > MAX_LENGTH) {
    return { type: "invalid", reason: `Song name too long (max ${MAX_LENGTH}).` };
  }

  return { type: "ok", query };
}
