import type { Metadata, Viewport } from "next";
import { getSetting } from "@/lib/settings";
import { startPairing, tvAllowed } from "@/lib/tryon-tv";
import { TRYON_URL, tryonQrSvg } from "@/lib/tryon-qr";

export const metadata: Metadata = { title: { absolute: "SUXUS · Try-on" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#153D33", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

/*
 * The shop TV: an ordinary TV browser or an Android TV stick, landscape, read from across the room, never touched.
 * Idle: the try-on QR. When a customer chooses "Show on the shop TV", their result for 45 s, then back to the QR.
 * Plain HTML and a small old-style script (no app bundle) so older smart-TV browsers run it too.
 */
const CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:#0f2b24;color:#f7f3e8;font-family:var(--font-display-face),var(--font-inter),Arial,sans-serif}
.tv{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:4vh 5vw;box-sizing:border-box}
/* spacing with margins, not flex "gap" — older TV browsers ignore gap */
.tv>*+*{margin-left:5vw}
.qr{background:#fff;padding:1.6vh;border-radius:2vh;height:72vh;width:72vh;box-sizing:border-box;flex:none}
.qr svg{width:100%;height:100%;display:block}
.txt{display:flex;flex-direction:column;max-width:48vw}
.txt>*+*{margin-top:3vh}
.brand{font-size:4.6vh;white-space:nowrap;font-weight:700;letter-spacing:.18em;color:#c8a96a}
.tvml{font-family:var(--font-ml-face),sans-serif;font-size:6.4vh;line-height:1.25;font-weight:600}
.en{font-size:4.6vh;line-height:1.2;opacity:.9}
.phone{font-size:4.6vh;font-weight:700;letter-spacing:.04em}
.small{font-size:2.4vh;opacity:.6}
#show{display:none}
#show img{height:90vh;max-width:52vw;object-fit:contain;border-radius:1.6vh;background:#000;box-shadow:0 2vh 6vh rgba(0,0,0,.45);flex:none}
.code{font-size:12vh;font-weight:700;letter-spacing:.04em;line-height:1}
.name{font-size:5.4vh;line-height:1.2}
.meta{font-size:4vh;opacity:.85}
.mini{display:flex;align-items:center}
.txt>.mini{margin-top:4vh}
.mini>*+*{margin-left:2.5vw}
.mini .qr{height:22vh;width:22vh;padding:.8vh;border-radius:1vh}
.bar{height:.9vh;background:rgba(255,255,255,.18);border-radius:1vh;overflow:hidden;width:100%}
.bar i{display:block;height:100%;width:100%;background:#c8a96a;transform-origin:left}
`;

const PAIR_CSS = `
.pair{flex-direction:column;text-align:center}
.pair>*+*{margin-left:0;margin-top:3.2vh}
.pcode{font-size:24vh;font-weight:700;letter-spacing:.08em;line-height:1;color:#fff;background:rgba(255,255,255,.08);border-radius:3vh;padding:3vh 6vh}
`;

/** ES5: ask every 3 s whether the code was entered; reload when paired (or for a fresh code when it expired). */
const PAIR_SCRIPT = (nonce: string) => `
(function(){
  function ask(){
    var x=new XMLHttpRequest();
    x.open('GET','/api/tryon/tv-pair?n=${nonce}&t='+Date.now(),true);
    x.timeout=15000;
    x.onload=function(){
      if(x.status===410){ location.reload(); return; }
      try{ var d=JSON.parse(x.responseText); if(d&&d.paired){ location.reload(); } }catch(e){}
    };
    x.send();
  }
  setInterval(ask,3000);
  setTimeout(function(){ location.reload(); }, 15*60*1000);
})();
`;

/**
 * ES5 only (old TV browsers): poll every 4 s; a newly shown result stays 45 s; a removed one leaves at once.
 * The page elements are looked up afresh and the state re-applied twice a second, so nothing is lost if the page is
 * re-created after loading.
 */
const SCRIPT = (key: string) => `
(function(){
  var KEY=${JSON.stringify(key)}, SHOW_MS=45000, POLL_MS=4000;
  var q=KEY?('key='+encodeURIComponent(KEY)):'';
  var lastAt=Date.now()-60000, current=null, until=0, loaded='';
  function el(id){ return document.getElementById(id); }
  function variantText(v){ return v==='Full sleeve'?'ഫുൾ കൈ · Full sleeve':(v==='Half sleeve'?'ഹാഫ് കൈ · Half sleeve':(v||'')); }
  function render(){
    var idle=el('idle'), show=el('show'), img=el('img');
    if(!idle||!show||!img) return;
    if(current&&Date.now()>=until) current=null;
    if(!current){
      if(show.style.display!=='none') show.style.display='none';
      if(idle.style.display!=='flex') idle.style.display='flex';
      return;
    }
    var src='/api/tryon/tv-image/'+current.id+'?'+q+'&t='+current.at;
    if(img.getAttribute('src')!==src){ loaded=''; img.onload=function(){ loaded=src; render(); }; img.setAttribute('src',src); }
    if(img.complete&&img.naturalWidth>0) loaded=src;
    var code=el('code'), name=el('name'), meta=el('meta'), bar=el('bar');
    if(code&&code.textContent!==current.code) code.textContent=current.code;
    if(name&&name.textContent!==current.name) name.textContent=current.name;
    var m=(current.style||variantText(current.variant))+(current.rate>0?(' · ₹'+current.rate+' / m'):'');
    if(meta&&meta.textContent!==m) meta.textContent=m;
    if(bar) bar.style.transform='scaleX('+(Math.max(0,until-Date.now())/SHOW_MS)+')';
    if(loaded===src){ idle.style.display='none'; show.style.display='flex'; }
  }
  function poll(){
    var x=new XMLHttpRequest();
    x.open('GET','/api/tryon/tv-feed?'+q+'&t='+Date.now(),true);
    x.timeout=15000;
    x.onload=function(){
      if(x.status===403){ location.reload(); return; }
      var d; try{ d=JSON.parse(x.responseText); }catch(e){ return; }
      var items=(d&&d.items)||[];
      if(current){ var still=false; for(var i=0;i<items.length;i++) if(items[i].id===current.id) still=true; if(!still) current=null; }
      if(!current||Date.now()>until-SHOW_MS+15000){
        for(var j=items.length-1;j>=0;j--){ if(items[j].at>lastAt){ current=items[j]; lastAt=items[j].at; until=Date.now()+SHOW_MS; break; } }
      }
      render();
    };
    x.send();
  }
  setInterval(poll,POLL_MS); setInterval(render,500); poll();
  // keep the screen awake where the browser allows it; reload twice a day to pick up updates
  function awake(){ try{ var p=navigator.wakeLock.request('screen'); if(p&&p['catch']) p['catch'](function(){}); }catch(e){} }
  if(navigator.wakeLock){ awake(); document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') awake(); }); }
  setTimeout(function(){ location.reload(); }, 12*3600*1000);
})();
`;

export default async function TryonDisplay({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  // Not paired yet: a 6-digit code to type in Settings > Try-on > Pair a TV; the TV then switches by itself
  if (!(await tvAllowed(key))) {
    const p = await startPairing();
    return (
      <>
        <style>{CSS + PAIR_CSS}</style>
        <div className="tv pair" data-testid="tv-pair">
          <div className="brand">SUXUS HERITAGE TAILOR</div>
          <div className="tvml" style={{ fontSize: "5vh" }}>
            ഈ ടി.വി. ജോടിയാക്കാൻ ഫോണിൽ ഈ കോഡ് അടിക്കുക
          </div>
          <div className="en">To connect this TV, type this code on your phone</div>
          <div className="pcode" data-testid="tv-pair-code">
            {p.code.slice(0, 3)} {p.code.slice(3)}
          </div>
          <div className="en" style={{ fontSize: "3.6vh" }}>
            ERP → Settings → Try-on → <b>Pair a TV</b>
          </div>
          <div className="small">The code changes every 15 minutes · കോഡ് 15 മിനിറ്റ് കഴിഞ്ഞാൽ മാറും</div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: PAIR_SCRIPT(p.nonce) }} />
      </>
    );
  }
  const [shop, qr] = await Promise.all([getSetting("shop"), tryonQrSvg()]);
  return (
    <>
      <meta httpEquiv="refresh" content="43200" />
      <style>{CSS}</style>
      <div id="idle" className="tv" data-testid="tv-idle" suppressHydrationWarning>
        <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="txt">
          <div className="brand">SUXUS HERITAGE TAILOR</div>
          <div className="tvml">സ്കാൻ ചെയ്ത് ഓർഡർ ചെയ്യും മുമ്പ് നിങ്ങളുടെ തുണി ട്രൈ ചെയ്യൂ</div>
          <div className="en">Scan to try your fabric before you order</div>
          <div className="phone">{shop.phone}</div>
          <div className="small">{TRYON_URL.replace("https://", "")}</div>
        </div>
      </div>
      <div id="show" className="tv" data-testid="tv-show" suppressHydrationWarning>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="img" alt="" suppressHydrationWarning />
        <div className="txt">
          <div className="brand">SUXUS HERITAGE TAILOR</div>
          <div id="code" className="code" suppressHydrationWarning />
          <div id="name" className="name" suppressHydrationWarning />
          <div id="meta" className="meta" suppressHydrationWarning />
          <div className="bar">
            <i id="bar" suppressHydrationWarning />
          </div>
          <div className="mini">
            <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
            <div>
              <div className="tvml" style={{ fontSize: "4.4vh" }}>
                നിങ്ങൾക്കും ട്രൈ ചെയ്യാം
              </div>
              <div className="en" style={{ fontSize: "3.4vh" }}>
                Try yours — scan the code
              </div>
            </div>
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT(key && key.length >= 32 ? key : "") }} />
    </>
  );
}
