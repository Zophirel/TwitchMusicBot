export type YouTubeResult = {
  videoId: string;
  title: string;
};

export async function searchYouTube(query: string, apiKey: string): Promise<YouTubeResult | null> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "1",
    videoEmbeddable: "true",
    q: query,
    key: apiKey
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }>;
  };

  const item = data.items?.[0];
  const videoId = item?.id?.videoId;
  const title = item?.snippet?.title;
  if (!videoId || !title) {
    return null;
  }

  return { videoId, title };
}
