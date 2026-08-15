import os
import re
import requests
from typing import Dict, Any

class CourtHandler:
    """대법원 종합법률정보 / 법원도서관 판례해설 수집기"""
    
    def __init__(self, download_dir: str = "downloads"):
        self.download_dir = download_dir
        os.makedirs(self.download_dir, exist_ok=True)
        
    def parse_url(self, url: str) -> Dict[str, Any]:
        """대법원 URL에서 contId 추출"""
        result = {"contId": None, "type": "court"}
        # contId=LIT_XXXX 형태 또는 sjo160.do?contId=... 형태 매칭
        match = re.search(r'contId=([^&]+)', url)
        if match:
            result["contId"] = match.group(1)
        return result

    def download_commentary(self, cont_id: str, title: str = None) -> Dict[str, Any]:
        """대법원 판례해설 PDF 다운로드"""
        if not title:
            # 기본 파일명 구조 설정
            title = f"대법원판례해설_{cont_id}"
            
        # 특수문자 제거하여 파일명 안전하게 보호
        safe_title = re.sub(r'[\\/*?:"<>|]', "", title)
        filename = f"{safe_title}.pdf"
        filepath = os.path.join(self.download_dir, filename)
        
        pdf_url = f"https://glaw.scourt.go.kr/wsjo/litr/sjo160.do?contId={cont_id}&out=pdf"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Referer": "https://glaw.scourt.go.kr/"
        }
        
        try:
            response = requests.get(pdf_url, headers=headers, timeout=25)
            response.raise_for_status()
            
            # 응답이 진짜 PDF인지 확인 (Content-Type 검사 또는 매직 넘버 검사)
            content_type = response.headers.get("Content-Type", "")
            if "pdf" not in content_type.lower() and not response.content.startswith(b"%PDF"):
                # 실제 응답 텍스트가 HTML 에러 페이지일 가능성 확인
                return {
                    "success": False,
                    "msg": "다운로드받은 파일이 유효한 PDF 형식이 아닙니다. 원본 링크의 자료가 유효한지 확인해 주세요."
                }
                
            with open(filepath, "wb") as f:
                f.write(response.content)
                
            return {
                "success": True,
                "filepath": filepath,
                "filename": filename,
                "download_url": f"/downloads/{filename}",
                "msg": f"대법원판례해설 PDF 다운로드 성공: {filename}"
            }
        except Exception as e:
            return {
                "success": False,
                "msg": f"대법원 PDF 다운로드 실패: {str(e)}"
            }
