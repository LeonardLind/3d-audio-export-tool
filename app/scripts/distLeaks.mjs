const forbiddenText = /__OWNER_PREVIEW__|UNVERIFIED|Owner preview|uncertified/i;
const forbiddenChunk = /(?:^|[\\/])(?:OwnerPanel[^\\/]*|dev[\\/])/i;

/** Return paths with owner-only text or chunk names. `files` is a path-to-content map. */
export function findLeaks(files) {
  return Object.entries(files)
    .filter(([path, content]) => forbiddenChunk.test(path) || forbiddenText.test(String(content)))
    .map(([path]) => path);
}
