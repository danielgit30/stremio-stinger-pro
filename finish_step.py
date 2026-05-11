import sys
import json
import urllib.request

req = urllib.request.Request(
    'http://localhost:8080/plan-step-complete',
    data=json.dumps({"message": "Completed step"}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    urllib.request.urlopen(req)
except:
    pass
