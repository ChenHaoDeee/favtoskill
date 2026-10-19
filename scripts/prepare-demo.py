"""Copy the user-authorized MIT demo corpus, preserving provenance and missing fields."""
import json, pathlib, shutil, re
root=pathlib.Path('.review/douxiaojia')
out=pathlib.Path('server/fixtures');out.mkdir(parents=True,exist_ok=True)
assets=pathlib.Path('public/demo');assets.mkdir(parents=True,exist_ok=True)
shutil.copy2(root/'LICENSE',assets/'LICENSE.txt')
shutil.copy2(root/'LICENSE',out/'LICENSE.txt')
files={'tech_favorites':'tech','food_favorites':'food','knowledge_favorites':'renwen','jieshuo':'jieshuo','lvyou':'trip','youxi':'game','knowledge':'knowledge'}
names={'tech':'科技','food':'美食','renwen':'人文','jieshuo':'解说','trip':'旅行','game':'游戏','knowledge':'知识'}
mapping={'科技':'tech','美食':'food','人文':'renwen','解说':'jieshuo','旅行':'trip','游戏':'game','知识':'knowledge','商业财经':'knowledge'}
items=[];seen=set();asset_count=0
for filename,fallback in files.items():
    raw=json.loads((root/f'src/public/mock/{filename}.json').read_text(encoding='utf-8-sig'))
    for i,row in enumerate(raw if isinstance(raw,list) else [raw]):
        original_id=str(row['id']); identifier=filename+'--'+original_id
        if identifier in seen: raise ValueError(f'Duplicate demo ID: {identifier}')
        seen.add(identifier)
        category=fallback  # preserve the source file's folder; legacy category names overlap
        image=root/f'src/public/mockimg/{original_id}.jpg'
        if not image.exists(): image=root/f'src/public/mockimg/{original_id}.png'
        image_path=None
        if image.exists():
            shutil.copy2(image,assets/image.name);image_path='/demo/'+image.name;asset_count+=1
        items.append({'id':identifier,'title':row['title'],'originalText':row.get('transcript') or row.get('description',''),
            'summary':row.get('description',''),'keyPoints':[],'categoryId':category,'tags':row.get('tags',[]),
            'imagePath':image_path,'sourcePlatform':'抖音','sourceUrl':row.get('url'),
            'completeness':'fragment','createdAt':row.get('savedAt','2026-10-18T00:00:00Z'),'updatedAt':row.get('savedAt','2026-10-18T00:00:00Z'),
            'provenance':{'kind':'demo','repository':'https://github.com/FavToSkill/douxiaojia','commit':'2719a698fe6dcb25a0743978e5759cbe60f03ec2','file':f'src/public/mock/{filename}.json','originalId':original_id,'originalCategory':row.get('category'),'textKind':'repository_transcript' if row.get('transcript') else 'repository_description'}})
skills=[]
for file in sorted((root/'src/public/mock/skills').glob('*.md')):
    content=file.read_text(encoding='utf-8-sig')
    category=file.name.split('-')[0]
    if category not in names: continue
    def section(name):
        match=re.search(r'^## '+re.escape(name)+r'\s*\n(.*?)(?=^## |\Z)',content,re.S|re.M)
        return match.group(1).strip() if match else ''
    lines=lambda text:[x.strip('- ').strip() for x in text.splitlines() if x.strip().startswith('- ')]
    title=content.splitlines()[0].lstrip('# ').removesuffix(' Skill')
    skills.append({'id':'demo-'+file.stem,'name':title,'description':section('使用场景').split('\n')[0],
        'scenarios':lines(section('核心能力'))[:3],'inputRequirements':'说明任务目标、个人背景与限制条件。',
        'steps':[section('核心指令') or '依据关联资料回答，注明来源和限制。'],
        'outputFormat':'结构化建议与引用来源','knowledgeIds':[x['id'] for x in items if x['categoryId']==category][:6],
        'limitations':lines(section('约束条件'))+['演示模板预设 Skill；未核验的示例不能作为事实依据。当前不支持定时推送、联网追踪或第三方操作。'],
        'externalDependencies':['外部执行或定时能力未接入'] if re.search('每天|推送|追踪',section('核心指令')) else [],
        'createdAt':'2026-10-18T00:00:00Z','updatedAt':'2026-10-18T00:00:00Z','origin':'preset','sourceMarkdown':content})
# User-authorized unclassified demo samples; retain their original records and references.
for item in items:
    if item['id'] in ['tech_favorites--ai_05','food_favorites--food_05','lvyou--lvyou-05']: item['categoryId']=None
payload={'categories':[{'id':key,'name':name,'createdAt':'2026-10-18T00:00:00Z'} for key,name in names.items()], 'knowledge':items,'skills':skills}
(out/'demo.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
(assets/'PROVENANCE.md').write_text('# 演示素材来源\n\n用户授权复用 FavToSkill/douxiaojia，提交 2719a698fe6dcb25a0743978e5759cbe60f03ec2。\n\n数据与封面仅供本项目演示，不代表实际同步的社媒收藏。保留原仓库 MIT License；上游内容可能包含转录误差、陈旧信息与示例，未联网核验。\n',encoding='utf-8')
print(json.dumps({'categories':len(names),'knowledge':len(items),'presetSkills':len(skills),'covers':asset_count}))


