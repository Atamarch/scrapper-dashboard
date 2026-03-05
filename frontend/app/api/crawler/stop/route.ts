import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Note: This is a placeholder for the actual crawler stop logic
    // In a real implementation, you would:
    // 1. Call your backend API (Railway/VPS) to stop the crawler
    // 2. Return the status

    // For now, we'll return a success response
    // In production, you'd make an HTTP request to your crawler backend:
    /*
    const response = await fetch(`${process.env.CRAWLER_BACKEND_URL}/stop`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to stop crawler');
    }
    */

    return NextResponse.json({
      success: true,
      message: 'Crawler stop request sent'
    });

  } catch (error) {
    console.error('Error stopping crawler:', error);
    return NextResponse.json(
      { error: 'Failed to stop crawler' },
      { status: 500 }
    );
  }
}