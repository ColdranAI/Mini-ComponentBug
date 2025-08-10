import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

const octo = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(req: NextRequest) {
  try {
    // Parse the request body to get test data
    const testData = await req.json().catch(() => ({}));
    
    // Test the GitHub API connection
    const testIssue = {
      title: testData.text ? `Test Issue - ${testData.text.slice(0, 50)}` : "Test Issue - API Connection",
      body: `## Test Issue
      
This is a test issue to verify the API connection is working.

**Environment:**
- Time: ${new Date().toLocaleString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })}
- Browser: Test Environment
- Page URL: Test Page

**Test Data from Dialog:**
- Description: ${testData.text || "No description provided"}
- Has Video: ${testData.hasVideo ? "Yes" : "No"}
${testData.hasVideo ? `- Video Name: ${testData.videoName}
- Video Size: ${Math.round(testData.videoSize / 1024)}KB` : ""}

**Note:** This is just a test - video files are not actually uploaded in test mode. Real recordings will include:
- Video file (inline or S3 URL)
- Actual browser environment data
- Real console logs
- Actual captured elements

This issue was created via API test dialog.`,
    };

    const resp = await octo.request("POST /repos/{owner}/{repo}/issues", {
      owner: process.env.GH_OWNER!,
      repo: process.env.GH_REPO!,
      title: testIssue.title,
      body: testIssue.body,
    });

    return NextResponse.json({
      success: true,
      issueUrl: resp.data.html_url,
      issueNumber: resp.data.number,
      message: "Test issue created successfully",
    });
  } catch (error: any) {
    console.error("Test create-issue error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        details: error.response?.data || error,
      },
      { status: 500 }
    );
  }
}
