import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

function PostDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [vulnerableView, setVulnerableView] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/posts/${id}`)
      .then(r => setPost(r.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (!post) return <p>게시글을 찾을 수 없습니다.</p>;

  return (
    <div>
      <Link to="/posts" style={{ color: '#666', textDecoration: 'none', fontSize: 14 }}>
        &larr; 목록으로
      </Link>

      <div className="card" style={{ marginTop: 12 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>{post.title}</h1>
        <p style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>
          조회 {post.view_count} &middot; {new Date(post.created_at).toLocaleString('ko-KR')}
        </p>

        {/* Rendering mode toggle */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${!vulnerableView ? 'btn-success' : ''}`}
            style={!vulnerableView ? {} : { background: '#e0e0e0', color: '#333' }}
            onClick={() => setVulnerableView(false)}
          >
            Safe View (Text)
          </button>
          <button
            className={`btn btn-sm ${vulnerableView ? 'btn-danger' : ''}`}
            style={vulnerableView ? {} : { background: '#e0e0e0', color: '#333' }}
            onClick={() => setVulnerableView(true)}
          >
            Vulnerable View (HTML)
          </button>
        </div>

        {vulnerableView ? (
          <div className="xss-demo">
            <h4>Vulnerable Rendering (dangerouslySetInnerHTML)</h4>
            <p style={{ fontSize: 12, color: '#e65100', marginBottom: 8 }}>
              HTML이 그대로 렌더링됩니다. XSS 페이로드가 실행될 수 있습니다.
            </p>
            <div
              style={{ background: '#fff', padding: 12, borderRadius: 4, border: '1px solid #ddd' }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {post.content_safe || post.content}
          </div>
        )}
      </div>

      {/* Raw content inspection */}
      <div className="card">
        <h2>Raw Content (개발자 확인용)</h2>
        <div className="code-block">{post.content}</div>
      </div>
    </div>
  );
}

export default PostDetail;
