import os
import re
import asyncio
from playwright.async_api import async_playwright
from typing import Dict, Any, List

class LawScraper:
    """Playwright 기반 국가법령정보센터 크롤링 및 다운로드 모듈"""

    def __init__(self, download_dir: str = "downloads", timeout: int = 20000):
        self.download_dir = download_dir
        self.timeout = timeout
        os.makedirs(self.download_dir, exist_ok=True)

    async def scrape_law_page(self, url: str, options: List[str] = None) -> Dict[str, Any]:
        """동적 렌더링 페이지에서 데이터 및 첨부파일 다운로드"""
        if options is None:
            options = ["pdf"]
            
        async with async_playwright() as p:
            # 헤드리스 크롬 실행
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
                accept_downloads=True
            )
            page = await context.new_page()
            
            try:
                # 1. 페이지 이동
                await page.goto(url, wait_until="networkidle", timeout=self.timeout)
                
                # 2. 제목 추출 (국가법령정보센터 법령명 ID는 보통 #lawNm 또는 타이틀)
                title_elem = page.locator("#lawNm")
                title = "국가법령_자료"
                if await title_elem.count() > 0:
                    title = await title_elem.inner_text()
                else:
                    title = await page.title()
                
                # 파일명으로 사용할 수 있게 정규화
                safe_title = re.sub(r'[\\/*?:"<>|]', "", title).strip()
                if not safe_title:
                    safe_title = "law_document"
                
                # 3. 개정연혁 탭 클릭 시도 (옵션 선택 시)
                if "history" in options:
                    history_tab = page.locator("text='개정연혁'")
                    if await history_tab.is_visible():
                        await history_tab.click()
                        await page.wait_for_timeout(1000)
                
                downloaded_files = []
                
                # 4. 본문 PDF 다운로드 시도
                if "pdf" in options:
                    # 국가법령정보센터 상단 도구 모음의 PDF 저장 버튼 매칭
                    pdf_btn = page.locator("#btnPdf, .btn_pdf, a:has-text('PDF'), button:has-text('PDF')").first
                    if await pdf_btn.is_visible():
                        try:
                            async with page.expect_download(timeout=8000) as download_info:
                                await pdf_btn.click()
                            download = await download_info.value
                            filename = f"{safe_title}.pdf"
                            filepath = os.path.join(self.download_dir, filename)
                            await download.save_as(filepath)
                            downloaded_files.append({
                                "type": "pdf",
                                "filename": filename,
                                "download_url": f"/downloads/{filename}"
                            })
                        except Exception as e_pdf:
                            print(f"PDF download click failed: {str(e_pdf)}")

                # 5. 본문 HWP 다운로드 시도
                if "hwp" in options:
                    hwp_btn = page.locator("#btnHwp, .btn_hwp, a:has-text('HWP'), button:has-text('한글'), button:has-text('HWP')").first
                    if await hwp_btn.is_visible():
                        try:
                            async with page.expect_download(timeout=8000) as download_info:
                                await hwp_btn.click()
                            download = await download_info.value
                            filename = f"{safe_title}.hwp"
                            filepath = os.path.join(self.download_dir, filename)
                            await download.save_as(filepath)
                            downloaded_files.append({
                                "type": "hwp",
                                "filename": filename,
                                "download_url": f"/downloads/{filename}"
                            })
                        except Exception as e_hwp:
                            print(f"HWP download click failed: {str(e_hwp)}")

                # 만약 다운로드된 파일이 없다면 페이지 내 첨부파일 링크 수집
                if not downloaded_files:
                    attachments = []
                    links = page.locator("a[href*='flDownload.do'], a[href*='.pdf'], a[href*='.hwp']")
                    count = await links.count()
                    for i in range(min(count, 5)):
                        link = links.nth(i)
                        href = await link.get_attribute("href")
                        text = await link.inner_text()
                        if href:
                            attachments.append({
                                "text": text.strip() if text else f"첨부파일_{i+1}",
                                "href": href if href.startswith("http") else f"https://www.law.go.kr{href}"
                            })
                            
                    return {
                        "success": True,
                        "title": title,
                        "type": "scraper",
                        "downloaded_files": [],
                        "attachments": attachments,
                        "msg": "본문 다운로드 버튼을 활성화할 수 없어 개별 첨부파일 목록 링크를 대신 제공합니다."
                    }
                
                return {
                    "success": True,
                    "title": title,
                    "type": "scraper",
                    "downloaded_files": downloaded_files,
                    "msg": f"크롤링을 완료하고 {len(downloaded_files)}개 파일을 정상 저장했습니다."
                }

            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "guide": (
                        f"웹 크롤러 처리 중 에러 발생: {str(e)}\n"
                        "인터넷 연결을 확인하시거나 크롤러 실행 속도를 늦춰 조치해 보시기 바랍니다."
                    )
                }
            finally:
                await browser.close()
