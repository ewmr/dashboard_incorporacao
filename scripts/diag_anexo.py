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
A={"Authorization":T}; B={"Authorization":"Bearer "+T}
t("A anexo+token",U,A)
z="https://id.app.clickup.com/attachments/v1/data/workspaces/%s/utils/authz_token?cf_url=%s"%(WS,urllib.parse.quote(U,safe=""))
t("B authz token",z,A); t("C authz bearer",z,B)
t("D v3 anexos",f"https://api.clickup.com/api/v3/workspaces/{WS}/task/{TID}/attachments",A)
t("E v3 anexos bearer",f"https://api.clickup.com/api/v3/workspaces/{WS}/task/{TID}/attachments",B)
t("F v2 task anexos",f"https://api.clickup.com/api/v2/task/{TID}?include_attachments=true",A)
