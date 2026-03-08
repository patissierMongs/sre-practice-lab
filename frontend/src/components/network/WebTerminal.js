import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useTerminalWebSocket } from './useTrafficWebSocket';

const THEMES = {
  red: {
    background: '#1a0000',
    foreground: '#ff8a80',
    cursor: '#ff5252',
    cursorAccent: '#1a0000',
    selectionBackground: '#4a1010',
    black: '#1a0000',
    red: '#ff5252',
    green: '#ff8a80',
    yellow: '#ffab40',
    blue: '#ff6e40',
    magenta: '#ff4081',
    cyan: '#ff8a65',
    white: '#ffccbc',
  },
  blue: {
    background: '#001027',
    foreground: '#82b1ff',
    cursor: '#448aff',
    cursorAccent: '#001027',
    selectionBackground: '#0d3b66',
    black: '#001027',
    red: '#ff8a80',
    green: '#69f0ae',
    yellow: '#ffd740',
    blue: '#448aff',
    magenta: '#b388ff',
    cyan: '#18ffff',
    white: '#e3f2fd',
  },
};

function WebTerminal({ team = 'red', onCommandGenerated }) {
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const { connect, sendInput, sendCommand, sendResize, disconnect, connected } = useTerminalWebSocket(team);
  const [mode, setMode] = useState('terminal');

  useEffect(() => {
    if (!termRef.current || xtermRef.current) return;

    const term = new Terminal({
      theme: THEMES[team] || THEMES.red,
      fontSize: 13,
      fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);

    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      sendInput(data);
    });

    connect((output) => {
      term.write(output);
    });

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        if (xtermRef.current) {
          sendResize(xtermRef.current.cols, xtermRef.current.rows);
        }
      }
    };
    window.addEventListener('resize', handleResize);

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

  useEffect(() => {
    if (onCommandGenerated) {
      onCommandGenerated.current = (cmd) => {
        if (mode === 'bypass') {
          sendCommand(cmd);
        } else {
          if (xtermRef.current) {
            xtermRef.current.write('\r\n\x1b[33m# Copy and run the command below:\x1b[0m\r\n');
            cmd.split('\n').forEach(line => {
              xtermRef.current.write(`\x1b[36m${line}\x1b[0m\r\n`);
            });
          }
        }
      };
    }
  }, [mode, sendCommand, onCommandGenerated]);

  const teamLabel = team === 'red' ? 'RED TEAM' : 'BLUE TEAM';
  const teamClass = team === 'red' ? 'team-red' : 'team-blue';

  return (
    <div className={`web-terminal ${teamClass}`}>
      <div className={`terminal-toolbar ${teamClass}`}>
        <div className="terminal-team-badge">
          <span className={`team-icon ${teamClass}`}>{team === 'red' ? '🗡️' : '🛡️'}</span>
          <span className={`team-label ${teamClass}`}>{teamLabel}</span>
        </div>

        <div className="terminal-status">
          <span className={`terminal-dot ${connected ? 'connected' : ''}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>

        <div className="terminal-mode-switch">
          <button
            className={`mode-btn ${mode === 'terminal' ? 'active' : ''}`}
            onClick={() => setMode('terminal')}
            title="Terminal mode: type commands directly"
          >
            Terminal
          </button>
          <button
            className={`mode-btn ${mode === 'bypass' ? 'active' : ''}`}
            onClick={() => setMode('bypass')}
            title="Bypass mode: buttons auto-execute in terminal"
          >
            Bypass
          </button>
        </div>

        <div className="terminal-hints">
          {team === 'red'
            ? 'Attack: nmap, hping3, nikto, curl...'
            : 'Defend: tcpdump, iptables, ss, strace...'}
        </div>
      </div>

      <div className="terminal-container" ref={termRef} />
    </div>
  );
}

export default WebTerminal;
