import xml.etree.ElementTree as ET
import os
import re
import requests
from typing import Optional, Dict, Any, List

class LawApiHandler:
    """국가법령정보센터 Open API 연동 모듈"""
    
    BASE_URL = "https://www.law.go.kr/DRF/lawSearch.do"
    DETAIL_URL = "https://www.law.go.kr/DRF/lawService.do"

    def __init__(self, api_key: str = None, download_dir: str = "downloads"):
        self.api_key = api_key or os.getenv("LAW_API_KEY", "ceiai_law_test")
        self.download_dir = download_dir
        os.makedirs(self.download_dir, exist_ok=True)

    def parse_url(self, url: str) -> Dict[str, Optional[str]]:
        """URL에서 법령 일련번호(lsiSeq/MST) 추출"""
        result = {"lsiSeq": None, "mst": None}
        
        lsi_match = re.search(r'lsiSeq=(\d+)', url)
        if lsi_match:
            result["lsiSeq"] = lsi_match.group(1)
            
        mst_match = re.search(r'mst=(\d+)', url)
        if mst_match:
            result["mst"] = mst_match.group(1)
            
        return result

    def get_law_detail(self, lsi_seq: str) -> Dict[str, Any]:
        """API를 통해 법령 상세 정보 및 첨부파일 URL 획득"""
        params = {
            "OC": self.api_key,
            "target": "law",
            "ID": lsi_seq,
            "type": "XML"
        }
        
        try:
            response = requests.get(self.DETAIL_URL, params=params, timeout=15)
            response.raise_for_status()
            
            # 인코딩 설정
            response.encoding = 'utf-8' if response.apparent_encoding == 'utf-8' else response.apparent_encoding
            xml_text = response.text
            
            # XML 파싱
            root = ET.fromstring(xml_text.encode('utf-8'))
            
            # 기본정보 노드 찾기
            info_elem = root.find("기본정보")
            
            law_title = "국가법령_자료"
            promulgation_date = ""
            department = ""
            
            if info_elem is not None:
                title_node = info_elem.find("법령명_한글")
                if title_node is not None and title_node.text:
                    law_title = title_node.text.strip()
                    
                date_node = info_elem.find("공포일자")
                if date_node is not None and date_node.text:
                    promulgation_date = date_node.text.strip()
                    if len(promulgation_date) == 8:
                        promulgation_date = f"{promulgation_date[:4]}-{promulgation_date[4:6]}-{promulgation_date[6:]}"
                        
                dept_node = info_elem.find("소관부처")
                if dept_node is not None and dept_node.text:
                    department = dept_node.text.strip()
            
            # 별표/서식 첨부파일 파싱
            attachments = []
            star_files = root.findall(".//별표단위")
            for sf in star_files:
                name_node = sf.find("별표제목")
                link_node = sf.find("별표서식PDF파일링크") or sf.find("별표서식파일링크")
                if link_node is not None and link_node.text:
                    attachments.append({
                        "name": name_node.text.strip() if name_node is not None and name_node.text else "첨부서식",
                        "url": link_node.text.strip()
                    })
            
            # 최대 3개 별표/서식 자동 다운로드
            downloaded_files = []
            for idx, att in enumerate(attachments[:3]):
                file_url = att["url"]
                # URL 만들기
                full_url = file_url if file_url.startswith("http") else f"https://www.law.go.kr{file_url}"
                clean_att_name = re.sub(r'[\\/*?:"<>|]', "", att["name"]).strip()
                filename = f"{law_title}_첨부_{idx+1}_{clean_att_name}.pdf"
                filepath = os.path.join(self.download_dir, filename)
                
                try:
                    dl_headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
                        "Referer": "https://www.law.go.kr"
                    }
                    dl_resp = requests.get(full_url, headers=dl_headers, timeout=15)
                    if dl_resp.status_code == 200:
                        with open(filepath, "wb") as f:
                            f.write(dl_resp.content)
                        downloaded_files.append({
                            "type": "pdf",
                            "filename": filename,
                            "download_url": f"/downloads/{filename}"
                        })
                except Exception as dl_err:
                    print(f"Attachment download error: {str(dl_err)}")
                    
            return {
                "success": True,
                "data": {
                    "title": law_title,
                    "date": promulgation_date,
                    "department": department,
                    "downloaded_files": downloaded_files
                },
                "msg": "API 조회 성공"
            }
        except Exception as e:
            return {
                "success": False,
                "msg": f"API 호출 또는 파싱 실패: {str(e)}"
            }

    def get_amendment_history(self, mst: str) -> Dict[str, Any]:
        """개정연혁 목록 조회"""
        pass
