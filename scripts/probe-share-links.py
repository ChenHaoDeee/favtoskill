"""One-shot public HTTP inspection of the three user-supplied links.
No login, cookies, private platform APIs, JS execution or access-control workarounds.
Not a production URL importer (production needs DNS/IP-level SSRF controls).
"""
import concurrent.futures
import json
import pathlib
import urllib.request
import urllib.error
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin

URLS = [
    ('xiaohongshu', 'https://xhslink.cn/o/AWxtf213Y0g'),
    ('douyin', 'https://v.douyin.com/NoX2_i23Aqw/'),
    ('bilibili', 'https://b23.tv/V1UJ7co'),
]
ALLOWED = ('xhslink.cn', 'xiaohongshu.com', 'douyin.com', 'iesdouyin.com', 'b23.tv', 'bilibili.com')

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.title = ''
        self.meta = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title': self.in_title = True
        if tag == 'meta':
            key = attrs.get('property') or attrs.get('name')
            if key in ('description', 'og:title', 'og:description', 'og:image', 'og:url', 'keywords'):
                self.meta[key] = attrs.get('content', '')[:2000]
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
    def handle_data(self, data):
        if self.in_title: self.title += data

class Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self): self.chain = []
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        newurl = urljoin(req.full_url, newurl)
        parsed = urlparse(newurl)
        if parsed.scheme != 'https' or not any(parsed.hostname == host or (parsed.hostname or '').endswith('.' + host) for host in ALLOWED):
            raise ValueError('Redirect outside the expected HTTPS platform domains')
        self.chain.append({'status': code, 'from': req.full_url, 'to': newurl})
        if len(self.chain) > 6: raise ValueError('Too many redirects')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def probe(pair):
    platform, url = pair
    redirects = Redirects()
    result = {'platform': platform, 'input_url': url, 'redirects': redirects.chain}
    opener = urllib.request.build_opener(redirects)
    req = urllib.request.Request(url, headers={'User-Agent': 'FavToSkill-LinkProbe/0.1', 'Accept': 'text/html'})
    try:
        try: response = opener.open(req, timeout=20)
        except urllib.error.HTTPError as error: response = error
        with response:
            raw = response.read(512000)
            encoding = response.headers.get_content_charset() or 'utf-8'
            html = raw.decode(encoding, errors='replace')
            metadata = Metadata()
            metadata.feed(html)
            result.update(status=response.status, final_url=response.geturl(), bytes_read=len(raw),
                          content_type=response.headers.get('Content-Type'), title=metadata.title.strip(), meta=metadata.meta)
            result['access_markers'] = [marker for marker in ['验证码', '访问受限', '安全验证', '登录后', '412 Precondition', '系统异常', '访问异常'] if marker in html]
            result['body_parsed'] = False
    except Exception as error:
        result['error'] = f'{type(error).__name__}: {error}'
    return result

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(probe, URLS))
    output = pathlib.Path('artifacts/link-probe-2026-10-18.json')
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    for item in results:
        # Keep tokenized redirect queries out of terminal logs.
        display = {key: value for key, value in item.items() if key not in ('redirects', 'final_url', 'meta')}
        display['final_path'] = (item.get('final_url') or '').split('?')[0]
        display['meta_fields'] = list(item.get('meta', {}))
        print(json.dumps(display, ensure_ascii=False))
