"use client";

import { useTranslations } from "@workspace/i18n";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_SCENE_GEOMETRY,
  type NotificationSceneGeometry,
  notificationSceneFrame,
  SCENE_DURATION_SECONDS,
} from "./notification-empty-motion";
import styles from "./notification-empty-state.module.css";

type ArtworkPart = "body" | "head" | "upperArm" | "forearm";

interface NotificationEmptyStateProps {
  onEntranceStarted?: () => void;
  playEntrance?: boolean;
}

/** Decorative, articulated empty-state scene; the card copy remains real text. */
export function NotificationEmptyState({
  onEntranceStarted,
  playEntrance = true,
}: NotificationEmptyStateProps) {
  const t = useTranslations("NotificationCenter");
  const reducedMotion = useReducedMotion();
  const [playOnMount] = useState(playEntrance);
  const [artworkReady, setArtworkReady] = useState(false);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [settled, setSettled] = useState(!playOnMount || !!reducedMotion);
  const [geometry, setGeometry] = useState<NotificationSceneGeometry>(
    DEFAULT_SCENE_GEOMETRY
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const eyeletRef = useRef<HTMLSpanElement>(null);
  const loadedArtworkParts = useRef(new Set<ArtworkPart>());
  const entranceFinished = useRef(false);
  const progress = useMotionValue(playOnMount && !reducedMotion ? 0 : 1);
  const frame = useTransform(progress, (value) =>
    notificationSceneFrame(
      reducedMotion || !playOnMount || artworkFailed ? 1 : value,
      geometry
    )
  );
  const cardY = useTransform(frame, (value) => value.cardY * geometry.scale);
  const cardAngle = useTransform(frame, (value) => value.cardAngle);
  const bodyTransform = useTransform(frame, (value) => value.bodyTransform);
  const handTransform = useTransform(frame, (value) => value.handTransform);
  const upperArmTransform = useTransform(
    frame,
    (value) => value.upperArmTransform
  );
  const forearmTransform = useTransform(
    frame,
    (value) => value.forearmTransform
  );
  const shoulderPath = useTransform(frame, (value) => value.shoulderPath);
  const ropePath = useTransform(frame, (value) => value.ropePath);
  const headTransform = useTransform(
    frame,
    (value) =>
      `translate(98px, 86px) rotate(${value.headAngle}deg) translate(-98px, -86px)`
  );
  const gripOpacity = useTransform(frame, (value) => value.gripAmount);
  const bellAngle = useTransform(frame, (value) => value.bellAngle);
  const openHandAngle = useTransform(frame, (value) => value.openHandAngle);
  const impactOpacity = useTransform(frame, (value) => value.impactOpacity);
  const ringOpacity = useTransform(frame, (value) =>
    Math.min(1, value.impactOpacity * 1.8)
  );
  const bellColor = useTransform(
    frame,
    (value) =>
      `color-mix(in oklab, #c58f6c ${value.impactOpacity * 160}%, color-mix(in oklab, var(--foreground) 84%, var(--muted-foreground)))`
  );
  const ringScale = useTransform(
    frame,
    (value) => 0.7 + value.impactProgress * 0.5
  );
  const landingMarks = useTransform(frame, (value) => {
    const { card } = geometry;
    const floor = card.y + card.height + 2;
    const spread = value.impactProgress * 16;
    return `M${card.x - 4 - spread} ${floor - 3} q-5 -3 -10 0 M${card.x - 1 - spread * 0.6} ${floor + 3} h-8 M${card.x + card.width + 4 + spread} ${floor - 3} q5 -3 10 0 M${card.x + card.width + 1 + spread * 0.6} ${floor + 3} h8`;
  });
  const handleArtworkLoad = useCallback((part: ArtworkPart) => {
    loadedArtworkParts.current.add(part);
    if (
      loadedArtworkParts.current.has("body") &&
      loadedArtworkParts.current.has("head") &&
      loadedArtworkParts.current.has("upperArm") &&
      loadedArtworkParts.current.has("forearm")
    ) {
      setArtworkReady(true);
    }
  }, []);
  const handleArtworkError = useCallback(() => {
    setArtworkFailed(true);
    setArtworkReady(true);
  }, []);
  const id = useId().replaceAll(":", "");
  const paint = (name: string) => `url(#${id}-${name})`;

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const card = cardRef.current;
    const eyelet = eyeletRef.current;
    if (!(scene && card && eyelet)) {
      return;
    }
    const measure = () => {
      // Layout values exclude the parent popover's opening transform.
      const sceneStyle = getComputedStyle(scene);
      const cardStyle = getComputedStyle(card);
      const eyeletStyle = getComputedStyle(eyelet);
      const scale = Number.parseFloat(sceneStyle.width) / 380;
      if (!(scale > 0)) {
        return;
      }
      const x = Number.parseFloat(cardStyle.left) / scale;
      const y = Number.parseFloat(cardStyle.top) / scale;
      const next = {
        scale,
        height: Number.parseFloat(sceneStyle.height) / scale,
        card: {
          x,
          y,
          width: Number.parseFloat(cardStyle.width) / scale,
          height: Number.parseFloat(cardStyle.height) / scale,
        },
        anchor: {
          x:
            x + (Number.parseFloat(eyeletStyle.left) + card.clientLeft) / scale,
          y:
            y +
            (Number.parseFloat(eyeletStyle.top) +
              Number.parseFloat(eyeletStyle.height) / 2 +
              card.clientTop) /
              scale,
        },
      };
      setGeometry((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next
      );
      setLayoutReady(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      reducedMotion ||
      !playOnMount ||
      artworkFailed ||
      entranceFinished.current
    ) {
      entranceFinished.current = true;
      progress.jump(1);
      setSettled(true);
      return;
    }
    if (!(artworkReady && layoutReady)) {
      return;
    }
    onEntranceStarted?.();
    progress.jump(0);
    setSettled(false);
    const controls = animate(progress, 1, {
      duration: SCENE_DURATION_SECONDS,
      delay: 0.16,
      ease: "linear",
      onComplete: () => {
        entranceFinished.current = true;
        setSettled(true);
      },
    });
    return () => controls.stop();
  }, [
    artworkReady,
    artworkFailed,
    layoutReady,
    onEntranceStarted,
    playOnMount,
    progress,
    reducedMotion,
  ]);

  return (
    <div
      className={styles.scene}
      data-reduced-motion={!!reducedMotion}
      data-settled={settled}
      ref={sceneRef}
    >
      <svg
        aria-hidden="true"
        className={styles.backdrop}
        fill="none"
        viewBox={`0 0 380 ${geometry.height}`}
      >
        <defs>
          <radialGradient id={`${id}-floor`}>
            <stop stopColor="currentColor" stopOpacity="0.13" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={`${id}-cord`}
            x1="230"
            x2="236"
            y2="160"
          >
            <stop stopColor="#73665a" stopOpacity="0.15" />
            <stop offset="0.65" stopColor="#bfa48a" />
            <stop offset="1" stopColor="#dfbb99" />
          </linearGradient>
        </defs>
        <ellipse
          cx="209"
          cy={geometry.height - 20}
          fill={paint("floor")}
          rx="168"
          ry="10"
        />
        <motion.path
          d={ropePath}
          data-part="rope"
          stroke={paint("cord")}
          strokeWidth="1.7"
        />
        <motion.path
          d={landingMarks}
          data-part="landing-marks"
          stroke="#b9977a"
          strokeLinecap="round"
          strokeWidth="1.2"
          style={{ opacity: impactOpacity }}
        />
      </svg>

      <motion.div
        className={styles.card}
        data-part="card"
        ref={cardRef}
        style={{
          y: cardY,
          rotate: cardAngle,
          transformOrigin: `${(geometry.anchor.x - geometry.card.x) * geometry.scale}px ${(geometry.anchor.y - geometry.card.y) * geometry.scale}px`,
        }}
      >
        <span
          aria-hidden="true"
          className={styles.eyelet}
          data-part="eyelet"
          ref={eyeletRef}
        />
        <motion.span
          aria-hidden="true"
          className={styles.impactEdge}
          style={{ opacity: impactOpacity }}
        />
        <motion.div
          aria-hidden="true"
          className={styles.bell}
          style={{ color: bellColor }}
        >
          <svg fill="none" viewBox="0 0 64 60">
            <path
              d="M29 11V8a3 3 0 0 1 6 0v3"
              stroke="currentColor"
              strokeWidth="2.25"
            />
            <motion.g
              className={styles.bellSwing}
              style={{
                rotate: bellAngle,
                originX: "32px",
                originY: "10px",
                transformBox: "view-box",
              }}
            >
              <path
                d="M18 28c0-9 5-16 14-16s14 7 14 16c0 10 4 10 4 14 0 3-8 4-18 4s-18-1-18-4c0-4 4-4 4-14Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.25"
              />
              <path
                d="M27 51c1 5 9 5 10 0"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.25"
              />
            </motion.g>
            <g
              className={styles.bellMarks}
              stroke="#c58f6c"
              strokeLinecap="round"
              strokeWidth="1.7"
            >
              <path d="m7 20-4-2M56 19l4-3M55 27l5-1" />
            </g>
            <motion.g
              data-part="bell-ring"
              stroke="#c58f6c"
              strokeLinecap="round"
              strokeWidth="1.7"
              style={{
                opacity: ringOpacity,
                scale: ringScale,
                originX: "32px",
                originY: "30px",
                transformBox: "view-box",
              }}
            >
              <path d="M8 19c-4 5-4 13-1 18M2 16c-5 7-5 17-1 24M56 19c4 5 4 13 1 18M62 16c5 7 5 17 1 24" />
            </motion.g>
          </svg>
        </motion.div>
        <p className={styles.title}>{t("emptyTitle")}</p>
        <p className={styles.description}>{t("emptyDescription")}</p>
      </motion.div>

      <svg
        aria-hidden="true"
        className={styles.character}
        fill="none"
        style={{ opacity: artworkFailed || !artworkReady ? 0 : 1 }}
        viewBox={`0 0 380 ${geometry.height}`}
      >
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={`${id}-sleeve-blend`}
            x1="174"
            x2="1050"
          >
            <stop stopColor="white" stopOpacity="0" />
            <stop offset="0.27" stopColor="white" />
            <stop offset="0.83" stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask
            height="724"
            id={`${id}-sleeve-root`}
            maskUnits="userSpaceOnUse"
            width="2172"
            x="0"
            y="0"
          >
            <rect fill={paint("sleeve-blend")} height="724" width="2172" />
          </mask>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={`${id}-elbow-feather`}
            x1="810"
            x2="970"
          >
            <stop stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="white" />
          </linearGradient>
          <mask
            height="724"
            id={`${id}-forearm-root`}
            maskUnits="userSpaceOnUse"
            width="2172"
            x="0"
            y="0"
          >
            <rect fill={paint("elbow-feather")} height="724" width="2172" />
          </mask>
          <clipPath id={`${id}-upper-arm`}>
            <rect height="724" width="876" x="174" y="0" />
          </clipPath>
          <clipPath id={`${id}-forearm`}>
            <rect height="724" width="1362" x="810" y="0" />
          </clipPath>
          <clipPath id={`${id}-head`}>
            <rect height="86.5" width="380" />
          </clipPath>
          <clipPath id={`${id}-body`}>
            <path d="M0 86H125V108H380V300H0Z" />
          </clipPath>
        </defs>

        <motion.g
          data-part="body"
          style={{
            transform: bodyTransform,
            originX: 0,
            originY: 0,
            transformBox: "view-box",
          }}
        >
          {/* The same lossless artwork is clipped at the neck to articulate the
                head independently. SVG image keeps it in the arm's coordinate space. */}
          <image
            clipPath={paint("body")}
            height="255"
            href="/illustrations/notification-boy.webp"
            onError={handleArtworkError}
            onLoad={() => handleArtworkLoad("body")}
            width="170"
            x="12"
            y="33"
          />
          <motion.g
            style={{
              transform: headTransform,
              originX: 0,
              originY: 0,
              transformBox: "view-box",
            }}
          >
            <g className={styles.head}>
              <g transform="translate(98 86) scale(1.12) translate(-98 -86)">
                <image
                  clipPath={paint("head")}
                  height="255"
                  href="/illustrations/notification-boy.webp"
                  onError={handleArtworkError}
                  onLoad={() => handleArtworkLoad("head")}
                  width="170"
                  x="12"
                  y="33"
                />
              </g>
            </g>
          </motion.g>
          <path
            className={styles.steam}
            d="M84 108c-4-4 4-7 1-12m5 10c-2-3 3-5 1-8"
            stroke="#c9c4b9"
            strokeLinecap="round"
            strokeOpacity="0.4"
            strokeWidth="0.9"
          />
          <motion.path
            d={shoulderPath}
            data-part="shoulder-join"
            fill="#eee8df"
          />
          <motion.g
            style={{
              transform: upperArmTransform,
              originX: 0,
              originY: 0,
              transformBox: "view-box",
            }}
          >
            <image
              clipPath={paint("upper-arm")}
              height="724"
              href="/illustrations/notification-arm.webp"
              mask={paint("sleeve-root")}
              onError={handleArtworkError}
              onLoad={() => handleArtworkLoad("upperArm")}
              preserveAspectRatio="none"
              width="2172"
            />
          </motion.g>
          <motion.g
            style={{
              transform: forearmTransform,
              originX: 0,
              originY: 0,
              transformBox: "view-box",
            }}
          >
            <image
              clipPath={paint("forearm")}
              height="724"
              href="/illustrations/notification-arm.webp"
              mask={paint("forearm-root")}
              onError={handleArtworkError}
              onLoad={() => handleArtworkLoad("forearm")}
              preserveAspectRatio="none"
              width="2172"
            />
          </motion.g>
          <motion.g
            data-part="hand"
            style={{
              transform: handTransform,
              originX: 0,
              originY: 0,
              transformBox: "view-box",
            }}
          >
            <motion.g
              style={{
                rotate: openHandAngle,
                originX: 0,
                originY: 0,
                transformBox: "view-box",
              }}
            >
              <motion.ellipse
                cx="0"
                cy="0"
                data-part="grip-shadow"
                fill="#75675a"
                fillOpacity="0.18"
                rx="2.5"
                ry="0.65"
                style={{ opacity: gripOpacity }}
              />
            </motion.g>
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}
