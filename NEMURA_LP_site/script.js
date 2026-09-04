/* NEMURA「Night Reset」LP ─ 全ページ共通スクリプト
   ページごとに <html class="p-xxx"> を見て、該当ページでのみ実行します。 */

/* ==================================================
   ① LP本体　index.html
   ================================================== */
(function () {
  if (!document.documentElement.classList.contains('p-index')) return;

  (function(){
    'use strict';
    var $  = function(s,c){return (c||document).querySelector(s);};
    var $$ = function(s,c){return [].slice.call((c||document).querySelectorAll(s));};

    /* ============ 計測（GTM / GA4 の dataLayer に push） ============ */
    window.dataLayer = window.dataLayer || [];
    function track(ev, params){
      try { window.dataLayer.push(Object.assign({event:ev}, params||{})); } catch(e){}
    }

    // CTAクリック計測
    $$('[data-cta]').forEach(function(el){
      el.addEventListener('click', function(){
        track('cta_click', {cta_id: el.getAttribute('data-cta'),
                            cta_text: (el.textContent||'').replace(/\s+/g,' ').trim().slice(0,40)});
      });
    });

    // セクション到達率（各セクション初回到達を1回だけ送る）
    if ('IntersectionObserver' in window){
      var seen = {};
      var so = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          var id = e.target.getAttribute('data-section');
          if (e.isIntersecting && !seen[id]){ seen[id] = 1; track('section_view', {section_id:id}); }
        });
      }, {threshold:0.4});
      $$('[data-section]').forEach(function(el){ so.observe(el); });
    }

    // スクロール深度（25/50/75/100%）
    (function(){
      var marks = [25,50,75,100], hit = {};
      var onScroll = function(){
        var h = document.documentElement.scrollHeight - window.innerHeight;
        if (h <= 0) return;
        var pct = Math.round(window.scrollY / h * 100);
        marks.forEach(function(m){ if (pct >= m && !hit[m]){ hit[m]=1; track('scroll_depth',{percent:m}); } });
      };
      window.addEventListener('scroll', onScroll, {passive:true});
    })();

    /* ============ 追従CTAバー ============ */
    var bar = $('#stickyBar'), fv = $('#fv'), form = $('#form');
    var fvIn = true, formIn = false;
    function syncBar(){ bar.classList.toggle('is-visible', !fvIn && !formIn); }
    if ('IntersectionObserver' in window){
      new IntersectionObserver(function(e){ fvIn = e[0].isIntersecting; syncBar(); },{threshold:0}).observe(fv);
      new IntersectionObserver(function(e){ formIn = e[0].isIntersecting; syncBar(); },{threshold:0}).observe(form);
    } else { bar.classList.add('is-visible'); }

    /* ============ 離脱防止モーダル ============ */
    (function(){
      var modal = $('#exitModal'); if (!modal) return;
      var shown = false, lastY = window.scrollY, lastFocus = null;
      function seenBefore(){ try { return sessionStorage.getItem('nemura_exit') === '1'; } catch(e){ return false; } }
      function remember(){ try { sessionStorage.setItem('nemura_exit','1'); } catch(e){} }
      function open(){
        if (shown || seenBefore()) return;
        shown = true; remember();
        lastFocus = document.activeElement;
        modal.classList.add('is-open');
        $('#exitClose').focus();
        track('exit_modal_view', {});
      }
      function close(reason){
        modal.classList.remove('is-open');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        track('exit_modal_close', {reason: reason});
      }
      $('#exitClose').addEventListener('click', function(){ close('close_button'); });
      $('#exitDismiss').addEventListener('click', function(){ close('keep_reading'); });
      modal.addEventListener('click', function(e){ if (e.target === modal) close('backdrop'); });
      document.addEventListener('keydown', function(e){
        if (e.key === 'Escape' && modal.classList.contains('is-open')) close('escape');
        // フォーカストラップ
        if (e.key === 'Tab' && modal.classList.contains('is-open')){
          var f = $$('button, a[href]', modal);
          var first = f[0], last = f[f.length-1];
          if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
        }
      });
      // SP：ページ中盤以降で、上方向に一定量スクロールし戻したとき
      var upAccum = 0;
      window.addEventListener('scroll', function(){
        var y = window.scrollY;
        var h = document.documentElement.scrollHeight - window.innerHeight;
        var deep = h > 0 && (y / h) > 0.35;
        var d = lastY - y;
        if (d > 0) upAccum += d; else upAccum = 0;   // 下方向でリセット
        if (deep && upAccum > 260 && !formIn) { upAccum = 0; open(); }
        lastY = y;
      }, {passive:true});
      // PC：ポインタが画面上部から外れたとき
      document.addEventListener('mouseout', function(e){
        if (!e.relatedTarget && e.clientY <= 0 && window.scrollY > 400 && !formIn) open();
      });
    })();

    /* ============ 郵便番号 → 住所（モック。実装時はAPIに差し替え） ============ */
    $('#zipBtn').addEventListener('click', function(){
      var z = $('#zip').value.replace(/[^0-9]/g,'');
      if (z.length >= 7){ $('#addr1').value = '東京都品川区東五反田'; $('#addr1').focus(); }
      else { setErr($('#zip'), '郵便番号は7桁の数字でご入力ください。'); }
    });

    /* ============ フォームのバリデーション ============ */
    var RULES = {
      sei:     {msg:'姓をご入力ください。'},
      mei:     {msg:'名をご入力ください。'},
      kanaSei: {re:/^[ァ-ヶー　\s]+$/, msg:'セイを全角カタカナでご入力ください。'},
      kanaMei: {re:/^[ァ-ヶー　\s]+$/, msg:'メイを全角カタカナでご入力ください。'},
      zip:     {re:/^\d{3}-?\d{4}$/,        msg:'郵便番号は7桁（例：141-0022）でご入力ください。'},
      addr1:   {msg:'ご住所をご入力ください。'},
      tel:     {re:/^0\d{9,10}$/, norm:function(v){return v.replace(/[^0-9]/g,'');},
                msg:'電話番号はハイフンなし10〜11桁でご入力ください。'},
      mail:    {re:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, msg:'メールアドレスの形式をご確認ください。'}
    };
    function errNode(el){
      var n = el.parentElement.querySelector('.ferr');
      if (!n){
        n = document.createElement('p'); n.className='ferr';
        n.id = el.id + '-err'; n.setAttribute('role','alert'); n.setAttribute('aria-live','polite');
        (el.closest('.fld') || el.parentElement).appendChild(n);
      }
      return n;
    }
    function setErr(el, msg){
      var n = errNode(el); n.textContent = msg;
      el.setAttribute('aria-invalid','true'); el.setAttribute('aria-describedby', n.id);
    }
    function clearErr(el){
      var n = (el.closest('.fld')||el.parentElement).querySelector('.ferr');
      if (n) n.textContent = '';
      el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby');
    }
    function validateField(el){
      var rule = RULES[el.id]; if (!rule) return true;
      var v = (el.value||'').trim();
      if (!v){ setErr(el, rule.msg); return false; }
      var t = rule.norm ? rule.norm(v) : v;
      if (rule.re && !rule.re.test(t)){ setErr(el, rule.msg); return false; }
      clearErr(el); return true;
    }
    Object.keys(RULES).forEach(function(id){
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('blur', function(){ validateField(el); });
      el.addEventListener('input', function(){ if (el.getAttribute('aria-invalid')) validateField(el); });
    });

    var sub = $('#agreeSub'), errSub = $('#errSub');
    var pp  = $('#agreePp'),  errPp  = $('#errPp');
    sub.addEventListener('change', function(){ if (sub.checked) errSub.hidden = true; });
    pp.addEventListener('change',  function(){ if (pp.checked)  errPp.hidden  = true; });

    $('#orderForm').addEventListener('submit', function(ev){
      ev.preventDefault();
      var first = null;
      Object.keys(RULES).forEach(function(id){
        var el = document.getElementById(id); if (!el) return;
        if (!validateField(el) && !first) first = el;
      });
      errSub.hidden = sub.checked; if (!sub.checked && !first) first = sub;
      errPp.hidden  = pp.checked;  if (!pp.checked  && !first) first = pp;

      if (first){
        track('form_error', {first_error: first.id});
        first.focus({preventScroll:true});
        first.scrollIntoView({behavior:'smooth', block:'center'});
        return;
      }
      track('form_submit', {});

      // 入力内容を確認画面へ引き渡す。sessionStorage はタブを閉じると消えるので、
      // 申込みが終わったあとに個人情報が端末に残り続けない
      try {
        var payIn = document.querySelector('input[name="pay"]:checked');
        var payName = payIn ? (document.querySelector('label[for="'+payIn.id+'"]')||{}).textContent : '';
        sessionStorage.setItem('nemura_order', JSON.stringify({
          sei: $('#sei').value.trim(),       mei: $('#mei').value.trim(),
          kanaSei: $('#kanaSei').value.trim(), kanaMei: $('#kanaMei').value.trim(),
          zip: $('#zip').value.trim(),       addr1: $('#addr1').value.trim(),
          tel: $('#tel').value.trim(),       mail: $('#mail').value.trim(),
          deliveryDate: '', deliveryTime: ($('#deliv') ? $('#deliv').value : ''),
          payCode: payIn ? ({pay1:'card', pay2:'amazon', pay3:'cvs'}[payIn.id] || 'card') : 'card',
          pay: (payName || '').replace(/\s+/g, ''),
          course: '定期便「ととのう夜コース」', cycle: 30,
          agreeSub: sub.checked, agreePp: pp.checked,
          line: $('#agreeLine') ? $('#agreeLine').checked : false,
          company: $('#company') ? $('#company').value : '',
          source: new URLSearchParams(location.search).get('utm_source') || ''
        }));
      } catch (e) { /* 保存できなくても申込みは止めない */ }

      // 最終確認画面へ遷移（商品名・数量／初回支払総額／2回目以降の金額と支払時期／お届け周期／
      // 契約期間の定めの有無／解約の期限と方法／返品・返金の条件 をすべて表示する画面）
      location.href = 'confirm.html';
    });


    /* ============ スクロールに入ったブロックをフェードイン ============
       IntersectionObserver だけに任せると、勢いよくフリックしたときに
       通知を取りこぼしてブロックが透明のまま残る。表示されないのは論外なので、
       監視に加えてスクロール時の総ざらいも回し、どちらか早いほうで確定させる。
       動きを減らす設定の端末では、何もせず最初から表示する。 */
    (function(){
      var pending = $$('[data-anim]');
      if (!pending.length) return;

      function revealAll(){
        pending.forEach(function(el){ el.classList.add('is-in'); });
        pending = [];
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches){ revealAll(); return; }

      function show(el){
        el.classList.add('is-in');
        var i = pending.indexOf(el);
        if (i > -1) pending.splice(i, 1);
        if (io) io.unobserve(el);
      }

      var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(es){
        es.forEach(function(en){ if (en.isIntersecting) show(en.target); });
      }, {rootMargin: '0px 0px -10% 0px', threshold: 0.05}) : null;

      if (!io){ revealAll(); return; }
      pending.slice().forEach(function(el){ io.observe(el); });

      // 取りこぼしの受け皿。画面下端を越えたものは無条件に出す
      var ticking = false;
      function sweep(){
        ticking = false;
        if (!pending.length){
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onScroll);
          return;
        }
        var h = window.innerHeight;
        pending.slice().forEach(function(el){
          if (el.getBoundingClientRect().top < h * 0.94) show(el);
        });
      }
      function onScroll(){
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(sweep);
      }
      window.addEventListener('scroll', onScroll, {passive:true});
      window.addEventListener('resize', onScroll, {passive:true});
      onScroll();
    })();

    /* ============ FAQ の開閉を計測 ============ */
    $$('.faq details').forEach(function(d){
      d.addEventListener('toggle', function(){
        if (d.open) track('faq_open', {question: d.querySelector('summary').textContent.trim()});
      });
    });
  })();
  /* ===== 睡眠タイプ診断 ===== */
  (function(){
    'use strict';
    var $=function(s){return document.querySelector(s);};
    window.dataLayer = window.dataLayer || [];
    function track(ev,p){ try{ window.dataLayer.push(Object.assign({event:ev},p||{})); }catch(e){} }

    var Q=[
      {t:'夜、布団に入ってから眠るまでは？',
       a:[{l:'たいてい、わりとすぐ眠れる',s:{C:2}},
          {l:'20分以上かかることが多い',s:{A:2}},
          {l:'日によってまったく違う',s:{B:2}}]},
      {t:'いちばん引っかかっているのは？',
       a:[{l:'寝ているはずなのに、朝がしんどい',s:{A:2}},
          {l:'布団に入っても、頭が切り替わらない',s:{A:1,C:1}},
          {l:'生活リズムが不規則で、夜が一定でない',s:{B:2}}]},
      {t:'夜の過ごし方は決まっていますか？',
       a:[{l:'入浴・就寝の時間はだいたい決まっている',s:{A:1}},
          {l:'決まっていない。日によってばらばら',s:{B:1,C:1}},
          {l:'決めたいと思っているが、続いていない',s:{C:2}}]}
    ];
    var R={
      A:{n:'切り替え待ちタイプ',
         d:'眠る時間は確保できているのに、頭のスイッチだけが残っている——という夜が多いようです。夜の流れ自体はある程度決まっているので、その中に置く場所をひとつ決めるのが向いています。',
         p:['<b>入浴を終えたタイミング</b>で2粒。就寝の1時間前が目安です。',
            '飲んだら<b>スマホを伏せる</b>ところまでをひと続きにすると、区切りがつきやすくなります。',
            '同梱の飲み方ガイドで、リマインド設定をご案内しています。']},
      B:{n:'リズム可変タイプ',
         d:'夜勤や交代勤務などで、生活リズムが週単位で組み替わる方に多いタイプです。「就寝1時間前」という前提が当てはまりにくいので、時計ではなくご自身の流れに合わせるのが向いています。',
         p:['時刻ではなく、<b>ご自身の“夜”にあたる時間の前</b>にお召し上がりください。',
            '飲む時間が前後しても問題ありません。<b>1日2粒の目安</b>だけ守っていただければ大丈夫です。',
            '直径9mm・無味無臭なので、<b>数粒だけ持ち出す</b>こともできます。']},
      C:{n:'習慣づくりタイプ',
         d:'夜のルーティンをつくりたい気持ちはあるけれど、続いていない——という段階のようです。新しい習慣を足すより、すでにやっている動作にくっつけるほうが定着しやすくなります。',
         p:['<b>すでに毎晩やっていること</b>（歯みがき・アイマスク・照明を落とす等）の直前に2粒。',
            '曜日や時間を厳密に決めず、<b>「あの動作の前」</b>とだけ決めるのがコツです。',
            '飲み忘れてもストレスにならない量です。翌日に取り戻す必要はありません。']}
    };

    var step=0, ans=[];
    var intro=$('#dxIntro'), panel=$('#dxPanel'), res=$('#dxRes');

    function renderQ(){
      var q=Q[step];
      $('#dxQn').textContent='QUESTION '+(step+1)+' / '+Q.length;
      $('#dxQt').textContent=q.t;
      [].forEach.call(document.querySelectorAll('.dx-prog i'),function(el,i){
        el.className = i<=step ? 'on' : ''; });
      var html='';
      q.a.forEach(function(o,i){
        html+='<label class="dx-opt"><input type="radio" name="dxq'+step+'" value="'+i+'"'+
              (ans[step]===i?' checked':'')+'><span>'+o.l+'</span></label>';
      });
      $('#dxOpts').innerHTML=html;
      [].forEach.call(document.querySelectorAll('input[name="dxq'+step+'"]'),function(r){
        r.addEventListener('change',function(){
          ans[step]=parseInt(r.value,10);
          track('diagnosis_answer',{question:step+1, answer:Q[step].a[ans[step]].l});
          setTimeout(next,180);
        });
      });
      $('#dxBack').style.visibility = step===0 ? 'hidden' : 'visible';
      var first=document.querySelector('input[name="dxq'+step+'"]');
      if(first) first.focus({preventScroll:true});
    }
    function next(){
      if(step < Q.length-1){ step++; renderQ(); }
      else { show(); }
    }
    function show(){
      var sc={A:0,B:0,C:0};
      ans.forEach(function(a,i){
        var s=Q[i].a[a].s;
        for(var k in s){ sc[k]=(sc[k]||0)+s[k]; }
      });
      var top='A';
      for(var k in sc){ if(sc[k]>sc[top]) top=k; }
      var r=R[top];
      $('#dxTypeName').textContent=r.n;
      $('#dxTypeDesc').textContent=r.d;
      $('#dxPlan').innerHTML=r.p.map(function(x){return '<li>'+x+'</li>';}).join('');
      panel.classList.remove('is-on');
      res.classList.add('is-on');
      // 質問（縦に長い）が消えて結果に入れ替わるため、カードの先頭まで戻す。
      // 出したものが画面外にあると、気づかれないまま離脱する
      try{
        var card = res.closest('.dx-card') || res;
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
      }catch(e){}
      track('diagnosis_result',{type:top, type_name:r.n, score_a:sc.A, score_b:sc.B, score_c:sc.C});
      $('#dxTypeName').focus && $('#dxTypeName').setAttribute('tabindex','-1');
      $('#dxTypeName').focus && $('#dxTypeName').focus({preventScroll:true});
    }
    $('#dxStart').addEventListener('click',function(){
      intro.style.display='none'; panel.classList.add('is-on');
      step=0; ans=[]; renderQ(); track('diagnosis_start',{});
    });
    $('#dxBack').addEventListener('click',function(){ if(step>0){ step--; renderQ(); } });
    $('#dxAgain').addEventListener('click',function(){
      res.classList.remove('is-on'); panel.classList.add('is-on');
      step=0; ans=[]; renderQ(); track('diagnosis_restart',{});
    });
  })();
})();

/* ==================================================
   ② 最終確認画面　confirm.html
   ================================================== */
(function () {
  if (!document.documentElement.classList.contains('p-confirm')) return;

  (function(){
    'use strict';
    window.dataLayer = window.dataLayer || [];
    function track(ev,p){ try{ window.dataLayer.push(Object.assign({event:ev},p||{})); }catch(e){} }
    track('confirm_view',{step:'2_confirm'});

    var FEE = {card:0, amazon:0, cvs:250};
    var TIMING = {
      card:'クレジットカード：ご注文時に決済',
      amazon:'Amazon Pay：ご注文時に決済',
      cvs:'コンビニ後払い：商品到着後14日以内にお支払い'
    };
    var NOTE = {
      card:'クレジットカード決済のため、手数料はかかりません。',
      amazon:'Amazon Pay のため、手数料はかかりません。',
      cvs:'コンビニ後払いは<b>別途手数料250円（税込）</b>がかかります。ご利用には与信審査があり、審査結果によっては他のお支払い方法をご案内する場合があります。'
    };
    function yen(n){ return n.toLocaleString('ja-JP') + '円'; }

    function render(method){
      var fee = FEE[method], total = 2980 + fee;
      document.getElementById('feeVal').textContent  = yen(fee);
      document.getElementById('feeVal2').textContent = yen(fee);
      document.getElementById('totalVal').textContent  = total.toLocaleString('ja-JP');
      document.getElementById('totalVal2').textContent = yen(total) ;
      document.getElementById('totalVal4').textContent = yen(total);
      document.getElementById('totalVal3').textContent =
        yen(total) + '（税込・送料無料' + (fee ? '／手数料込' : '') + '）※初回のみ';
      document.getElementById('payTiming').innerHTML =
        TIMING[method] + '<small>2回目以降は、各回の発送時に同じお支払い方法で決済されます。</small>';
      document.getElementById('payNote').innerHTML = NOTE[method];
      document.getElementById('feeRow').style.opacity = fee ? '1' : '.62';
    }
    [].slice.call(document.querySelectorAll('input[name="pay"]')).forEach(function(r){
      r.addEventListener('change', function(){
        render(r.value);
        track('payment_change',{method:r.value, fee:FEE[r.value]});
      });
    });
    render('card');

    // 追従バーから確定ボタンへ
    document.querySelector('[data-jump]').addEventListener('click', function(){
      document.getElementById('confirmBtn').scrollIntoView({behavior:'smooth', block:'center'});
      document.getElementById('confirmBtn').focus({preventScroll:true});
    });

    // 修正リンク。入力内容は sessionStorage に残っているので、そのまま戻れる
    [].slice.call(document.querySelectorAll('[data-edit]')).forEach(function(a){
      a.addEventListener('click', function(){
        track('confirm_edit',{target:a.getAttribute('data-edit')});
      });
    });

    /* ============ 入力内容の読み込みと表示 ============
       index.html が sessionStorage に置いた値を読み、確認画面に反映する。
       直接この画面を開いた場合（値がない場合）は、見本の表示のまま何もしない。 */
    var order = null;
    try { order = JSON.parse(sessionStorage.getItem('nemura_order') || 'null'); } catch (e) {}

    function esc(t){ return String(t == null ? '' : t)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    if (order && order.sei) {
      document.getElementById('cName').innerHTML =
        esc(order.sei) + ' ' + esc(order.mei) +
        '<small>' + esc(order.kanaSei) + ' ' + esc(order.kanaMei) + '</small>';
      document.getElementById('cAddr').innerHTML =
        '〒' + esc(order.zip) + '<br>' + esc(order.addr1);
      document.getElementById('cTel').textContent = order.tel || '';
      document.getElementById('cMail').innerHTML =
        esc(order.mail) + '<small>ご注文確認メールをお送りします。</small>';
      if (order.deliveryTime) {
        document.getElementById('cDeliv').innerHTML =
          esc(order.deliveryTime) + '<small>初回お届け予定日：ご注文から3〜5営業日以内に発送します。</small>';
      }
      var pre = document.querySelector('input[name="pay"][value="' + (order.payCode || 'card') + '"]');
      if (pre) { pre.checked = true; render(pre.value); }
    }

    /* ============ 申込みの送信 ============
       GitHub Pages は静的配信なので、送信先を外に用意する必要がある。
       Google Apps Script のウェブアプリURLをここに入れると、
       スプレッドシートへの記録と自動返信メールが動く。
       空のままなら送信をとばして完了画面へ進む（見た目の確認用）。 */
    var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwF-tx9Mf9IIVVRg-1KtrXQdOZqLiY7uP-9BTmeqMLDGKErM_8A-mZ7vNbN4DqVDTLXgg/exec';

    var btn = document.getElementById('confirmBtn');
    var sendErr = document.getElementById('sendErr');

    function goThanks(orderNo){
      try { sessionStorage.setItem('nemura_orderNo', orderNo || ''); } catch (e) {}
      location.href = 'thanks.html';
    }

    btn.addEventListener('click', function(){
      var m = document.querySelector('input[name="pay"]:checked').value;
      track('purchase',{value:2980+FEE[m], currency:'JPY', payment_method:m,
                        items:[{item_name:'Night Reset 定期便ととのう夜コース', quantity:1}]});

      if (!ENDPOINT) { goThanks(''); return; }

      sendErr.hidden = true;
      btn.disabled = true;
      var label = btn.innerHTML;
      btn.textContent = '送信しています…';

      var payload = order || {};
      payload.payCode = m;
      payload.pay = ({card:'クレジットカード', amazon:'Amazon Pay', cvs:'コンビニ後払い'})[m];

      // Content-Type を application/json にすると事前確認（preflight）が飛び、
      // Apps Script 側が応答できずに失敗する。text/plain なら中身がJSONでもそのまま通る
      fetch(ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (!j || !j.ok) throw new Error((j && j.error) || 'failed');
        goThanks(j.orderNo);
      })
      .catch(function(){
        // 申込みを取りこぼさないよう、押し直せる状態に戻す
        btn.disabled = false;
        btn.innerHTML = label;
        sendErr.hidden = false;
        sendErr.scrollIntoView({behavior:'smooth', block:'center'});
        track('order_send_error', {});
      });
    });
  })();
})();

/* ==================================================
   ③ 申込完了画面　thanks.html
   ================================================== */
(function () {
  if (!document.documentElement.classList.contains('p-thanks')) return;

  // 注文番号は confirm.html が受け取った実際の番号を表示する。
  // 受け取れていない場合（直接このページを開いたときなど）は見本の番号のままにする。
  var ORD = 'NR-2026-0908-04127';
  try{
    var saved = sessionStorage.getItem('nemura_orderNo');
    if (saved) {
      ORD = saved;
      document.getElementById('ordNo').textContent = saved;
    }
    // 二重計上を防ぐため、表示したら消す
    sessionStorage.removeItem('nemura_orderNo');
    sessionStorage.removeItem('nemura_order');
  }catch(e){}

  window.dataLayer = window.dataLayer || [];
  try{ window.dataLayer.push({event:'purchase_complete', transaction_id:ORD,
    value:2980, currency:'JPY',
    items:[{item_name:'Night Reset 定期便ととのう夜コース', quantity:1, price:2980}]}); }catch(e){}
})();
