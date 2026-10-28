"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  alt: string;
  caption?: string;
  shape?: "tall" | "wide" | "square";
  priority?: boolean;
};

/* Real shop photos go in public/images/. Until a file exists, the block shows a
   quiet labelled placeholder so the layout stays intact. */
export function Photo({ src, alt, caption, shape = "tall", priority }: Props) {
  const [missing, setMissing] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // The image may fail before hydration attaches onError.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setMissing(true);
  }, []);

  const cls = ["ph", shape !== "tall" && shape, missing && "empty"].filter(Boolean).join(" ");

  return (
    <figure className={cls}>
      {!missing && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setMissing(true)}
        />
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
