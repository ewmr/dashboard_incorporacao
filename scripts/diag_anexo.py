import os, re, json, urllib.request, urllib.parse, urllib.error
T=os.environ["CLICKUP_TOKEN"].strip(); WS="9013344143"; TID="17tpepcgy93"
U="https://t9013344143.p.clickup-attachments.com/t9013344143/0fa83365-511a-46e0-a214-665ac77276c7/FLUXO%20-%20INC%20-%20EDGE%20-%20V4%201126%20432UH%2025PERM%20rev01.xlsx"
class NR(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k): return None
op=urllib.request.build_opener(NR)
mask=lambda s: re.sub(r"(eyJ[\w-]{6})[\w.\-]+", r"\1…", re.sub(r"pk_\w+","pk_…",s))
def t(nome,u,h,m="GET",body=None):
    try:
        r=op.open(urllib.request.Request(u,headers=h,method=m,data=body),timeout=60); st,hd,b=r.status,dict(r.headers),r.read()
    except urllib.error.HTTPError as e: st,hd,b=e.code,dict(e.headers),e.read()
    loc=hd.get("Location") or hd.get("location") or ""
    print(f"[{nome}] {st} ct={hd.get('Content-Type')} loc={mask(loc)[:160]} body={mask(b[:300].decode('utf-8','replace')) if b[:2]!=b'PK' else 'XLSX '+str(len(b))}")
    return st,hd,b
A={"Authorization":T}
import json as J
for nome,u in [("G v3 campo Fluxo",f"https://api.clickup.com/api/v3/workspaces/{WS}/custom_fields/5f7ad38c-bc65-441b-8590-a357b4a63602/attachments?limit=5"),
               ("H v3 tarefa",f"https://api.clickup.com/api/v3/workspaces/{WS}/attachments/{TID}/attachments")]:
    st,hd,b=t(nome,u,A)
    try:
        d=J.loads(b); L=d.get("data") or []
        print(nome,"itens",len(L),"chaves",sorted(L[0].keys()) if L else None,"next",bool(d.get("next_cursor")))
        for a in L[:3]:
            print("  ",a.get("title"),a.get("parent_id"),a.get("parent_entity_type"),"signed=",a.get("signed"),"url_tem_token=", "authz_token" in (a.get("url") or "") or "X-Amz" in (a.get("url") or "") or "Signature" in (a.get("url") or ""), mask((a.get("url") or "")[:90]))
        if L:
            st2,_,b2=t(nome+" download",L[0]["url"],{})
    except Exception as e: print(nome,"falhou",e)
