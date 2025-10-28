/**
 * Downloads an image from a URL and returns its SHA-256 hash
 */
export async function hashImageFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const imageData = await response.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", imageData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
      "",
    );

    return hashHex;
  } catch (error) {
    console.error(`Failed to hash image from ${url}:`, error);
    throw error;
  }
}

/**
 * Hash multiple image URLs and return a combined hash
 */
export async function hashImagesFromUrls(urls: string[]): Promise<string> {
  if (urls.length === 0) {
    return "";
  }

  if (urls.length === 1) {
    return await hashImageFromUrl(urls[0]);
  }

  // For multiple images, hash each and then hash the concatenated hashes
  const hashes = await Promise.all(urls.map((url) => hashImageFromUrl(url)));
  const combinedHash = hashes.join("");
  const data = new TextEncoder().encode(combinedHash);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);

  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }
  return result;
}
