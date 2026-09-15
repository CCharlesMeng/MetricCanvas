"""Audit stored outbound messages, immutable baseline hashes and all artifacts offline."""
import argparse
import json
from pathlib import Path
from run_local import config, document_sha256, validate_page_document

p=argparse.ArgumentParser();p.add_argument('raw',type=Path);p.add_argument('--config',type=Path,required=True);args=p.parse_args()
key=config(args.config)['DEEPSEEK_API_KEY']
counts={'requests':0,'responses':0,'artifacts':0,'baselines':0}

def walk(value):
 if isinstance(value,dict):
  assert not {'schemaVersion','dataSources','sections'}.issubset(value), 'Full page in model messages'
  assert 'rows' not in value, 'Rows in model messages'
  for child in value.values():walk(child)
 elif isinstance(value,list):
  for child in value:walk(child)
 elif isinstance(value,str):
  try:child=json.loads(value)
  except (ValueError,TypeError):return
  if isinstance(child,(list,dict)):walk(child)

for path in args.raw.rglob('*.json'):
 text=path.read_text();assert key not in text,'Credential in evidence'
 value=json.loads(text)
 if path.name.startswith('request-'):
  counts['requests']+=1
  assert value['model']=='deepseek-v4-flash'
  assert 'private-region' not in json.dumps(value['messages'])
  walk(value['messages'])
 if path.name.startswith('response-'):counts['responses']+=1
 if path.name.startswith('artifact-'):
  counts['artifacts']+=1;assert not validate_page_document(value)
 if path.name.startswith('baseline-'):
  counts['baselines']+=1;assert document_sha256(value['document'])==value['documentSha256']
assert counts['requests']==counts['responses']==34
assert counts['artifacts']==8
print(json.dumps({'verified':counts,'credentialsAbsent':True,'modelMessagesContainNoPagesOrRows':True}))
