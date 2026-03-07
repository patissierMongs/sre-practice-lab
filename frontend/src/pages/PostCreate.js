import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function PostCreate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [security, setSecurity] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/security/').then(r => setSecurity(r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post('/posts/', { title, content });
      navigate(`/posts/${res.data.id}`);
    } catch (err) {
      alert('게시글 작성 실패: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const xssExamples = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror="alert(\'XSS\')">',
    '<div onmouseover="alert(\'XSS\')">Hover me</div>',
    '<a href="javascript:alert(\'XSS\')">Click me</a>',
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>새 게시글 작성</h1>

      <div className={`alert ${security?.xss_protection ? 'alert-info' : 'alert-warning'}`}>
        XSS Protection: {security?.xss_protection
          ? 'ON - 입력이 서버에서 sanitize됩니다'
          : 'OFF - 입력이 그대로 저장됩니다 (취약 모드)'}
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label style={{ fontWeight: 600, fontSize: 14 }}>제목</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="게시글 제목"
          />

          <label style={{ fontWeight: 600, fontSize: 14 }}>내용</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="게시글 내용을 입력하세요. XSS 테스트를 위해 HTML/스크립트를 입력할 수 있습니다."
          />

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '작성 중...' : '게시글 작성'}
          </button>
        </form>
      </div>

      {/* XSS payload examples */}
      <div className="card">
        <h2>XSS Test Payloads (실습용)</h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          아래 페이로드를 복사해서 게시글에 입력해보세요. Vulnerable View에서 실행됩니다.
        </p>
        {xssExamples.map((payload, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div className="code-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <code>{payload}</code>
              <button
                className="btn btn-sm btn-warning"
                onClick={() => setContent(payload)}
                style={{ marginLeft: 8, flexShrink: 0 }}
              >
                사용
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PostCreate;
