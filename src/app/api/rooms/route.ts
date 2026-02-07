import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Create a new room
export async function POST() {
    const roomId = uuidv4();

    return NextResponse.json({
        roomId,
        url: `/room/${roomId}`,
    });
}

// Get room info (for validation)
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('id');

    if (!roomId) {
        return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
    }

    // In a production app, you'd validate the room exists in a database
    // For now, we just confirm the format is valid
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(roomId)) {
        return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    return NextResponse.json({
        roomId,
        exists: true,
    });
}
