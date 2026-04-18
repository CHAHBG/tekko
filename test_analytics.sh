#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/admin/login -H 'Content-Type: application/json' -d '{"email":"cheikhabgn@gmail.com","password":"N123407b20!71"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
echo "GOT_TOKEN=$TOKEN"
curl -s -H "x-admin-token: $TOKEN" 'http://localhost:4000/api/admin/analytics?period=7d' | head -c 300