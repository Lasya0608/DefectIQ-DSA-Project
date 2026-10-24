"""Zero-dependency local HTTP server for the manufacturing DST dashboard."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import csv
import io
import json
from datetime import date, timedelta
from dst import DefectAnalyzer

ROOT = Path(__file__).resolve().parent
MAX_RECORDS = 100_000

def sample_records():
    names = ['Automobile', 'Electronics']
    rows = []
    for i in range(42):
        rows.append({'date': str(date(2026, 9, 1) + timedelta(days=i // 3)),
                     'shift': ['Morning', 'Evening', 'Night'][i % 3],
                     'line': names[(i // 3) % 2],
                     'inspected': 180 + (i * 19) % 110,
                     'defects': 3 + (i * 7 + (i // 5) * 3) % 29})
    return rows

records = sample_records()
analyzer = DefectAnalyzer(records)

def parse_records(csv_text):
    reader = csv.DictReader(io.StringIO(csv_text, newline=''))
    required = {'date', 'shift', 'line', 'inspected', 'defects'}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise ValueError('CSV columns required: date,shift,line,inspected,defects')
    output = []
    for index, row in enumerate(reader, start=2):
        try:
            inspected = int(row['inspected'])
            defects = int(row['defects'])
            if inspected <= 0 or defects < 0 or defects > inspected:
                raise ValueError()
            dt = date.fromisoformat(row['date'].strip())
            shift, line = row['shift'].strip(), row['line'].strip()
            if not shift or not line:
                raise ValueError()
        except (TypeError, ValueError):
            raise ValueError(f'Invalid data on CSV row {index}; date must be YYYY-MM-DD and counts must satisfy 0 <= defects <= inspected, inspected > 0')
        output.append({'date': str(dt), 'shift': shift[:80], 'line': line[:80],
                       'inspected': inspected, 'defects': defects})
        if len(output) > MAX_RECORDS:
            raise ValueError('CSV exceeds 100,000 rows')
    if not output:
        raise ValueError('CSV must contain at least one record')
    return output

class Handler(BaseHTTPRequestHandler):
    def reply(self, status, obj):
        payload = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        route = urlparse(self.path).path
        if route == '/api/data':
            return self.reply(200, {'records': records})
        if route in ('/', '/index.html'):
            data = (ROOT / 'index.html').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.reply(404, {'error': 'Not found'})

    def do_POST(self):
        global records, analyzer
        route = urlparse(self.path).path
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 12_000_000:
                raise ValueError('Request body must be between 1 byte and 12 MB')
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            if route == '/api/query':
                left, right = body['left'], body['right']
                if type(left) is not int or type(right) is not int:
                    raise ValueError('Indices must be integers')
                return self.reply(200, analyzer.query(left, right))
            if route == '/api/upload':
                updated = parse_records(body['csv'])
                next_analyzer = DefectAnalyzer(updated)
                records, analyzer = updated, next_analyzer
                return self.reply(200, {'records': records})
            if route == '/api/reset':
                updated = sample_records()
                records, analyzer = updated, DefectAnalyzer(updated)
                return self.reply(200, {'records': records})
            self.reply(404, {'error': 'Not found'})
        except (ValueError, KeyError, TypeError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.reply(400, {'error': str(exc)})

if __name__ == '__main__':
    print('Open http://127.0.0.1:8000 in your browser')
    ThreadingHTTPServer(('127.0.0.1', 8000), Handler).serve_forever()
