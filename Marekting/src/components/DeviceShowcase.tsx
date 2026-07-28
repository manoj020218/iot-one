import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { deviceShowcaseCards, deviceShowcaseHeading } from "../content/deviceShowcaseContent";
import { DeviceIcon } from "./DeviceShowcaseIcons";

const CONTACT_PATH = "/contact";

export function DeviceShowcase() {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });

  const cardCount = deviceShowcaseCards.length;

  const toggleFlip = (id: string) => {
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToIndex = (index: number) => {
    const card = cardRefs.current[index];
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const step = (direction: number) => {
    const track = trackRef.current;
    const firstCard = cardRefs.current[0];
    if (!track || !firstCard) return;
    const width = firstCard.getBoundingClientRect().width + 20;
    track.scrollBy({ left: direction * width, behavior: "smooth" });
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry;
          }
        }
        if (best) {
          const index = cardRefs.current.indexOf(best.target as HTMLElement);
          if (index >= 0) setActiveIndex(index);
        }
      },
      { root: track, threshold: [0.4, 0.6, 0.8] }
    );

    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function handleWheel(event: WheelEvent) {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        track!.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      draggingRef.current = true;
      movedRef.current = false;
      dragStartRef.current = { x: event.clientX, scrollLeft: track!.scrollLeft };
      track!.classList.add("is-dragging");
    }

    function handlePointerMove(event: PointerEvent) {
      if (!draggingRef.current) return;
      const dx = event.clientX - dragStartRef.current.x;
      if (Math.abs(dx) > 4) movedRef.current = true;
      track!.scrollLeft = dragStartRef.current.scrollLeft - dx;
    }

    function handlePointerUp() {
      draggingRef.current = false;
      track!.classList.remove("is-dragging");
    }

    function handleClickCapture(event: MouseEvent) {
      if (movedRef.current) {
        event.preventDefault();
        event.stopPropagation();
        movedRef.current = false;
      }
    }

    track.addEventListener("wheel", handleWheel, { passive: false });
    track.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    track.addEventListener("click", handleClickCapture, true);

    return () => {
      track.removeEventListener("wheel", handleWheel);
      track.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      track.removeEventListener("click", handleClickCapture, true);
    };
  }, []);

  const dots = useMemo(() => deviceShowcaseCards.map((card) => card.id), []);

  return (
    <section className="showcase-shell" aria-labelledby="device-showcase-heading">
      <div className="showcase-glow showcase-glow-magenta" aria-hidden="true" />
      <div className="showcase-glow showcase-glow-teal" aria-hidden="true" />

      <div className="section-heading">
        <span className="eyebrow">{deviceShowcaseHeading.eyebrow}</span>
        <h2 id="device-showcase-heading">{deviceShowcaseHeading.title}</h2>
        <p>{deviceShowcaseHeading.body}</p>
      </div>

      <p className="showcase-swipe-hint" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 5l7 7-7 7M4 12h16" />
        </svg>
        Swipe to explore every device
      </p>

      <div className="showcase-carousel">
        <div className="showcase-track" ref={trackRef} tabIndex={0} role="list" aria-label="Jenix device showcase, scrollable">
          {deviceShowcaseCards.map((card, index) => {
            const isFuture = card.category === "future";
            const isFlipped = Boolean(flippedIds[card.id]);

            return (
              <article
                className={`showcase-card showcase-card--${card.category}${isFuture ? " showcase-card--future" : ""}`}
                key={card.id}
                role="listitem"
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
              >
                <div className={`showcase-flip${isFlipped ? " is-flipped" : ""}`}>
                  <div className="showcase-face showcase-face-front">
                    <span className={`showcase-live${isFuture ? " showcase-live--future" : ""}`}>
                      <span className="showcase-live-dot" aria-hidden="true" />
                      {isFuture ? "NEXT" : "LIVE"}
                    </span>
                    <div className="showcase-icon-tile">
                      <DeviceIcon id={card.id} category={card.category} />
                    </div>
                    <span className="showcase-chip">{card.categoryLabel}</span>
                    <h3>{card.name}</h3>
                    <p className="showcase-tagline">{card.tagline}</p>
                    <div className="showcase-problem-label">{card.problemLabel}</div>
                    <p className="showcase-problem-text">{card.problem}</p>
                    <div className="showcase-front-bottom">
                      <button
                        className="showcase-flip-trigger"
                        type="button"
                        aria-expanded={isFlipped}
                        onClick={() => toggleFlip(card.id)}
                      >
                        <span>How Smart One solves it</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="showcase-face showcase-face-back">
                    <div className="showcase-fix-label">{card.fixLabel}</div>
                    {card.fix ? (
                      <ul className="showcase-fix-list">
                        {card.fix.map((item) => (
                          <li key={item}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="showcase-fix-body">{card.fixBody}</p>
                    )}
                    <div className="showcase-back-bottom">
                      <Link className="showcase-cta" to={CONTACT_PATH}>
                        {card.ctaLabel}
                      </Link>
                      <button
                        className="showcase-back-trigger"
                        type="button"
                        aria-expanded={isFlipped}
                        onClick={() => toggleFlip(card.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 6l-6 6 6 6" />
                        </svg>
                        Back to overview
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="showcase-controls">
          <button
            className="showcase-arrow"
            type="button"
            aria-label="Previous device"
            disabled={activeIndex === 0}
            onClick={() => step(-1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <div className="showcase-dots" role="tablist" aria-label="Device slides">
            {dots.map((id, index) => (
              <button
                key={id}
                type="button"
                className={`showcase-dot${index === activeIndex ? " is-active" : ""}`}
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Go to device ${index + 1} of ${cardCount}`}
                onClick={() => scrollToIndex(index)}
              />
            ))}
          </div>
          <button
            className="showcase-arrow"
            type="button"
            aria-label="Next device"
            disabled={activeIndex === cardCount - 1}
            onClick={() => step(1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
