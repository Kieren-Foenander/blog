const WORDS_PER_MINUTE = 200;

/**
 * Compute estimated read time in minutes from markdown/MDX body content.
 * Strips code blocks to avoid inflating the count from code snippets.
 */
export function getReadTimeMinutes(body: string): number {
	const withoutCodeBlocks = body.replace(/```[\s\S]*?```/g, '');
	const words = withoutCodeBlocks.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
