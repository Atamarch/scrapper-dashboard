import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { templateId } = await request.json();

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Note: This is a placeholder for the actual crawler start logic
    // In a real implementation, you would:
    // 1. Call your backend API (Railway/VPS) to start the crawler
    // 2. Pass the templateId to the crawler
    // 3. Return the status

    // For now, we'll return a success response
    // In production, you'd make an HTTP request to your crawler backend:
    /*
    const response = await fetch(`${process.env.CRAWLER_BACKEND_URL}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to start crawler');
    }
    */

    return NextResponse.json({
      success: true,
      message: 'Crawler start request sent',
      templateId
    });

  } catch (error) {
    console.error('Error starting crawler:', error);
    return NextResponse.json(
      { error: 'Failed to start crawler' },
      { status: 500 }
    );
  }
}