async function getWikipediaBio(fullName) {
    const title = encodeURIComponent(fullName.replaceAll(" ", "_"));
  
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
  
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BallerzStatApp/1.0",
      },
    });
  
    if (!response.ok) {
      throw new Error("Wikipedia bio not found");
    }
  
    const data = await response.json();
  
    return {
      bio: data.extract,
      sourceUrl: data.content_urls?.desktop?.page,
    };
  }
  
  module.exports = { getWikipediaBio };