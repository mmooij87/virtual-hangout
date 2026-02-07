// YouTube URL parsing utilities

export interface YouTubeVideoInfo {
    videoId: string;
    title: string;
    thumbnail: string;
}

/**
 * Extract YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
    if (!url) return null;

    // Handle direct video ID (11 characters)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }

    try {
        const urlObj = new URL(url);

        // youtube.com/watch?v=VIDEO_ID
        if (urlObj.hostname.includes('youtube.com')) {
            const videoId = urlObj.searchParams.get('v');
            if (videoId) return videoId;

            // youtube.com/embed/VIDEO_ID or youtube.com/v/VIDEO_ID
            const pathMatch = urlObj.pathname.match(/\/(embed|v)\/([a-zA-Z0-9_-]{11})/);
            if (pathMatch) return pathMatch[2];
        }

        // youtu.be/VIDEO_ID
        if (urlObj.hostname === 'youtu.be') {
            const videoId = urlObj.pathname.slice(1).split('/')[0];
            if (videoId && videoId.length === 11) return videoId;
        }
    } catch {
        // Not a valid URL
        return null;
    }

    return null;
}

/**
 * Validate if a string is a valid YouTube video ID or URL
 */
export function isValidYouTubeUrl(url: string): boolean {
    return extractVideoId(url) !== null;
}

/**
 * Get thumbnail URL for a YouTube video
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'max' = 'medium'): string {
    const qualityMap = {
        default: 'default',
        medium: 'mqdefault',
        high: 'hqdefault',
        max: 'maxresdefault',
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Get video info from YouTube oEmbed API
 * Note: This doesn't require an API key
 */
export async function getVideoInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
    try {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(url);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return {
            videoId,
            title: data.title || 'Unknown Title',
            thumbnail: getThumbnailUrl(videoId, 'medium'),
        };
    } catch {
        // Return basic info if oEmbed fails
        return {
            videoId,
            title: 'YouTube Video',
            thumbnail: getThumbnailUrl(videoId, 'medium'),
        };
    }
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * YouTube Player States
 */
export const YT_PLAYER_STATE = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
} as const;

/**
 * YouTube Error Codes
 */
export const YT_ERROR_CODES = {
    INVALID_PARAM: 2,
    HTML5_ERROR: 5,
    NOT_FOUND: 100,
    NOT_EMBEDDABLE: 101,
    NOT_EMBEDDABLE_2: 150,
} as const;

/**
 * Get user-friendly error message for YouTube errors
 */
export function getYouTubeErrorMessage(errorCode: number): string {
    switch (errorCode) {
        case YT_ERROR_CODES.NOT_FOUND:
            return 'Video not found. It may have been deleted.';
        case YT_ERROR_CODES.NOT_EMBEDDABLE:
        case YT_ERROR_CODES.NOT_EMBEDDABLE_2:
            return 'This video cannot be embedded. The owner has disabled embedding.';
        case YT_ERROR_CODES.INVALID_PARAM:
            return 'Invalid video URL.';
        case YT_ERROR_CODES.HTML5_ERROR:
            return 'HTML5 player error. Please try again.';
        default:
            return 'An error occurred while playing the video.';
    }
}
