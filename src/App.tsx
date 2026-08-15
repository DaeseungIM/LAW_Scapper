import { useState, useEffect } from 'react';
import { Search, Download, Terminal, CheckCircle2, AlertCircle, FileText, Clock, Settings, HelpCircle } from 'lucide-react';

interface DownloadedFile {
  type: string;
  filename: string;
  download_url: string;
}

interface HistoryItem {
  lsiSeq: string;
  title: string;
}

interface ScrapedResult {
  id: number;
  name: string;
  date: string;
  status: 'completed' | 'pending' | 'error';
  files: DownloadedFile[];
  type: string;
  history_list?: HistoryItem[];
}

export default function App() {
  const [url, setUrl] = useState('');
  const [options, setOptions] = useState({
    history: true,
    pdf: true,
    hwp: false,
  });
  
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    '[준비] 시스템 초기화 완료. 수집할 주소(URL)를 입력해주세요.',
  ]);
  const [results, setResults] = useState<ScrapedResult[]>([
    {
      id: 1,
      name: '부동산등기법 (예시)',
      date: '2024-07-15',
      status: 'completed',
      type: 'api',
      files: [{ type: 'pdf', filename: '부동산등기법_첨부_1.pdf', download_url: '#' }]
    }
  ]);
  
  // 백엔드 API 서버 주소 (로컬 또는 커스텀 설정)
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [showSettings, setShowSettings] = useState(false);
  const [downloadingSeq, setDownloadingSeq] = useState<string | null>(null);

  const handleDownloadHistory = async (seq: string, title: string) => {
    setDownloadingSeq(seq);
    addLog(`개별 연혁 PDF 변환 및 다운로드 중... (번호: ${seq}, 제목: ${title})`);
    try {
      const response = await fetch(`${apiUrl}/api/download_pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lsiSeq: seq,
          title: title,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const res = await response.json();
      if (res.status === 'success') {
        addLog(`성공: ${res.filename} 다운로드 완료!`);
        const link = document.createElement('a');
        link.href = `${apiUrl}${res.download_url}`;
        link.setAttribute('download', res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        addLog(`오류: ${res.message}`);
        alert(res.message);
      }
    } catch (err: any) {
      addLog(`다운로드 장애: ${err.message}`);
      alert(`다운로드 실패: ${err.message}`);
    } finally {
      setDownloadingSeq(null);
    }
  };

  // 진행률 시뮬레이션
  useEffect(() => {
    let interval: any;
    if (isScraping) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95; // 완료 전까지 95%에서 대기
          }
          return prev + Math.floor(Math.random() * 8) + 2;
        });
      }, 500);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isScraping]);

  const addLog = (message: string) => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleStartScrape = async () => {
    if (!url.trim()) {
      alert('법령 또는 대법원 판례해설 URL 주소를 입력해 주세요.');
      return;
    }

    setIsScraping(true);
    setProgress(5);
    setLogs([]);
    addLog(`수집 시작: ${url}`);
    
    // 선택된 옵션 변환
    const selectedOptions = Object.entries(options)
      .filter(([_, checked]) => checked)
      .map(([key]) => key);

    try {
      addLog('URL 분석 중...');
      if (url.includes('scourt.go.kr')) {
        addLog('대법원 종합법률정보/법원도서관 패턴 감지됨.');
      } else if (url.includes('law.go.kr')) {
        addLog('국가법령정보센터 패턴 감지됨.');
      } else {
        addLog('알 수 없는 URL 형식이나 계속 시도합니다.');
      }

      addLog('백엔드 API 서버로 요청 송신 중...');
      const response = await fetch(`${apiUrl}/api/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          options: selectedOptions,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP 에러! 상태코드: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        setProgress(100);
        addLog(`성공: ${result.message}`);
        
        const newResult: ScrapedResult = {
          id: Date.now(),
          name: result.data.title || '수집된 법률 문서',
          date: result.data.date || new Date().toISOString().split('T')[0],
          status: 'completed',
          type: result.data.type || 'unknown',
          files: result.data.downloaded_files || [],
          history_list: result.data.history_list || [],
        };

        if (newResult.files.length > 0) {
          newResult.files.forEach(f => {
            addLog(`파일 다운로드 가능: ${f.filename}`);
          });
        } else {
          addLog('다운로드된 본문/서식 파일이 없습니다. (첨부파일만 존재할 수 있음)');
          if (result.data.attachments && result.data.attachments.length > 0) {
            addLog(`조회된 대체 첨부파일 목록 (${result.data.attachments.length}개):`);
            result.data.attachments.forEach((att: any) => {
              addLog(`- ${att.text}: ${att.href}`);
            });
          }
        }
        
        setResults(prev => [newResult, ...prev]);
      } else {
        setProgress(100);
        addLog(`오류: ${result.message}`);
        if (result.guide) {
          addLog(`안내: ${result.guide}`);
        }
        
        setResults(prev => [
          {
            id: Date.now(),
            name: url.substring(0, 30) + '...',
            date: new Date().toISOString().split('T')[0],
            status: 'error',
            type: 'error',
            files: [],
          },
          ...prev
        ]);
      }
    } catch (error: any) {
      setProgress(100);
      addLog(`네트워크 또는 백엔드 장애 발생: ${error.message}`);
      addLog('백엔드 서버(FastAPI)가 실행 중인지, 혹은 API 주소 설정을 확인해 주세요.');
      
      setResults(prev => [
        {
          id: Date.now(),
          name: '연동 실패',
          date: new Date().toISOString().split('T')[0],
          status: 'error',
          type: 'network',
          files: [],
        },
        ...prev
      ]);
    } finally {
      setIsScraping(false);
    }
  };

  const handleOptionChange = (key: 'history' | 'pdf' | 'hwp') => {
    setOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white py-4 px-8 shadow-lg z-10 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center border border-white/10 shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">LAW Scrapper</h1>
              <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-widest">Legal Intelligence System</p>
            </div>
          </div>
          <nav className="flex gap-6 text-sm font-medium items-center">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-md border border-white/10"
            >
              <Settings className="w-4 h-4" />
              API 주소 설정
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8">
        
        {/* API Settings Panel */}
        {showSettings && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-blue-600" />
              백엔드 FastAPI API 서버 경로 주소
            </h3>
            <div className="flex gap-3 max-w-lg">
              <input 
                type="text" 
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8000" 
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                onClick={() => setShowSettings(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                저장
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              로컬에서 테스트 시 기본값인 <code>http://localhost:8000</code>을 사용하며, 원격 서버에 배포한 경우 해당 IP나 도메인 주소를 작성합니다.
            </p>
          </div>
        )}

        {/* Input Area */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <Search className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold">스크래핑 & 다운로드 설정</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">법령/판례해설 URL 주소</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="예: https://www.law.go.kr/LSW/lawInfoP.do?lsiSeq=123456 또는 대법원 판례해설 상세 URL" 
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isScraping}
                />
                <button 
                  onClick={handleStartScrape}
                  disabled={isScraping}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition-all shadow-md shrink-0 ${
                    isScraping 
                      ? 'bg-slate-400 cursor-not-allowed shadow-none' 
                      : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 active:scale-98'
                  }`}
                >
                  <Download className={`w-4 h-4 ${isScraping ? 'animate-bounce' : ''}`} />
                  {isScraping ? '수집 진행 중...' : '수집 및 다운로드'}
                </button>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                국가법령정보센터 본문/별표 주소 및 대법원 종합법률정보 판례해설 상세 페이지 주소 지원
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">다운로드 옵션</label>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                    checked={options.history} 
                    onChange={() => handleOptionChange('history')}
                    disabled={isScraping}
                  />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">개정연혁</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                    checked={options.pdf} 
                    onChange={() => handleOptionChange('pdf')}
                    disabled={isScraping}
                  />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">본문 (PDF)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                    checked={options.hwp} 
                    onChange={() => handleOptionChange('hwp')}
                    disabled={isScraping}
                  />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">본문 (HWP)</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Monitoring Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Clock className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold">수집 진행률</h2>
              </div>
              <span className="text-2xl font-black text-slate-800">{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3.5 mb-4 overflow-hidden border border-slate-200">
              <div 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 text-center font-medium">
              {isScraping ? '파일 데이터를 분석하고 다운로드 처리 중입니다...' : '대기 중 - 대량 수집 시 각 요청 간 수 초의 딜레이가 자동 부여됩니다.'}
            </p>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-800">
              <Terminal className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold">실시간 수집 콘솔</h2>
            </div>
            <div className="bg-slate-950 text-slate-300 p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-[140px] border border-slate-800 shadow-inner">
              {logs.map((log, index) => (
                <div key={index} className="mb-1 last:mb-0 leading-relaxed">
                  <span className="text-blue-500 mr-2">&gt;</span>
                  {log}
                </div>
              ))}
              {isScraping && (
                <div className="animate-pulse inline-block w-2 h-4 bg-blue-500 align-middle ml-1"></div>
              )}
            </div>
          </section>
        </div>

        {/* Results Table */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800">수집 완료 목록</h2>
              <p className="text-xs text-slate-500 mt-1">다운로드 받은 법령 및 대법원판례해설 파일 목록입니다.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-4">문서명</th>
                  <th className="px-6 py-4">구분 / 수집일자</th>
                  <th className="px-6 py-4 text-center">보관 파일 다운로드</th>
                  <th className="px-6 py-4 text-center">진행 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors shrink-0">
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                        <span className="font-semibold text-slate-800 text-sm">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                      <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded mr-2 uppercase">{row.type}</span>
                      {row.date}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.type === 'history_list' && row.history_list && row.history_list.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2.5 bg-slate-50 space-y-2 w-full max-w-xl text-left mx-auto">
                          <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-500" />
                            전체 개정연혁 목록 ({row.history_list.length}개) - 원하는 항목의 PDF 단추를 누르세요.
                          </p>
                          <div className="space-y-1.5">
                            {row.history_list.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center gap-4 bg-white px-2.5 py-2 rounded-lg border border-slate-200/60 shadow-sm text-xs">
                                <span className="font-semibold text-slate-700 leading-tight">{item.title}</span>
                                <button
                                  onClick={() => handleDownloadHistory(item.lsiSeq, item.title)}
                                  disabled={downloadingSeq !== null}
                                  className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                                    downloadingSeq === item.lsiSeq
                                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                                      : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border-blue-100'
                                  }`}
                                >
                                  <Download className={`w-3 h-3 ${downloadingSeq === item.lsiSeq ? 'animate-bounce' : ''}`} />
                                  {downloadingSeq === item.lsiSeq ? '수집중' : 'PDF'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : row.files && row.files.length > 0 ? (
                        <div className="flex justify-center gap-2">
                          {row.files.map((file, idx) => (
                            <a 
                              key={idx}
                              href={file.download_url === '#' ? '#' : `${apiUrl}${file.download_url}`}
                              download={file.filename}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2.5 py-1.5 rounded-lg border border-blue-100 transition-all shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {file.type.toUpperCase()}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-medium">받은 파일 없음</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded border border-emerald-100 shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 성공
                        </span>
                      )}
                      {row.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded border border-amber-100 shadow-sm">
                          <Clock className="w-3.5 h-3.5" /> 진행중
                        </span>
                      )}
                      {row.status === 'error' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100 shadow-sm">
                          <AlertCircle className="w-3.5 h-3.5" /> 실패
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 px-8 text-center text-slate-500">
        <p className="text-xs">© 2026 Law Scapping System. Designed for Daeseung IM. All rights reserved.</p>
      </footer>
    </div>
  );
}
