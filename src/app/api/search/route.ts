import { NextResponse } from 'next/server';
import YouTube from 'youtube-sr';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    try {
        console.log(`Searching YouTube for: ${query}`);

        // Search for videos using youtube-sr
        const results = await YouTube.search(query, {
            limit: 10,
            type: 'video',
            safeSearch: false
        });

        // Transform to our format
        const videos = results.map((video) => ({
            videoId: video.id,
            title: video.title,
            author: video.channel?.name || 'Unknown Channel',
            duration: video.durationFormatted || '0:00',
            thumbnail: video.thumbnail?.url || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`,
            viewCount: video.views ? `${formatViewCount(video.views)} views` : '0 views',
        }));

        return NextResponse.json({ videos, source: 'youtube-sr' });
    } catch (error) {
        console.error('YouTube search failed:', error);
        return NextResponse.json({
            videos: [],
            error: 'Search failed. Please try again or paste a YouTube URL directly.',
        });
    }
}

function formatViewCount(count: number): string {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
}
