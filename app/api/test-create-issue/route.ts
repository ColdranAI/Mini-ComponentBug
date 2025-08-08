import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

const octo = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(req: NextRequest) {
  try {
    // Test the GitHub API connection
    const testIssue = {
      title: "Test Issue - API Connection",
      body: `## Test Issue
      
This is a test issue to verify the API connection is working.

**Environment:**
- Time: ${new Date().toISOString()}
- User Agent: Test
- Page URL: Test

**Test Data:**
- Target Region: Test region
- Captured Elements: Test elements
- Console Logs: Test logs

**Note:** This is just a test - no video is uploaded. Real recordings will include:
- Video file (inline or S3 URL)
- Actual browser environment data
- Real console logs
- Actual captured elements

This issue was created via API test.`,
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
