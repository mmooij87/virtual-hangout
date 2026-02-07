import { NextResponse } from 'next/server';

// YouTube search using Invidious API (no API key required)
// Invidious is an open-source YouTube frontend with a public API
const INVIDIOUS_INSTANCES = [
    'https://inv.tux.pizza',
    'https://invidious.projectsegfau.lt',
    'https://invidious.no-logs.com',
    'https://invidious.io.lol',
    'https://vid.puffyan.us',
    'https://invidious.snopyta.org',
    'https://yewtu.be',
];

interface InvidiousVideo {
    videoId: string;
    title: string;
    author: string;
    lengthSeconds: number;
    videoThumbnails: Array<{ url: string; quality: string }>;
    viewCount: number;
}

async function searchWithInstance(query: string, instance: string): Promise<InvidiousVideo[]> {
    const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
    const response = await fetch(url, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
        throw new Error(`Instance ${instance} failed`);
    }

    return response.json();
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    // Try each Invidious instance until one works
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const results = await searchWithInstance(query, instance);

            // Transform to our format
            const videos = results.slice(0, 10).map((video) => ({
                videoId: video.videoId,
                title: video.title,
                author: video.author,
                duration: formatDuration(video.lengthSeconds),
                thumbnail: `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`,
                viewCount: formatViewCount(video.viewCount),
            }));

            return NextResponse.json({ videos, instance });
        } catch (error) {
            console.log(`Instance ${instance} failed:`, error instanceof Error ? error.message : String(error));
            continue;
        }
    }

    // All instances failed, return empty or error
    return NextResponse.json({
        videos: [],
        error: 'Search temporarily unavailable. Please paste a YouTube URL directly.',
    });
}

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViewCount(count: number): string {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M views`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K views`;
    }
    return `${count} views`;
}
