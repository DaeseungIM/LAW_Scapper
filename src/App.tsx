import { useState } from 'react';
import { Search, Download, Terminal, CheckCircle2, AlertCircle, FileText, ExternalLink, Clock } from 'lucide-react';

// --- Mock Data ---
const MOCK_RESULTS = [
  { id: 1, name: '부동산등기법', date: '2024-07-15', status: 'completed', link: '#' },
  { id: 2, name: '민법', date: '2024-06-01', status: 'completed', link: '#' },
  { id: 3, name: '형법', date: '2024-05-20', status: 'error', link: null },
  { id: 4, name: '상법', date: '2024-08-10', status: 'pending', link: null },
];

const MOCK_LOGS = [
  '[14:20:05] 시스템 초기화 완료...',
  '[14:20:06] 법제처 API 연결 시도 중...',
  '[14:20:07] URL 분석 완료: https://www.law.go.kr/...',
  '[14:20:08] 데이터 추출 시작 (대상: 개정연혁, PDF)',
  '[14:20:10] 대기 중인 작업: 1건...',
];

export default function App() {
  const [progress, setProgress] = useState(65);
  const [url, setUrl] = useState('');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-bkl-navy text-white py-4 px-8 shadow-lg z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Law Scapping</h1>
              <p className="text-[10px] text-white/60 uppercase tracking-widest">Legal Intelligence System</p>
            </div>
          </div>
          <nav className="flex gap-6 text-sm font-medium">
            <a href="#" className="hover:text-white/80 transition-colors">Dashboard</a>
            <a href="#" className="hover:text-white/80 transition-colors">History</a>
            <a href="#" className="hover:text-white/80 transition-colors">Settings</a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-8">
        
        {/* Input Area */}
        <section className="card p-8">
          <div className="flex items-center gap-2 mb-6 text-bkl-navy">
            <Search className="w-5 h-5" />
            <h2 className="text-lg font-bold">스크래핑 설정</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <label className="block text-sm font-semibold text-bkl-gray-dark">법령/의안 URL 또는 검색어</label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="https://www.law.go.kr/..." 
                  className="input-field"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button className="btn-primary flex items-center gap-2 shrink-0">
                  <Download className="w-4 h-4" />
                  수집 시작
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-bkl-gray-dark">다운로드 옵션</label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-bkl-border text-bkl-navy focus:ring-bkl-navy" defaultChecked />
                  <span className="text-sm text-bkl-gray-dark group-hover:text-bkl-navy transition-colors">개정연혁</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-bkl-border text-bkl-navy focus:ring-bkl-navy" defaultChecked />
                  <span className="text-sm text-bkl-gray-dark group-hover:text-bkl-navy transition-colors">첨부파일(PDF)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-bkl-border text-bkl-navy focus:ring-bkl-navy" />
                  <span className="text-sm text-bkl-gray-dark group-hover:text-bkl-navy transition-colors">첨부파일(HWP)</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Monitoring Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-bkl-navy">
                <Clock className="w-5 h-5" />
                <h2 className="text-lg font-bold">실시간 진행률</h2>
              </div>
              <span className="text-2xl font-black text-bkl-navy">{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mb-4 overflow-hidden">
              <div 
                className="bg-bkl-navy h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,44,95,0.4)]"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 text-center">현재 부동산등기법 PDF 데이터 추출 중...</p>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-2 mb-4 text-bkl-navy">
              <Terminal className="w-5 h-5" />
              <h2 className="text-lg font-bold">상태 콘솔</h2>
            </div>
            <div className="console-box">
              {MOCK_LOGS.map((log, index) => (
                <div key={index} className="mb-1 last:mb-0">
                  <span className="text-emerald-500 mr-2">$</span>
                  {log}
                </div>
              ))}
              <div className="animate-pulse inline-block w-2 h-4 bg-slate-500 align-middle ml-1"></div>
            </div>
          </section>
        </div>

        {/* Results Table */}
        <section className="card overflow-hidden">
          <div className="p-6 border-b border-bkl-border bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-bkl-navy">분석 결과 목록</h2>
            <button className="text-sm text-slate-500 hover:text-bkl-navy transition-colors flex items-center gap-1">
              전체 다운로드 <Download className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-bkl-gray-dark text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">법령명</th>
                  <th className="px-6 py-4 font-semibold">공포일자</th>
                  <th className="px-6 py-4 font-semibold text-center">다운로드</th>
                  <th className="px-6 py-4 font-semibold text-center">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bkl-border">
                {MOCK_RESULTS.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-bkl-navy transition-colors" />
                        <span className="font-medium text-slate-700">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{row.date}</td>
                    <td className="px-6 py-4 text-center">
                      {row.link ? (
                        <a href={row.link} className="inline-flex items-center justify-center p-2 text-bkl-navy hover:bg-bkl-navy hover:text-white rounded-full transition-all">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3" /> 완료
                        </span>
                      )}
                      {row.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded border border-amber-100">
                          <Clock className="w-3 h-3" /> 대기
                        </span>
                      )}
                      {row.status === 'error' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100">
                          <AlertCircle className="w-3 h-3" /> 오류
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
      <footer className="bg-white border-t border-bkl-border py-6 px-8 text-center">
        <p className="text-xs text-slate-400">© 2024 Law Scapping System. Styled after BKL Legal Interface. All rights reserved.</p>
      </footer>
    </div>
  );
}
