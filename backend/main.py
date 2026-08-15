import os
from dotenv import load_dotenv

# .env 환경 변수 로드
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from .api_handler import LawApiHandler
from .scraper import LawScraper
from .court_handler import CourtHandler

app = FastAPI(title="Law Scaping API")

# CORS 미들웨어 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 실사용 또는 배포 환경에 최적화 가능
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 다운로드 디렉터리 생성 및 마운트
DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
app.mount("/downloads", StaticFiles(directory=DOWNLOAD_DIR), name="downloads")

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
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL을 입력해 주세요.")
        
    api_handler = LawApiHandler(download_dir=DOWNLOAD_DIR)
    scraper = LawScraper(download_dir=DOWNLOAD_DIR)
    court_handler = CourtHandler(download_dir=DOWNLOAD_DIR)
    
    # --- 대법원 종합법률정보 / 법원도서관 URL 판별 ---
    if "scourt.go.kr" in url:
        court_info = court_handler.parse_url(url)
        if court_info["contId"]:
            result = court_handler.download_commentary(court_info["contId"])
            if result["success"]:
                return ScrapeResponse(
                    status="success",
                    message="대법원판례해설 PDF를 성공적으로 다운로드했습니다.",
                    data={
                        "type": "court",
                        "title": result["filename"].replace(".pdf", ""),
                        "date": "대법원 문헌자료",
                        "downloaded_files": [
                            {
                                "type": "pdf",
                                "filename": result["filename"],
                                "download_url": result["download_url"]
                            }
                        ]
                    }
                )
            else:
                return ScrapeResponse(
                    status="error",
                    message=result["msg"]
                )
        else:
            return ScrapeResponse(
                status="error",
                message="대법원 URL에서 contId(고유번호)를 추출할 수 없습니다. 상세페이지 주소를 확인해 주세요."
            )

    # --- 국가법령정보센터 URL 판별 ---
    ids = api_handler.parse_url(url)
    
    # 1. 우선 API 시도 (lsiSeq가 있는 경우 및 HWP 본문 다운로드가 아닐 때)
    # XML API는 주로 서식 PDF/HWP를 제공하므로 본문 PDF/HWP가 필요하다면 플레이라이트 스크래퍼가 더 적절합니다.
    if ids["lsiSeq"] and "hwp" not in request.options:
        api_result = api_handler.get_law_detail(ids["lsiSeq"])
        if api_result["success"]:
            return ScrapeResponse(
                status="success",
                message="국가법령 Open API를 통해 데이터를 조회하고 첨부서식을 다운로드했습니다.",
                data={
                    "type": "api",
                    "title": api_result["data"]["title"],
                    "date": api_result["data"]["date"],
                    "downloaded_files": api_result["data"]["downloaded_files"]
                }
            )

    # 2. API 실패 시 또는 본문 직접 크롤링이 명시된 경우 Playwright 실행
    print(f"Playwright crawling started for: {url}")
    scrape_result = await scraper.scrape_law_page(url, request.options)
    
    if scrape_result["success"]:
        return ScrapeResponse(
            status="success",
            message="크롤러를 통해 법령 본문을 다운로드했습니다.",
            data={
                "type": "scraper",
                "title": scrape_result["title"],
                "date": "실시간 수집",
                "downloaded_files": scrape_result.get("downloaded_files", []),
                "attachments": scrape_result.get("attachments", [])
            }
        )
    else:
        return ScrapeResponse(
            status="error",
            message="수집에 실패했습니다. 올바른 URL인지 다시 한번 확인해주세요.",
            guide=scrape_result.get("guide")
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
