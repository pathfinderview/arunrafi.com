// registry of a representative object per species, rendered into field-guide silhouettes
export const THUMBS = new Map();
export const registerThumb = (key, obj) => { if (!THUMBS.has(key)) THUMBS.set(key, obj); };
