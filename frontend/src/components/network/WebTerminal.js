import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTerminalWebSocket } from './useTrafficWebSocket';

function WebTerminal({ onCommandGenerated }) {
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const { connect, sendInput, sendCommand, sendResize, disconnect, connected } = useTerminalWebSocket();
  const [mode, setMode] = useState('terminal'); // 'terminal' or 'bypass'

  useEffect(() => {
    if (!termRef.current || xtermRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d353',
        white: '#c9d1d9',
      },
      fontSize: 13,
      fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);

    // 약간의 딜레이 후 fit 호출
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // 키 입력을 WebSocket으로 전송
    term.onData((data) => {
      sendInput(data);
    });

    // WebSocket 연결
    connect((output) => {
      term.write(output);
    });

    // 리사이즈 핸들러
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        if (xtermRef.current) {
          sendResize(xtermRef.current.cols, xtermRef.current.rows);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    // 리사이즈 이벤트
    term.onResize(({ cols, rows }) => {
      sendResize(cols, rows);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      disconnect();
      term.dispose();
      xtermRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 외부에서 명령어 전송 (바이패스 모드)
  useEffect(() => {
    if (onCommandGenerated) {
      onCommandGenerated.current = (cmd) => {
        if (mode === 'bypass') {
          // 바이패스 모드: 명령어를 터미널에 자동 입력
          sendCommand(cmd);
        } else {
          // 터미널 모드: 명령어를 터미널에 표시만 (사용자가 직접 실행)
          if (xtermRef.current) {
            xtermRef.current.write('\r\n\x1b[33m# 아래 명령어를 복사하여 실행하세요:\x1b[0m\r\n');
            cmd.split('\n').forEach(line => {
              xtermRef.current.write(`\x1b[36m${line}\x1b[0m\r\n`);
            });
          }
        }
      };
    }
  }, [mode, sendCommand, onCommandGenerated]);

  return (
    <div className="web-terminal">
      <div className="terminal-toolbar">
        <div className="terminal-status">
          <span className={`terminal-dot ${connected ? 'connected' : ''}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>

        <div className="terminal-mode-switch">
          <button
            className={`mode-btn ${mode === 'terminal' ? 'active' : ''}`}
            onClick={() => setMode('terminal')}
            title="터미널 모드: 직접 명령어 입력"
          >
            ⌨️ Terminal
          </button>
          <button
            className={`mode-btn ${mode === 'bypass' ? 'active' : ''}`}
            onClick={() => setMode('bypass')}
            title="바이패스 모드: 버튼 클릭 시 자동 실행"
          >
            ⚡ Bypass
          </button>
        </div>

        <div className="terminal-hints">
          {mode === 'terminal'
            ? '직접 명령어를 입력하세요 (curl, httpx, nmap...)'
            : '버튼 클릭 시 터미널에 자동 입력됩니다'}
        </div>
      </div>

      <div className="terminal-container" ref={termRef} />
    </div>
  );
}

export default WebTerminal;
