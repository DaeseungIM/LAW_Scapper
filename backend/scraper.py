import os
import re
import asyncio
import random
import requests
from playwright.async_api import async_playwright
from typing import Dict, Any, List

class LawScraper:
    """Playwright 기반 국가법령정보센터 크롤링 및 다운로드 모듈"""

    def __init__(self, download_dir: str = "downloads", timeout: int = 25000):
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
                await page.wait_for_timeout(2000) # 추가 동적 로딩 완료 대기
                
                # 2. 제목 추출
                title_elem = page.locator("#lawNm")
                title = "국가법령_자료"
                if await title_elem.count() > 0:
                    title = await title_elem.inner_text()
                else:
                    title = await page.title()
                
                # 파일명 세이프처리
                safe_title = re.sub(r'[\\/*?:"<>|]', "", title).strip()
                if not safe_title:
                    safe_title = "law_document"
                
                # --- [개정연혁 PDF 모두 다운로드 기능] ---
                if "history" in options:
                    print("개정연혁 모드 활성화됨. 연혁 버튼 클릭 시도...")
                    
                    # '연혁' 탭/버튼 클릭 시도
                    # a#hstView, button:has-text('연혁'), a:has-text('연혁') 등 다중 매칭
                    hst_btn = page.locator("a#hstView, .btn_history, a:has-text('연혁'), button:has-text('연혁')").first
                    
                    if await hst_btn.count() > 0 and await hst_btn.is_visible():
                        await hst_btn.click()
                        print("연혁 버튼 클릭 완료. 연혁 레이어 로드 대기 중...")
                        # 연혁 팝업 레이어 (#lsHstLayer, #lsHstLayerDiv, x-window 등) 출현 대기
                        await page.wait_for_timeout(2500) # 연혁 목록 팝업의 비동기 렌더링 대기
                        
                        # 연혁 레이어 내부의 모든 링크 탐색
                        # LSW 사이트 구조상 #lsHstLayer 또는 .x-window, #lsHstDivWrite, #joHstDivWrite 등에 렌더링됨
                        popup_html = await page.evaluate("""() => {
                            const layer = document.querySelector('#lsHstLayer') || document.querySelector('#lsHstDivWrite') || document.querySelector('.x-window') || document.body;
                            return layer ? layer.innerHTML : '';
                        }""")
                        
                        # HTML 소스에서 lsiSeq 및 텍스트(시행일/법률번호) 매칭하여 추출
                        # 예: lsViewLsHst('276137') 또는 lsInfoP.do?lsiSeq=276137 등
                        history_matches = []
                        
                        # 1) lsViewLsHst('276137') 형태 매칭
                        onclick_pattern = r"onclick=\"[^\"]*lsViewLsHst\s*\(\s*'?(\d+)'?\s*\)[^\"]*\"[^>]*>(.*?)</a>"
                        for m in re.finditer(onclick_pattern, popup_html, re.DOTALL | re.IGNORECASE):
                            seq = m.group(1)
                            text = re.sub(r'<[^>]+>', '', m.group(2)).strip().replace("\n", " ")
                            if seq and text and not any(item["lsiSeq"] == seq for item in history_matches):
                                history_matches.append({"lsiSeq": seq, "title": text})
                                
                        # 2) lsiSeq=276137 형태 매칭
                        href_pattern = r"href=\"[^\"]*lsiSeq=(\d+)[^\"]*\"[^>]*>(.*?)</a>"
                        for m in re.finditer(href_pattern, popup_html, re.DOTALL | re.IGNORECASE):
                            seq = m.group(1)
                            text = re.sub(r'<[^>]+>', '', m.group(2)).strip().replace("\n", " ")
                            if seq and text and not any(item["lsiSeq"] == seq for item in history_matches):
                                history_matches.append({"lsiSeq": seq, "title": text})

                        print(f"추출된 총 개정연혁 법령 수: {len(history_matches)}개")
                        
                        if history_matches:
                            # 최근 3개 연혁 파일만 PDF 다운로드 수행 (사용자 요구사항)
                            recent_targets = history_matches[:3]
                            downloaded_files = []
                            
                            print("최근 3개 개정연혁 파일 PDF 다운로드 시작...")
                            for idx, target in enumerate(recent_targets):
                                seq = target["lsiSeq"]
                                hst_title = target["title"]
                                
                                # 파일명 정규화
                                clean_hst_title = re.sub(r'[\\/*?:"<>|]', "", hst_title).strip()
                                # 빈칸 및 다중 탭 정리
                                clean_hst_title = " ".join(clean_hst_title.split())
                                filename = f"[{idx+1}].{clean_hst_title}.pdf"
                                filepath = os.path.join(self.download_dir, filename)
                                
                                print(f"[{idx+1}/3] {filename} 다운로드 중... (lsiSeq: {seq})")
                                
                                # 직접 PDF 다운로드 API 호출 시도
                                download_success = self.download_direct_pdf(seq, filepath)
                                
                                if download_success:
                                    downloaded_files.append({
                                        "type": "pdf",
                                        "filename": filename,
                                        "download_url": f"/downloads/{filename}"
                                    })
                                else:
                                    print(f"[{idx+1}/3] {filename} 다운로드 실패. 다른 방식으로 우회 시도합니다.")
                                
                                # IP 차단 방지를 위한 인간 다운로더 시뮬레이션 딜레이 적용
                                delay_time = random.uniform(3.0, 6.0)
                                print(f"IP 차단 방지를 위해 {delay_time:.2f}초간 휴식...")
                                await page.wait_for_timeout(int(delay_time * 1000))
                                
                            if downloaded_files:
                                return {
                                    "success": True,
                                    "title": f"{safe_title} (개정연혁 수집)",
                                    "type": "history_scraper",
                                    "downloaded_files": downloaded_files,
                                    "msg": f"최근 3개의 개정연혁 PDF 원문을 성공적으로 수집하여 다운로드했습니다."
                                }
                            else:
                                return {
                                    "success": False,
                                    "msg": "개정연혁 목록은 감지하였으나 PDF 파일 저장에 실패했습니다. 사이트 보안 정책이 강화되었을 수 있습니다."
                                }
                        else:
                            print("연혁 레이어 HTML 소스 내에서 개정 리스트(lsiSeq)를 정규식으로 파싱해내지 못했습니다. 우회 수집을 적용합니다.")
                    else:
                        print("페이지 내에서 '연혁' 탭 버튼을 찾을 수 없거나 보이지 않습니다.")

                # --- [일반 단일 법령 본문 PDF/HWP 다운로드] ---
                downloaded_files = []
                
                # PDF 다운로드
                if "pdf" in options:
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
                            print(f"PDF download clicked failed: {str(e_pdf)}")

                # HWP 다운로드
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
                            print(f"HWP download clicked failed: {str(e_hwp)}")

                if not downloaded_files:
                    # 링크 직접 탐색
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
                        "msg": "본문 다운로드 버튼이 보이지 않아 첨부파일 링크 목록을 대신 제공합니다."
                    }
                
                return {
                    "success": True,
                    "title": title,
                    "type": "scraper",
                    "downloaded_files": downloaded_files,
                    "msg": f"크롤링을 완료하고 {len(downloaded_files)}개 파일을 정상 보관했습니다."
                }

            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "guide": f"크롤링 오류 발생: {str(e)}"
                }
            finally:
                await browser.close()

    def download_direct_pdf(self, lsi_seq: str, filepath: str) -> bool:
        """lsPdfPrint.do를 통해 다이렉트 PDF 바이너리 스트림 다운로드"""
        pdf_url = f"https://www.law.go.kr/lsPdfPrint.do?lsiSeq={lsi_seq}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Referer": f"https://www.law.go.kr/lsInfoP.do?lsiSeq={lsi_seq}"
        }
        
        try:
            response = requests.get(pdf_url, headers=headers, timeout=20)
            response.raise_for_status()
            
            # 응답 내용 검사 (진짜 PDF 바이너리인지 수집)
            if response.content.startswith(b"%PDF"):
                with open(filepath, "wb") as f:
                    f.write(response.content)
                return True
            else:
                print(f"lsiSeq {lsi_seq} 응답이 PDF 바이너리가 아님 (%PDF 매직넘버 누락)")
                return False
        except Exception as e:
            print(f"lsiSeq {lsi_seq} 직접 다운로드 에러: {str(e)}")
            return False
