import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function PostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/posts/')
      .then(r => setPosts(r.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>게시판</h1>
        <Link to="/posts/new" className="btn btn-primary">새 글 작성</Link>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : posts.length === 0 ? (
        <div className="card">
          <p style={{ color: '#999', textAlign: 'center' }}>
            아직 게시글이 없습니다. 첫 글을 작성해보세요!
          </p>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>제목</th>
                <th>조회</th>
                <th>작성일</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id}>
                  <td>{post.id}</td>
                  <td>
                    <Link to={`/posts/${post.id}`} style={{ color: '#0066ff', textDecoration: 'none' }}>
                      {post.title}
                    </Link>
                  </td>
                  <td>{post.view_count}</td>
                  <td>{new Date(post.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PostList;
