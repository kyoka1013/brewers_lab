/* Brewers Lab — Shared App Layer
   - Simple ID/PW auth (localStorage, NOT for sensitive data)
   - Per-user database (brew logs, recipes, favorites, prefs)
   - Choice lists for selection-based UI
   - Nav renderer
*/
(function(global){
  'use strict';

  // ====== Storage namespace ======
  var ROOT = 'brewerslab_v1';
  function readRoot(){
    try { return JSON.parse(localStorage.getItem(ROOT)) || {users:{},session:null}; }
    catch(e){ return {users:{},session:null}; }
  }
  function writeRoot(o){ localStorage.setItem(ROOT, JSON.stringify(o)); }

  // ====== Light hash (NOT cryptographic; for casual local-only protection) ======
  function lightHash(s){
    var h=0; for(var i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i); h|=0;}
    return 'h'+(h>>>0).toString(16);
  }

  // ====== Auth ======
  var Auth = {
    current: function(){ return readRoot().session; },
    signup: function(id, pw){
      id=(id||'').trim();
      if(!id) return {ok:false,msg:'IDを入力してください'};
      if(!pw||pw.length<3) return {ok:false,msg:'パスワードは3文字以上'};
      var root=readRoot();
      if(root.users[id]) return {ok:false,msg:'そのIDは既に存在します'};
      root.users[id]={pw:lightHash(pw),createdAt:Date.now(),data:{brews:[],recipes:[],favorites:[],beans:[],prefs:{}}};
      root.session=id; writeRoot(root);
      return {ok:true};
    },
    login: function(id,pw){
      id=(id||'').trim();
      var root=readRoot();
      var u=root.users[id];
      if(!u) return {ok:false,msg:'IDが見つかりません'};
      if(u.pw!==lightHash(pw)) return {ok:false,msg:'パスワードが違います'};
      root.session=id; writeRoot(root);
      return {ok:true};
    },
    logout: function(){
      var root=readRoot(); root.session=null; writeRoot(root);
    },
    require: function(){
      if(!Auth.current()){ location.href='login.html'; return false; }
      return true;
    }
  };

  // ====== DB (per-user) ======
  function userData(){
    var root=readRoot(); var id=root.session;
    if(!id||!root.users[id]) return null;
    if(!root.users[id].data) root.users[id].data={brews:[],recipes:[],favorites:[],beans:[],prefs:{}};
    return {root:root, id:id, data:root.users[id].data};
  }
  function saveUser(ctx){ writeRoot(ctx.root); }

  var DB = {
    addBrew: function(entry){
      var ctx=userData(); if(!ctx) return null;
      entry.id='b'+Date.now()+Math.floor(Math.random()*1000);
      entry.createdAt=entry.createdAt||Date.now();
      ctx.data.brews.unshift(entry); saveUser(ctx); return entry;
    },
    listBrews: function(){ var ctx=userData(); return ctx? ctx.data.brews.slice() : []; },
    deleteBrew: function(id){
      var ctx=userData(); if(!ctx) return;
      ctx.data.brews=ctx.data.brews.filter(function(b){return b.id!==id;}); saveUser(ctx);
    },
    addRecipe: function(r){
      var ctx=userData(); if(!ctx) return null;
      r.id='r'+Date.now()+Math.floor(Math.random()*1000);
      r.createdAt=r.createdAt||Date.now();
      ctx.data.recipes.unshift(r); saveUser(ctx); return r;
    },
    listRecipes: function(){ var ctx=userData(); return ctx? ctx.data.recipes.slice() : []; },
    deleteRecipe: function(id){
      var ctx=userData(); if(!ctx) return;
      ctx.data.recipes=ctx.data.recipes.filter(function(r){return r.id!==id;}); saveUser(ctx);
    },
    addBean: function(b){
      var ctx=userData(); if(!ctx) return null;
      b.id='bean'+Date.now()+Math.floor(Math.random()*1000);
      b.createdAt=b.createdAt||Date.now();
      ctx.data.beans.unshift(b); saveUser(ctx); return b;
    },
    listBeans: function(){ var ctx=userData(); return ctx? ctx.data.beans.slice() : []; },
    deleteBean: function(id){
      var ctx=userData(); if(!ctx) return;
      ctx.data.beans=ctx.data.beans.filter(function(b){return b.id!==id;}); saveUser(ctx);
    },
    toggleFavorite: function(brewOrRecipeId){
      var ctx=userData(); if(!ctx) return false;
      var i=ctx.data.favorites.indexOf(brewOrRecipeId);
      if(i>=0){ ctx.data.favorites.splice(i,1); saveUser(ctx); return false; }
      ctx.data.favorites.push(brewOrRecipeId); saveUser(ctx); return true;
    },
    isFavorite: function(id){
      var ctx=userData(); return ctx? ctx.data.favorites.indexOf(id)>=0 : false;
    },
    exportAll: function(){
      var ctx=userData(); if(!ctx) return null;
      return JSON.stringify({user:ctx.id,exportedAt:new Date().toISOString(),data:ctx.data},null,2);
    },
    importAll: function(json){
      try{ var o=JSON.parse(json); var ctx=userData(); if(!ctx||!o.data) return false;
        ctx.data=o.data; saveUser(ctx); return true; } catch(e){ return false; }
    },
    clearAll: function(){
      var ctx=userData(); if(!ctx) return;
      ctx.data={brews:[],recipes:[],favorites:[],beans:[],prefs:{}}; saveUser(ctx);
    }
  };

  // ====== Choice lists — Japan-context defaults ======
  // ユーザー追加を許す項目には _custom が末尾に入る
  var Choices = {
    drippers: [
      'HARIO V60','HARIO Switch','Kalita Wave 155','Kalita Wave 185',
      'ORIGAMI','KONO 名門','BLUE BOTTLE','April Brewer',
      'CHEMEX','Melitta','フラワードリッパー','Clever Dripper'
    ],
    filters: [
      'HARIO 円錐 白（漂白）','HARIO 円錐 みさらし','CAFEC アバカ 円錐',
      'CAFEC TH-1（浅煎り用）','CAFEC TF-1（中煎り用）','CAFEC FC-1（深煎り用）',
      'Kalita ウェーブ 白','Kalita ウェーブ みさらし','ORIGAMI付属','金属（ネル/メッシュ）'
    ],
    grindLevels: [
      '極粗（フレンチプレス相当）',
      '粗（コールドブリュー寄り）',
      '中粗（カリタウェーブ寄り）',
      '中（V60標準やや粗）',
      '中細（V60スタンダード）',
      'やや細（浅煎り深掘り）',
      '細（エアロプレス寄り）',
      '極細（エスプレッソ寄り）'
    ],
    grinders: [
      'Comandante C40','TIMEMORE C2','TIMEMORE C3','TIMEMORE Sculptor',
      '1Zpresso JX-Pro','1Zpresso K-Plus','1Zpresso K-Max','1Zpresso ZP6',
      'Wilfa Svart','Baratza Encore','Niche Zero','EK43',
      'ボンマック','カリタ ナイスカットG','メリタ パーフェクトタッチII',
      'みるっこ（フジローヤル R-220）','ハリオ セラミックスリム'
    ],
    temps: ['82℃','85℃','88℃','90℃','91℃','92℃','93℃','94℃','95℃','96℃'],
    ratios: ['1:13','1:14','1:15','1:16','1:17','1:18'],
    bloomTimes: ['なし','15秒','20秒','30秒','40秒','45秒','60秒'],
    pourPatterns: [
      '1投（一気）',
      '2投（蒸らし→1回）',
      '3投（4:6 / 蒸らし＋2回）',
      '4投（細かく分割）',
      '5投以上（粕谷哲式 4:6 完全版）',
      '連続注ぎ（中断なし）'
    ],
    pourSpeed: ['細く ゆっくり','細く 普通','中くらい','太く 速め','スパイラル細','スパイラル太','中央のみ'],
    totalTimes: ['1:30','2:00','2:15','2:30','2:45','3:00','3:15','3:30','3:45','4:00','4:30','5:00'],
    waterTypes: [
      '水道水（軟水・関東/西日本）','水道水（中硬水・一部地域）',
      'ボルヴィック','エビアン','コントレックス','クリスタルガイザー',
      '南アルプス天然水','いろはす','奥大山天然水','浄水（ブリタ等）','RO水','三菱ケミカル コーヒー専用水'
    ],
    origins: [
      'エチオピア','ケニア','ルワンダ','ブルンジ','タンザニア','ウガンダ',
      'コロンビア','ブラジル','ペルー','エクアドル','ボリビア',
      'グアテマラ','コスタリカ','エルサルバドル','ホンジュラス','ニカラグア','パナマ','メキシコ',
      'インドネシア（マンデリン）','インドネシア（バリ）','インド','ベトナム','イエメン',
      'ハワイ（コナ）','ジャマイカ（ブルマン）','その他'
    ],
    processes: [
      'ウォッシュト（水洗式）','ナチュラル（非水洗）','ハニー（パルプドナチュラル）',
      'アナエロビック（嫌気発酵）','カーボニックマセレーション','ダブル発酵','スマトラ式（湿式脱穀）'
    ],
    roastLevels: [
      'ライト','シナモン（浅煎り）','ミディアム（中浅煎り）',
      'ハイ（中煎り）','シティ（中煎り）','フルシティ（中深煎り）',
      'フレンチ（深煎り）','イタリアン（極深煎り）'
    ],
    varieties: [
      'ティピカ','ブルボン','カトゥアイ','カトゥーラ','SL28','SL34','ルメスーダン',
      'ゲイシャ','パカマラ','マラゴジッペ','ムンドノーボ','カスティージョ',
      'ウシュウシュ','ヘイルーム（エチオピア在来）','その他'
    ],
    flavorCats: ['フルーティ','フローラル','ナッツ・チョコ','スパイス','甘味系','酸味系','発酵感','ネガティブ']
  };

  // ====== Util ======
  function el(tag,attrs,kids){
    var e=document.createElement(tag);
    if(attrs) for(var k in attrs){
      if(k==='style'&&typeof attrs[k]==='object'){ for(var s in attrs[k]) e.style[s]=attrs[k][s]; }
      else if(k==='html') e.innerHTML=attrs[k];
      else if(k.indexOf('on')===0) e[k]=attrs[k];
      else e.setAttribute(k,attrs[k]);
    }
    if(kids){ if(!Array.isArray(kids)) kids=[kids];
      kids.forEach(function(c){ if(c==null)return; e.appendChild(typeof c==='string'?document.createTextNode(c):c); });
    }
    return e;
  }
  function chipGroup(opts, current, onChange, allowCustom){
    var wrap=el('div',{class:'chips'});
    opts.forEach(function(o){
      var c=el('button',{type:'button',class:'chip'+(o===current?' on':''),onclick:function(){
        wrap.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on');});
        c.classList.add('on'); onChange(o);
      }},o);
      wrap.appendChild(c);
    });
    if(allowCustom){
      var add=el('button',{type:'button',class:'chip',title:'追加',onclick:function(){
        var v=prompt('項目を追加');
        if(v&&v.trim()){
          var nc=el('button',{type:'button',class:'chip on',onclick:function(){
            wrap.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on');});
            nc.classList.add('on'); onChange(v.trim());
          }},v.trim());
          wrap.insertBefore(nc,add);
          wrap.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on');});
          nc.classList.add('on'); onChange(v.trim());
        }
      }},'＋');
      wrap.appendChild(add);
    }
    return wrap;
  }
  function selectFrom(name,opts,current){
    var s=el('select',{name:name});
    s.appendChild(el('option',{value:''},'— 選択 —'));
    opts.forEach(function(o){
      var opt=el('option',{value:o},o);
      if(o===current) opt.setAttribute('selected','selected');
      s.appendChild(opt);
    });
    return s;
  }
  function copyToClipboard(text, btn){
    navigator.clipboard.writeText(text).then(function(){
      if(btn){ var t=btn.textContent; btn.textContent='コピーしました'; setTimeout(function(){btn.textContent=t;},1800); }
    });
  }
  function fmtDate(ts){
    var d=new Date(ts); var p=function(n){return n<10?'0'+n:n;};
    return d.getFullYear()+'/'+p(d.getMonth()+1)+'/'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
  }
  function ratioVal(r){ return r? +(r.split(':')[1]) : null; }

  // ====== Nav ======
  function renderNav(activeKey){
    var pages=[
      {key:'home',href:'index.html',label:'ホーム'},
      {key:'ch1',href:'ch1.html',label:'1. ドリップ基礎'},
      {key:'ch2',href:'ch2.html',label:'2. 味の言語化'},
      {key:'ch3',href:'ch3.html',label:'3. レシピ開発'},
      {key:'ch4',href:'ch4.html',label:'4. 豆を知る'},
      {key:'ch5',href:'ch5.html',label:'5. SCA・抽出理論'},
      {key:'log',href:'log.html',label:'記録'},
      {key:'recipes',href:'recipes.html',label:'レシピ'}
    ];
    var nav=el('nav',{class:'sitenav'});
    var inner=el('div',{class:'inner'});
    inner.appendChild(el('a',{class:'brand',href:'index.html'},'☕ Brewers Lab'));
    pages.forEach(function(p){
      if(p.key==='home') return;
      var a=el('a',{href:p.href, class:p.key===activeKey?'active':''},p.label);
      inner.appendChild(a);
    });
    inner.appendChild(el('span',{class:'sep'}));
    var cur=Auth.current();
    var userBox=el('div',{class:'user'});
    if(cur){
      userBox.appendChild(el('span',{},'👤 '+cur));
      userBox.appendChild(el('button',{onclick:function(){ Auth.logout(); location.href='login.html'; }},'ログアウト'));
    } else {
      userBox.appendChild(el('a',{href:'login.html',style:{color:'var(--accent)'}},'ログイン'));
    }
    inner.appendChild(userBox);
    nav.appendChild(inner);
    document.body.insertBefore(nav,document.body.firstChild);
  }

  // ====== Prompt builder helpers ======
  function buildAdvisorPrompt(chapterTitle, role, entry){
    var lines=[];
    lines.push('# Brewers Lab '+chapterTitle+' — アドバイス依頼');
    lines.push('');
    lines.push('## あなたの役割');
    lines.push(role);
    lines.push('');
    lines.push('## 私が記録した今回のドリップ');
    Object.keys(entry).forEach(function(k){
      if(entry[k]==null||entry[k]==='') return;
      lines.push('- '+k+': '+entry[k]);
    });
    lines.push('');
    lines.push('## 私が欲しいフィードバック');
    lines.push('1. この抽出結果から読み取れる「未抽出/過抽出/バランス」の診断');
    lines.push('2. なぜその味になったかの仮説（変数とのつながり）');
    lines.push('3. 次に「1つだけ」変えるべき変数と、その方向');
    lines.push('4. その変更で何が起きると期待されるか');
    lines.push('');
    lines.push('断定しすぎず、不確かな点は仮説と明記してください。');
    return lines.join('\n');
  }

  global.BrewersLab = {
    Auth:Auth, DB:DB, Choices:Choices,
    el:el, chipGroup:chipGroup, selectFrom:selectFrom,
    copyToClipboard:copyToClipboard, fmtDate:fmtDate, ratioVal:ratioVal,
    renderNav:renderNav, buildAdvisorPrompt:buildAdvisorPrompt
  };
})(window);
