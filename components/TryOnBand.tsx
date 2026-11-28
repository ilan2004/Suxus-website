import { TRYON_URL } from "@/lib/site";

/* Advert for the AI try-on on the ERP: the customer's own photo wearing one of our fabrics. */
export function TryOnBand({ num }: { num?: string }) {
  return (
    <section className="section dark tryon-band" id="try-on">
      <div className="wrap grid">
        <div className="c-6">
          <span className="label">{num ? `${num} / ` : ""}New · AI try-on</span>
          <h2>See our fabric on you — before it is stitched.</h2>
          <p className="ml-line" lang="ml">
            നിങ്ങളുടെ ഫോട്ടോയിൽ ഞങ്ങളുടെ തുണി ഇട്ടുനോക്കൂ.
          </p>
          <ol className="tryon-steps">
            <li>
              <b>1</b> Pick a shirt fabric from our stock
            </li>
            <li>
              <b>2</b> Take a photo with your phone
            </li>
            <li>
              <b>3</b> See yourself in that shirt in about 20 seconds
            </li>
          </ol>
          <div className="actions mt-m">
            <a className="btn gold" href={TRYON_URL} target="_blank" rel="noopener">
              Try it now — free
            </a>
          </div>
          <p className="muted small mt-s">
            A few tries per phone each day. Your photo is used only to make the picture and is deleted after 7 days. The
            colour on screen can differ a little from the real cloth — see it in the shop before ordering.
          </p>
        </div>
        <div className="c-5 s-8 tryon-visual" aria-hidden="true">
          <div className="tv-phone">
            <div className="tv-screen">
              <span className="tv-swatch" />
              <span className="tv-arrow">→</span>
              <span className="tv-shirt">
                <svg viewBox="0 0 64 64">
                  <path d="M22 6 L12 10 L4 22 L12 27 L16 22 L16 58 L48 58 L48 22 L52 27 L60 22 L52 10 L42 6 C40 11 36 13 32 13 C28 13 24 11 22 6 Z" />
                </svg>
              </span>
            </div>
            <span className="tv-cap">SUXUS Heritage Tailor · AI try-on</span>
          </div>
        </div>
      </div>
    </section>
  );
}
