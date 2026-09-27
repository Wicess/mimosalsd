/**
 * Twitter/X card.
 *
 * `summary_large_image` wants the same 1200×630 the Open Graph card uses, so this
 * is the same image rather than a second design to keep in sync. Next requires the
 * separate file convention; re-exporting is what stops the two drifting apart.
 */
export { alt, size, contentType, default } from './opengraph-image'
