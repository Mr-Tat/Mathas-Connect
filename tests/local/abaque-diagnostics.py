# Logs only from the disposable fixtures, with all generated secrets redacted.
import re,subprocess,sys
name=sys.argv[1]
if not re.fullmatch(r'mathas-abaque-test-\d+-\d+',name):raise SystemExit('fixture_name_required')
for suffix in ['auth','rest','edge','gateway']:
 result=subprocess.run(['docker','--host=unix:///var/run/docker.sock','logs','--tail','25',name+'-'+suffix],capture_output=True,text=True)
 value=result.stdout+result.stderr
 value=re.sub(r'(?i)(postgres(?:ql)?://[^:]+:)[^@\s]+@',r'\1[fixture-secret]@',value)
 value=re.sub(r'\b[a-f0-9]{48,64}\b','[fixture-secret]',value)
 value=re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[fixture-jwt]',value)
 print('LOCAL FIXTURE '+suffix+'\n'+value[-4000:])
