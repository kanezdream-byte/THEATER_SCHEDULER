import React, { useState, useEffect, useRef } from 'react';
import { Settings, Volume2, VolumeX, Play, Film, Clock, Monitor, Bell, BellOff, ChevronDown, ChevronUp } from 'lucide-react';

// 초기 기본 데이터 (사용자가 제공한 샘플)
const DEFAULT_DATA = `관	입장	광고	본영화	등급		관	퇴장	엔딩	영화
1	9:20	9:27	9:40	12					왕과 사는 남자(2D)
3	9:20	9:27	9:40	15					첨밀밀(디지털)
4	9:50	9:57	10:10	12					프로젝트 헤일메리(디지털)
2	10:20	10:28	10:40	12					왕과 사는 남자(2D)
						1	11:37	11:32	왕과 사는 남자(2D)
						3	11:36	11:34	첨밀밀(디지털)`;

export default function App() {
  const [view, setView] = useState('input'); // 'input' | 'board'
  const [rawData, setRawData] = useState(DEFAULT_DATA);
  const [sessions, setSessions] = useState([]); // events 대신 sessions(묶음)로 관리
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioCtx, setAudioCtx] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alarmedEvents, setAlarmedEvents] = useState(new Set());
  const [warningMinutes, setWarningMinutes] = useState(10); // 추가: 예고 시간 설정(분)
  const [showPast, setShowPast] = useState(false); // 추가: 종료된 상영 숨김/표시 상태
  const [alarmDuration, setAlarmDuration] = useState(60); // 추가: 알람 지속 시간(초)
  const [activeAlarms, setActiveAlarms] = useState([]); // 추가: 현재 화면에 표시할 활성 알람 목록
  const [nativeNotificationEnabled, setNativeNotificationEnabled] = useState(false); // 추가: 윈도우(OS) 알림 사용 여부

  // 테스트 알람용 Ref
  const monitorClickCount = useRef(0);
  const monitorClickTimer = useRef(null);

  // 현재 시간(HH:MM) 문자열 반환
  const getCurrentHHMM = (date) => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 실시간 시계 업데이트 및 알람 체크
  useEffect(() => {
    if (view !== 'board') return;

    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkAlarms(now);
    }, 1000);

    return () => clearInterval(interval);
  }, [view, sessions, audioCtx, soundEnabled, nativeNotificationEnabled]);

  // 알람 로직
  const checkAlarms = (now) => {
    const currentHHMM = getCurrentHHMM(now);
    const newAlarms = [];
    
    sessions.forEach(session => {
      session.events.forEach(event => {
        // 이벤트 시간과 현재 시간이 일치하고, 아직 알람이 울리지 않았다면
        if (event.time === currentHHMM && !alarmedEvents.has(event.uniqueId)) {
          // 세션의 알람이 켜져 있을 때만 알람 목록에 추가
          if (session.alarmEnabled) {
            newAlarms.push({
              id: event.uniqueId,
              movie: session.movie,
              screen: session.screen,
              type: event.type,
              time: event.time
            });

            // 윈도우 OS 시스템 알람 트리거
            if (nativeNotificationEnabled && Notification.permission === "granted") {
              new Notification(`[${event.type}] ${session.movie}`, {
                body: `${session.screen}관 - ${event.time}`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3163/3163478.png' // 영화 관련 기본 아이콘
              });
            }
          }
          setAlarmedEvents(prev => new Set(prev).add(event.uniqueId));
        }
      });
    });

    if (newAlarms.length > 0) {
      // 새로운 알람들을 활성 상태로 등록
      setActiveAlarms(prev => [...prev, ...newAlarms]);

      // 설정된 지속 시간(초)이 지나면 자동으로 알람 종료
      setTimeout(() => {
        setActiveAlarms(prev => prev.filter(a => !newAlarms.find(na => na.id === a.id)));
      }, alarmDuration * 1000);
    }
  };

  // 알람 소리 반복 재생 효과
  useEffect(() => {
    if (activeAlarms.length === 0 || !soundEnabled || !audioCtx) return;

    // 즉시 한 번 재생
    triggerAlarm(audioCtx);

    // 알람이 활성화되어 있는 동안 3초 간격으로 소리 반복
    const intervalId = setInterval(() => {
      triggerAlarm(audioCtx);
    }, 3000);

    return () => clearInterval(intervalId); // 알람이 종료되면 소리도 정지
  }, [activeAlarms, soundEnabled, audioCtx]);

  // 알람 수동 종료 핸들러 (사용자가 화면 클릭 시)
  const dismissAlarm = (id) => {
    setActiveAlarms(prev => prev.filter(a => a.id !== id));
  };

  // 모니터 아이콘 3회 클릭 시 테스트 알람 트리거
  const handleMonitorClick = () => {
    monitorClickCount.current += 1;
    if (monitorClickTimer.current) clearTimeout(monitorClickTimer.current);

    // 3번 이상 클릭 시 알람 발생
    if (monitorClickCount.current >= 3) {
      const testAlarm = {
        id: `test-${Date.now()}`,
        movie: "시스템 테스트 알람",
        screen: "TEST",
        type: "테스트",
        time: getCurrentHHMM(new Date())
      };
      
      setActiveAlarms(prev => [...prev, testAlarm]);

      // 윈도우 OS 시스템 알람 테스트 트리거
      if (nativeNotificationEnabled && Notification.permission === "granted") {
        new Notification(`[테스트] 시스템 테스트 알람`, {
          body: `TEST관 - ${testAlarm.time}`,
          icon: 'https://cdn-icons-png.flaticon.com/512/3163/3163478.png'
        });
      }
      
      // 설정된 알람 지속 시간 후 자동 종료
      setTimeout(() => {
        setActiveAlarms(prev => prev.filter(a => a.id !== testAlarm.id));
      }, alarmDuration * 1000);

      monitorClickCount.current = 0; // 카운트 초기화
    } else {
      // 1초 내에 3번 클릭하지 않으면 카운트 리셋
      monitorClickTimer.current = setTimeout(() => {
        monitorClickCount.current = 0;
      }, 1000); 
    }
  };

  // 윈도우 네이티브 알림 권한 요청 및 토글 핸들러
  const handleNativeNotificationToggle = async (e) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      if (!("Notification" in window)) {
        alert("현재 사용 중인 브라우저에서는 시스템(OS) 알림을 지원하지 않습니다.");
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNativeNotificationEnabled(true);
      } else {
        alert("알림 권한이 거부되었습니다. 브라우저 주소창 좌측의 자물쇠 아이콘을 눌러 알림을 허용해주세요.");
        setNativeNotificationEnabled(false);
      }
    } else {
      setNativeNotificationEnabled(false);
    }
  };

  // 극장 영업일 기준(06:00 ~ 익일 05:59) 상대적 분 단위 계산 헬퍼 함수
  // 06:00 -> 0분 / 23:59 -> 1079분 / 00:00 -> 1080분 / 05:59 -> 1439분
  const getRelativeMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    let mins = h * 60 + m;
    
    // 새벽 시간대(00:00 ~ 05:59)는 영업일 기준 다음 날이므로 24시간(1440분)을 더해 뒤로 보냄
    if (mins < 360) {
      mins += 1440;
    }
    
    // 06:00(360분)을 0기준으로 맞춤
    return mins - 360; 
  };

  // 비프음 생성 (Web Audio API)
  const triggerAlarm = (ctx) => {
    if (ctx.state === 'suspended') ctx.resume();

    const playBeep = (timeOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime + timeOffset);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + 0.3);
      
      osc.start(ctx.currentTime + timeOffset);
      osc.stop(ctx.currentTime + timeOffset + 0.3);
    };

    // 3번 연속 비프음
    playBeep(0);
    playBeep(0.4);
    playBeep(0.8);
  };

  // 데이터 파싱 함수 (세션 단위 그룹화)
  const parseData = () => {
    const lines = rawData.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split('\t').map(h => h.trim());
    const idx = {
      screen1: headers.indexOf('관') !== -1 ? headers.indexOf('관') : 0,
      entry: headers.indexOf('입장') !== -1 ? headers.indexOf('입장') : 1,
      ad: headers.indexOf('광고') !== -1 ? headers.indexOf('광고') : 2,
      feature: headers.indexOf('본영화') !== -1 ? headers.indexOf('본영화') : 3,
      screen2: headers.lastIndexOf('관') !== -1 && headers.lastIndexOf('관') !== headers.indexOf('관') ? headers.lastIndexOf('관') : 6,
      exit: headers.indexOf('퇴장') !== -1 ? headers.indexOf('퇴장') : 7,
      ending: headers.indexOf('엔딩') !== -1 ? headers.indexOf('엔딩') : 8,
      movie: headers.indexOf('영화') !== -1 ? headers.indexOf('영화') : 9,
    };

    let parsedSessions = [];
    let eventIdCounter = 0;
    let sessionIdCounter = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t').map(c => c.trim());
      if (cols.length === 0 || cols.every(c => !c)) continue;

      const screen = cols[idx.screen1] || cols[idx.screen2] || "-";
      let movie = cols[idx.movie];
      
      if (!movie) {
        for(let j = cols.length - 1; j >= 0; j--) {
          if(cols[j] && !cols[j].match(/^\d{1,2}:\d{2}$/)) {
            movie = cols[j];
            break;
          }
        }
      }
      if (!movie) movie = "Unknown";

      let sessionEvents = [];

      const addEvent = (colIndex, type) => {
        const timeVal = cols[colIndex];
        if (timeVal && timeVal.match(/^\d{1,2}:\d{2}$/)) {
          const [h, m] = timeVal.split(':');
          const paddedTime = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
          sessionEvents.push({
            uniqueId: `evt-${eventIdCounter++}`,
            time: paddedTime,
            type
          });
        }
      };

      // 한 줄(세션) 안에 있는 이벤트들을 모두 수집
      addEvent(idx.entry, '입장');
      addEvent(idx.ad, '광고');
      addEvent(idx.feature, '본영화');
      addEvent(idx.ending, '엔딩');
      addEvent(idx.exit, '퇴장');

      // 시간순 정렬 (극장 영업시간 기준 정렬로 변경) 후 세션으로 묶기
      if (sessionEvents.length > 0) {
        sessionEvents.sort((a, b) => getRelativeMinutes(a.time) - getRelativeMinutes(b.time));
        parsedSessions.push({
          id: `session-${sessionIdCounter++}`,
          screen,
          movie,
          events: sessionEvents,
          alarmEnabled: true
        });
      }
    }

    // 첫 번째 이벤트의 시간을 기준으로 전체 세션 정렬 (극장 영업시간 기준)
    parsedSessions.sort((a, b) => getRelativeMinutes(a.events[0].time) - getRelativeMinutes(b.events[0].time));
    setSessions(parsedSessions);
  };

  // 전광판 시작 버튼 핸들러
  const handleStart = () => {
    parseData();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    setAudioCtx(ctx);
    setView('board');
    setAlarmedEvents(new Set());
  };

  // 세션 단위 알람 토글 핸들러
  const toggleSessionAlarm = (id) => {
    setSessions(sessions.map(s => s.id === id ? { ...s, alarmEnabled: !s.alarmEnabled } : s));
  };

  // 타입별 색상 및 스타일 지정
  const getTypeStyle = (type) => {
    switch(type) {
      case '본영화': return { badge: 'text-amber-400 border-amber-400 font-bold bg-amber-400/10', time: 'text-[#ffcc00] bg-[#000] airport-glow border border-[#222]' };
      case '퇴장': return { badge: 'text-red-400 border-red-400 font-bold bg-red-400/10', time: 'text-[#f87171] bg-[#000] airport-glow border border-[#222]' };
      case '입장': 
      case '광고': 
      case '엔딩': 
        return { badge: 'text-gray-500 border-gray-700', time: 'text-[#888] bg-transparent border border-transparent' };
      default: return { badge: 'text-gray-500 border-gray-700', time: 'text-[#888] bg-transparent border border-transparent' };
    }
  };

  // 1. 입력 화면 (설정 모드)
  if (view === 'input') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-mulmaru">
        <style>{`
          @font-face {
              font-family: 'Mulmaru';
              src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2601-4@1.1/Mulmaru.woff2') format('woff2');
              font-weight: normal;
              font-display: swap;
          }
          .font-mulmaru {
              font-family: 'Mulmaru', sans-serif !important;
          }
        `}</style>
        <div className="max-w-4xl mx-auto">
          <header className="flex items-center gap-3 mb-8">
            <Film className="w-10 h-10 text-amber-400" />
            <h1 className="text-3xl font-bold tracking-tight">영화관 시간표 설정</h1>
          </header>
          
          <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
            <label className="block text-sm font-medium text-amber-400 mb-2">
              엑셀 데이터를 아래에 붙여넣어 주세요
            </label>
            <textarea
              className="w-full h-80 bg-slate-950 border border-slate-700 rounded-lg p-4 font-mulmaru text-sm text-slate-300 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors whitespace-pre"
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              placeholder="관\t입장\t광고\t본영화\t등급\t\t관\t퇴장\t엔딩\t영화"
            />
            
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-6 border-t border-slate-700 pt-6">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-300">예고 표시 (분 전):</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="60"
                    value={warningMinutes}
                    onChange={(e) => setWarningMinutes(Number(e.target.value))}
                    className="w-20 bg-slate-950 border border-slate-600 rounded p-2 text-center text-amber-400 font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-300">알람 지속 시간 (초):</label>
                  <input 
                    type="number" 
                    min="5" 
                    max="300"
                    value={alarmDuration}
                    onChange={(e) => setAlarmDuration(Number(e.target.value))}
                    className="w-20 bg-slate-950 border border-slate-600 rounded p-2 text-center text-amber-400 font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-amber-400 flex items-center gap-2 cursor-pointer font-bold bg-amber-900/30 px-3 py-2 rounded border border-amber-900/50 hover:bg-amber-900/50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={nativeNotificationEnabled}
                      onChange={handleNativeNotificationToggle}
                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                    />
                    윈도우(OS) 기본 알림 사용
                  </label>
                </div>
              </div>
              <button
                onClick={handleStart}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 px-6 rounded-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
              >
                <Play className="w-5 h-5" />
                전광판 시작하기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. 전광판 화면 (Board 모드)
  const currentHHMM = getCurrentHHMM(currentTime);

  return (
    <div className="min-h-screen bg-[#050505] text-[#ffcc00] font-mulmaru p-4 sm:p-8 selection:bg-amber-900 overflow-hidden">
      {/* 글로벌 글로우 효과를 위한 스타일 */}
      <style>{`
        @font-face {
            font-family: 'Mulmaru';
            src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2601-4@1.1/Mulmaru.woff2') format('woff2');
            font-weight: normal;
            font-display: swap;
        }
        .font-mulmaru {
            font-family: 'Mulmaru', sans-serif !important;
        }
        .airport-glow { text-shadow: 0 0 10px rgba(255, 204, 0, 0.4); }
        .blink-now { animation: blink 1.5s infinite; }
        .blink-warning { animation: blink-warn 2s infinite; }
        .alarm-glow { animation: alarm-glow 1.5s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; text-shadow: 0 0 15px rgba(239, 68, 68, 0.8); } 50% { opacity: 0.5; text-shadow: none; } }
        @keyframes blink-warn { 0%, 100% { opacity: 1; text-shadow: 0 0 10px rgba(251, 146, 60, 0.8); } 50% { opacity: 0.6; text-shadow: none; } }
        @keyframes alarm-glow { 0%, 100% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.6); border-color: rgba(239,68,68,1); } 50% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); border-color: rgba(239,68,68,0.5); } }
      `}</style>

      {/* 헤더 섹션 */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b-2 border-[#ffcc00] pb-6">
        <div className="flex items-center gap-4 mb-4 md:mb-0">
          <Monitor 
            className="w-10 h-10 airport-glow cursor-pointer hover:scale-110 active:scale-95 transition-transform" 
            onClick={handleMonitorClick}
            title="3번 연속 클릭하여 알람 테스트"
          />
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-[0.2em] airport-glow">THEATER SCHEDULER</h1>
            <p className="text-[#888] tracking-widest text-sm mt-1">DEPARTURES & ARRIVALS</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-2xl sm:text-4xl font-bold airport-glow tracking-widest bg-[#111] px-4 py-2 rounded-lg border border-[#333]">
            <Clock className="w-8 h-8" />
            {currentHHMM}
            <span className="text-sm text-[#666] animate-pulse">
              :{String(currentTime.getSeconds()).padStart(2, '0')}
            </span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-3 rounded-lg border ${soundEnabled ? 'border-[#ffcc00] bg-[#1a1a00]' : 'border-[#444] text-[#666]'} hover:bg-[#332a00] transition-colors`}
              title="알람 소리 토글"
            >
              {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => setView('input')}
              className="p-3 rounded-lg border border-[#444] hover:border-[#ffcc00] hover:bg-[#1a1a00] transition-colors"
              title="설정으로 돌아가기"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* 전광판 테이블 */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#222] overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#111] text-[#888] text-sm tracking-widest">
                <th className="px-6 py-4 font-normal">ALARM</th>
                <th className="px-6 py-4 font-normal">TIME</th>
                <th className="px-6 py-4 font-normal">SCREEN</th>
                <th className="px-6 py-4 font-normal">CURRENT STAGE</th>
                <th className="px-6 py-4 font-normal">MOVIE TITLE</th>
                <th className="px-6 py-4 font-normal text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {(() => {
                // 상단에 띄울 '종료된 상영 갯수' 계산 (상대 시간 기준)
                const currentRelativeMins = getRelativeMinutes(currentHHMM);
                const pastCount = sessions.filter(session => {
                  const lastEvent = session.events[session.events.length - 1];
                  const diff = getRelativeMinutes(lastEvent.time) - currentRelativeMins;
                  return diff < 0; // 복잡한 자정 예외처리 없이 단순 비교 가능
                }).length;

                if (pastCount === 0) return null;

                return (
                  <tr 
                    className="bg-[#0a0a0a] hover:bg-[#111] cursor-pointer transition-colors"
                    onClick={() => setShowPast(!showPast)}
                  >
                    <td colSpan="6" className="px-6 py-3 text-center text-[#666] text-sm tracking-widest border-b border-[#222]">
                      <div className="flex items-center justify-center gap-2">
                        {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        종료된 상영 {pastCount}건 {showPast ? '접기' : '펼치기'}
                      </div>
                    </td>
                  </tr>
                );
              })()}
              {sessions.map((session) => {
                const currentRelativeMins = getRelativeMinutes(currentHHMM);
                
                // 시간 흐름에 따라 보여줄 이벤트를 동적으로 선택
                let displayEvent = session.events[0]; // 기본은 첫 이벤트
                
                // 현재 시간보다 과거이거나 지금인 이벤트들 필터링
                const pastOrNowEvents = session.events.filter(e => getRelativeMinutes(e.time) <= currentRelativeMins);
                
                // 해당되는 이벤트가 있다면, 그 중 가장 최근(마지막) 이벤트를 활성 상태로 표시
                if (pastOrNowEvents.length > 0) {
                  displayEvent = pastOrNowEvents[pastOrNowEvents.length - 1];
                }

                const eventRelativeMins = getRelativeMinutes(displayEvent.time);
                const diff = eventRelativeMins - currentRelativeMins; 
                // 이제 diff는 -720 같은 예외 처리 없이 언제나 직관적인 분(Minutes) 차이를 나타냅니다.

                // 현재 보여지는 이벤트가 세션의 마지막 이벤트인지 확인
                const isLastEvent = session.events[session.events.length - 1].uniqueId === displayEvent.uniqueId;
                
                // 상태 판별
                const isPast = diff < 0 && isLastEvent;         // 모든 일정이 끝남

                // 숨김 처리 로직: 종료된 상영이고, 접기 상태라면 렌더링하지 않음
                if (isPast && !showPast) return null;

                const isNow = diff === 0;                       // 딱 정각
                const isSoon = diff > 0 && diff <= warningMinutes; // 곧 시작
                const isOngoing = diff < 0 && !isLastEvent;     // 다음 단계 대기 중 (진행 중)
                
                const isMain = displayEvent.type === '본영화' || displayEvent.type === '퇴장';
                const style = getTypeStyle(displayEvent.type);

                // 상태에 따른 배경 및 텍스트 스타일 적용
                let rowClass = "hover:bg-[#111]";
                if (isNow) rowClass = "bg-[#2a1111]";
                else if (isSoon) rowClass = "bg-[#1a1505]";
                else if (isOngoing) rowClass = "bg-[#0a1520]"; // 진행 중일 때 은은한 푸른빛
                else if (isPast) rowClass = "opacity-40 hover:opacity-100";

                const textClass = (isMain || isOngoing || isNow) ? 'text-white' : 'text-[#888]';

                return (
                  <tr 
                    key={session.id} 
                    className={`transition-colors duration-500 ${rowClass} ${textClass}`}
                  >
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleSessionAlarm(session.id)}
                        className={`p-2 rounded-full border transition-colors ${
                          session.alarmEnabled 
                            ? 'border-[#ffcc00] text-[#ffcc00] hover:bg-[#332a00]' 
                            : 'border-[#444] text-[#555] hover:border-[#666]'
                        }`}
                        title={session.alarmEnabled ? "알람 끄기" : "알람 켜기"}
                      >
                        {session.alarmEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold tracking-wider px-2 py-1 rounded text-xl ${style.time}`}>
                        {displayEvent.time}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 bg-[#1a1a1a] rounded text-lg ${isMain ? 'text-[#ddd] font-bold' : 'text-[#888]'}`}>
                        {session.screen}관
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 border rounded whitespace-nowrap text-sm ${style.badge}`}>
                        {displayEvent.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 w-full">
                      <span className={`tracking-wide text-lg ${isMain ? 'text-white font-bold' : 'text-[#888] opacity-80'}`}>
                        {session.movie}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isNow ? (
                        <span className="text-red-500 font-bold tracking-widest blink-now text-xl">
                          NOW
                        </span>
                      ) : isSoon ? (
                        <span className="text-orange-400 font-bold tracking-widest blink-warning text-lg">
                          SOON ({diff}M)
                        </span>
                      ) : isOngoing ? (
                        <span className="text-blue-400 font-bold tracking-widest opacity-90">
                          ONGOING
                        </span>
                      ) : isPast ? (
                        <span className="text-[#555] font-bold tracking-widest">
                          PAST
                        </span>
                      ) : (
                        <span className="text-green-500 font-bold tracking-widest opacity-80">
                          UPCOMING
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {sessions.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-[#555] tracking-widest">
                    NO SCHEDULED EVENTS
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 활성화된 알람 오버레이 (팝업) */}
      {activeAlarms.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="flex flex-col gap-6 max-h-screen overflow-y-auto w-full max-w-2xl py-8">
            {activeAlarms.map(alarm => (
              <button
                key={alarm.id}
                onClick={() => dismissAlarm(alarm.id)}
                className="bg-[#1a0505] border-2 rounded-2xl p-8 transform transition-transform hover:scale-[1.02] active:scale-95 text-center cursor-pointer alarm-glow flex flex-col items-center group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-600/10 group-hover:bg-red-600/20 transition-colors pointer-events-none" />
                
                <div className="text-red-500 font-bold tracking-widest mb-4 flex justify-center items-center gap-3 text-2xl">
                  <Bell className="w-8 h-8 animate-bounce" /> 
                  <span>ALARM - {alarm.type}</span>
                </div>
                
                <div className="text-5xl text-white font-black tracking-wider mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                  {alarm.movie}
                </div>
                
                <div className="text-2xl text-[#ccc] mb-8 font-mulmaru bg-black/50 px-6 py-2 rounded-lg border border-[#333]">
                  {alarm.screen}관 <span className="mx-3 text-[#555]">|</span> {alarm.time}
                </div>
                
                <div className="text-lg text-red-200 bg-red-900/40 border border-red-500/30 py-2 px-6 rounded-full inline-block group-hover:bg-red-500 group-hover:text-white transition-colors">
                  클릭하여 알람 종료
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
    </div>
  );
}