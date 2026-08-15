from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from .api_handler import LawApiHandler
from .scraper import LawScraper
import asyncio

app = FastAPI(title="Law Scapping API")

class ScrapeRequest(BaseModel):
    url: str
    options: List[str] # ['history', 'pdf', 'hwp']

class ScrapeResponse(BaseModel):
    status: str
    message: str
    data: Optional[dict] = None
    guide: Optional[str] = None

@app.post("/api/scrape", response_model=ScrapeResponse)
async def start_scrape(request: ScrapeRequest):
    api_handler = LawApiHandler()
    scraper = LawScraper()
    
    # 1. URL 파싱
    ids = api_handler.parse_url(request.url)
    
    # 2. 우선 API 시도
    if ids["lsiSeq"]:
        api_result = api_handler.get_law_detail(ids["lsiSeq"])
        if api_result["success"]:
            return ScrapeResponse(
                status="success",
                message="API를 통해 데이터를 성공적으로 가져왔습니다.",
                data={"type": "api", "content": api_result["data"]}
            )

    # 3. API 실패 시 Playwright Fallback
    print(f"API failed or no ID found. Starting Playwright fallback for: {request.url}")
    scrape_result = await scraper.scrape_law_page(request.url)
    
    if scrape_result["success"]:
        return ScrapeResponse(
            status="success",
            message="크롤러를 통해 데이터를 성공적으로 가져왔습니다.",
            data={"type": "scraper", "content": scrape_result}
        )
    else:
        return ScrapeResponse(
            status="error",
            message="모든 수동 수집 시도가 실패했습니다.",
            guide=scrape_result.get("guide")
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
