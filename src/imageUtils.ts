export function normalizePublicImageUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value.replace(/&amp;/g, "&"), baseUrl);
    if (url.protocol !== "https:") {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

