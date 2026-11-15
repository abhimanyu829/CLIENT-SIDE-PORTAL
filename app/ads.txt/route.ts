import { NextResponse } from "next/server"

export const dynamic = "force-static"

export async function GET() {
  const content = `# ads.txt - https://abhibhideveloper.tech
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
`
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}

