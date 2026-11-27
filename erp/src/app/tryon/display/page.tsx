import type { Metadata, Viewport } from "next";
import { getSetting } from "@/lib/settings";
import { tvAllowed } from "@/lib/tryon-tv";
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
.tv{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;gap:5vw;padding:4vh 5vw;box-sizing:border-box}
.qr{background:#fff;padding:1.6vh;border-radius:2vh;height:72vh;width:72vh;box-sizing:border-box;flex:none}
.qr svg{width:100%;height:100%;display:block}
.txt{display:flex;flex-direction:column;gap:3vh;max-width:48vw}
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
.mini{display:flex;align-items:center;gap:2vw;margin-top:2vh}
.mini .qr{height:22vh;width:22vh;padding:.8vh;border-radius:1vh}
.bar{height:.9vh;background:rgba(255,255,255,.18);border-radius:1vh;overflow:hidden;width:100%}
.bar i{display:block;height:100%;width:100%;background:#c8a96a;transform-origin:left}
`;

/** ES5 only (old TV browsers): poll every 4 s; a newly shown result stays 45 s; a removed one leaves at once. */
const SCRIPT = (key: string) => `
(function(){
  var KEY=${JSON.stringify(key)}, SHOW_MS=45000, POLL_MS=4000;
  var idle=document.getElementById('idle'), show=document.getElementById('show'), img=document.getElementById('img');
  var code=document.getElementById('code'), name=document.getElementById('name'), meta=document.getElementById('meta'), bar=document.getElementById('bar');
  var lastAt=Date.now()-60000, current=null, until=0;
  var q=KEY?('key='+encodeURIComponent(KEY)):'';
  function toIdle(){ current=null; show.style.display='none'; idle.style.display='flex'; img.removeAttribute('src'); }
  function present(it){
    current=it; until=Date.now()+SHOW_MS; lastAt=it.at;
    code.textContent=it.code; name.textContent=it.name;
    var v=it.variant==='Full sleeve'?'\\u0D2B\\u0D41\\u0D7E \\u0D15\\u0D48 \\u00B7 Full sleeve':(it.variant==='Half sleeve'?'\\u0D39\\u0D3E\\u0D2B\\u0D4D \\u0D15\\u0D48 \\u00B7 Half sleeve':(it.variant||''));
    meta.textContent=v+(it.rate>0?(' \\u00B7 \\u20B9'+it.rate+' / m'):'');
    img.onload=function(){ idle.style.display='none'; show.style.display='flex'; };
    img.src='/api/tryon/tv-image/'+it.id+'?'+q+'&t='+it.at;
  }
  function tick(){
    if(current){
      var left=Math.max(0,until-Date.now()); bar.style.transform='scaleX('+(left/SHOW_MS)+')';
      if(left<=0) toIdle();
    }
  }
  function poll(){
    var x=new XMLHttpRequest();
    x.open('GET','/api/tryon/tv-feed?'+q+'&t='+Date.now(),true);
    x.timeout=15000;
    x.onload=function(){
      if(x.status===403){ location.reload(); return; }
      try{ var d=JSON.parse(x.responseText); }catch(e){ return; }
      var items=(d&&d.items)||[];
      if(current){ var still=false; for(var i=0;i<items.length;i++) if(items[i].id===current.id) still=true; if(!still){ toIdle(); } }
      if(!current||Date.now()>until-SHOW_MS+15000){
        for(var j=items.length-1;j>=0;j--){ if(items[j].at>lastAt){ present(items[j]); break; } }
      }
    };
    x.send();
  }
  setInterval(poll,POLL_MS); setInterval(tick,500); poll();
  // keep the screen awake where the browser allows it; reload twice a day to pick up updates
  function awake(){ try{ var p=navigator.wakeLock.request('screen'); if(p&&p['catch']) p['catch'](function(){}); }catch(e){} }
  if(navigator.wakeLock){ awake(); document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') awake(); }); }
  setTimeout(function(){ location.reload(); }, 12*3600*1000);
})();
`;

export default async function TryonDisplay({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (!(await tvAllowed(key)))
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0f2b24", color: "#f7f3e8", fontFamily: "sans-serif", textAlign: "center", padding: 24 }}>
        <p>
          This screen is for the shop TV.
          <br />
          Open it from Settings &gt; Try-on (signed in), or with the TV link shown there.
        </p>
      </div>
    );
  const [shop, qr] = await Promise.all([getSetting("shop"), tryonQrSvg()]);
  return (
    <>
      <meta httpEquiv="refresh" content="43200" />
      <style>{CSS}</style>
      <div id="idle" className="tv" data-testid="tv-idle">
        <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="txt">
          <div className="brand">SUXUS HERITAGE TAILOR</div>
          <div className="tvml">സ്കാൻ ചെയ്ത് ഓർഡർ ചെയ്യും മുമ്പ് നിങ്ങളുടെ തുണി ട്രൈ ചെയ്യൂ</div>
          <div className="en">Scan to try your fabric before you order</div>
          <div className="phone">{shop.phone}</div>
          <div className="small">{TRYON_URL.replace("https://", "")}</div>
        </div>
      </div>
      <div id="show" className="tv" data-testid="tv-show">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="img" alt="" />
        <div className="txt">
          <div className="brand">SUXUS HERITAGE TAILOR</div>
          <div id="code" className="code" />
          <div id="name" className="name" />
          <div id="meta" className="meta" />
          <div className="bar">
            <i id="bar" />
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
