import type * as React from "react";

/**
 * Ionicons `cash-outline` SVG vector icon.
 */
export function CashOutlineIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        fill="none"
        height="256"
        rx="16"
        ry="16"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="32"
        width="448"
        x="32"
        y="80"
      />
      <line
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
        x1="64"
        x2="448"
        y1="384"
        y2="384"
      />
      <line
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
        x1="96"
        x2="416"
        y1="432"
        y2="432"
      />
      <circle
        cx="256"
        cy="208"
        fill="none"
        r="80"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
      <path
        d="M480 160a80 80 0 0 1-80-80M32 160a80 80 0 0 0 80-80m368 96a80 80 0 0 0-80 80M32 256a80 80 0 0 1 80 80"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="32"
      />
    </svg>
  );
}

export function UrgentPriorityIcon({
  className,
  strokeWidth = 2.2,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path
        d="M13 5.5L7.5 13H12L11 18.5L16.5 11H12L13 5.5Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/**
 * Create Workspace / layout-dashboard SVG icon.
 */
export function CreateWorkspaceIcon({
  className,
  strokeWidth = 2,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect height="9" rx="1" width="7" x="3" y="3" />
      <rect height="5" rx="1" width="7" x="14" y="3" />
      <rect height="9" rx="1" width="7" x="14" y="12" />
      <rect height="5" rx="1" width="7" x="3" y="16" />
    </svg>
  );
}

/**
 * Preview health heart-rate-monitor SVG icon (Tabler heart-rate-monitor).
 */
export function PreviewHealthIcon({
  className,
  strokeWidth = 2,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" stroke="none" />
      <path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1l0 -10" />
      <path d="M7 20h10" />
      <path d="M9 16v4" />
      <path d="M15 16v4" />
      <path d="M7 10h2l2 3l2 -6l1 3h3" />
    </svg>
  );
}

/**
 * High priority upward chevrons outline SVG icon.
 */
export function HighPriorityIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M18 11.5C18 11.5 13.5811 5.50001 12 5.5C10.4188 5.49999 6 11.5 6 11.5" />
      <path d="M18 18.5C18 18.5 13.5811 12.5 12 12.5C10.4188 12.5 6 18.5 6 18.5" />
    </svg>
  );
}

/**
 * Medium priority horizontal lines outline SVG icon.
 */
export function MediumPriorityIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M4 8H20" />
      <path d="M4 16H20" />
    </svg>
  );
}

/**
 * Low priority downward chevrons outline SVG icon.
 */
export function LowPriorityIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M17 6.00004C17 6.00004 13.3176 11 12 11C10.6824 11 7 6 7 6" />
      <path d="M17 13C17 13 13.3176 18 12 18C10.6824 18 7 13 7 13" />
    </svg>
  );
}

/**
 * Kanban board outline SVG icon.
 */
export function KanbanBoardIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.5 2.5V21.5" />
      <path d="M15.5 2.5V21.5" />
    </svg>
  );
}

/**
 * Tabler checklist outline SVG icon.
 */
export function ChecklistIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "2"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" stroke="none" />
      <path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" />
      <path d="M14 19l2 2l4 -4" />
      <path d="M9 8h4" />
      <path d="M9 12h2" />
    </svg>
  );
}

/**
 * User with crown/VIP outline SVG icon for Upgrade to Pro.
 */
export function UpgradeToProIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" />
      <path d="M5 20V19C5 15.134 8.13401 12 12 12C13.0736 12 14.0907 12.2417 15 12.6736" />
      <path d="M21 22L22 16L18.5 17.8L17 16L15.5 17.8L12 16L13 22H21Z" />
    </svg>
  );
}

/**
 * Auto mode refresh-ccw outline SVG icon.
 */
export function AutoModeIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "2"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

/**
 * YOLO mode outline SVG icon.
 */
export function YoloModeIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "1.8"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M14 3L4 14h7l-1 7 10-11h-7l1-7z" />
    </svg>
  );
}

export function MainPlannerIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="19" r="3" />
      <path d="M12 5H8.5C6.567 5 5 6.567 5 8.5C5 10.433 6.567 12 8.5 12H15.5C17.433 12 19 13.567 19 15.5C19 17.433 17.433 19 15.5 19H12" />
    </svg>
  );
}

/**
 * Processes section route outline SVG icon.
 */
export function ProcessesIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M17.0298 13.3482C17.5713 13.0991 17.842 12.9746 17.921 12.8513C18 12.728 18 12.5316 18 12.1387V11.8613C18 11.4685 18 11.272 17.921 11.1487C17.842 11.0254 17.5712 10.9009 17.0298 10.6519C16.2269 10.2827 15.7113 9.4748 15.7389 8.62937C15.76 7.98338 15.7706 7.66038 15.7005 7.53758C15.6304 7.41478 15.4608 7.32183 15.1215 7.13594L14.7988 6.95919C14.4699 6.77898 14.3054 6.68887 14.1649 6.69551C14.0244 6.70215 13.7855 6.86408 13.3077 7.18794C12.5306 7.71461 11.4704 7.71459 10.6933 7.18789C10.2154 6.86403 9.97652 6.70209 9.83603 6.69545C9.69554 6.68881 9.53106 6.77892 9.20212 6.95913L8.87949 7.13588C8.54023 7.32174 8.3706 7.41467 8.30054 7.53744C8.23048 7.66021 8.24097 7.98325 8.26193 8.62934C8.28937 9.47481 7.77333 10.2827 6.97024 10.6519C6.4288 10.9008 6.15807 11.0253 6.07904 11.1486C6 11.2719 6 11.4684 6 11.8613V12.1387C6 12.5316 6 12.7281 6.07902 12.8514C6.15804 12.9747 6.42877 13.0992 6.97023 13.3482C7.77308 13.7174 8.28871 14.5253 8.26109 15.3707C8.23999 16.0167 8.22944 16.3397 8.2995 16.4625C8.36956 16.5853 8.53922 16.6782 8.87854 16.8641L9.20117 17.0409C9.53017 17.2211 9.69466 17.3112 9.83518 17.3046C9.9757 17.2979 10.2145 17.136 10.6922 16.812C11.4699 16.2847 12.5311 16.2847 13.3087 16.812C13.7864 17.1359 14.0253 17.2979 14.1658 17.3045C14.3063 17.3112 14.4708 17.2211 14.7998 17.0408L15.1224 16.8641C15.4618 16.6781 15.6315 16.5852 15.7015 16.4623C15.7716 16.3395 15.761 16.0166 15.7397 15.3707C15.7119 14.5253 16.2272 13.7174 17.0298 13.3482Z"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.75" />
      <path
        d="M19 2V4.85857C17.1962 3.09032 14.7255 2 12 2C6.47715 2 2 6.47715 2 12C2 13.4222 2.29689 14.7751 2.83209 16M5 22V19.1414C6.80375 20.9097 9.27455 22 12 22C17.5228 22 22 17.5228 22 12C22 10.5778 21.7031 9.22492 21.1679 8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Bot assistant outline SVG icon.
 */
export function BotIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 4V2" />
      <path d="M20 22C20 17.5817 16.4183 14 12 14C7.58172 14 4 17.5817 4 22" />
      <path d="M9.375 8.25H9.25M9.5 8.25C9.5 8.38807 9.38807 8.5 9.25 8.5C9.11193 8.5 9 8.38807 9 8.25C9 8.11193 9.11193 8 9.25 8C9.38807 8 9.5 8.11193 9.5 8.25Z" />
      <path d="M14.875 8.25H14.75M15 8.25C15 8.38807 14.8881 8.5 14.75 8.5C14.6119 8.5 14.5 8.38807 14.5 8.25C14.5 8.11193 14.6119 8 14.75 8C14.8881 8 15 8.11193 15 8.25Z" />
      <path d="M15.1538 4H8.84615C7.59095 4 6.96334 4 6.47397 4.22025C5.91693 4.47095 5.47095 4.91693 5.22025 5.47397C5 5.96334 5 6.59095 5 7.84615C5 9.85448 5 10.8586 5.3524 11.6417C5.75353 12.5329 6.46709 13.2465 7.35835 13.6476C8.14135 14 9.14552 14 11.1538 14H12.8462C14.8545 14 15.8586 14 16.6417 13.6476C17.5329 13.2465 18.2465 12.5329 18.6476 11.6417C19 10.8586 19 9.85448 19 7.84615C19 6.59095 19 5.96334 18.7797 5.47397C18.529 4.91693 18.0831 4.47095 17.526 4.22025C17.0367 4 16.4091 4 15.1538 4Z" />
    </svg>
  );
}

export const AgentIcon = BotIcon;

/**
 * General Orchestrator tabler cpu-2 outline SVG icon.
 */
export function GeneralOrchestratorIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "2"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" stroke="none" />
      <path d="M5 6a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -12" />
      <path d="M8 10v-2h2m6 6v2h-2m-4 0h-2v-2m8 -4v-2h-2" />
      <path d="M3 10h2" />
      <path d="M3 14h2" />
      <path d="M10 3v2" />
      <path d="M14 3v2" />
      <path d="M21 10h-2" />
      <path d="M21 14h-2" />
      <path d="M14 21v-2" />
      <path d="M10 21v-2" />
    </svg>
  );
}

/**
 * Task issue outline SVG icon.
 */
export function TaskIssueIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M19.25 14V8C19.25 5.17157 19.25 3.75736 18.3713 2.87868C17.4926 2 16.0784 2 13.25 2H9.25C6.42157 2 5.00736 2 4.12868 2.87868C3.25 3.75736 3.25 5.17157 3.25 8V16C3.25 18.8284 3.25 20.2426 4.12868 21.1213C5.00736 22 6.42157 22 9.25 22H13.25" />
      <path d="M14.75 2H7.75C7.75 3.41421 7.75 4.12132 8.18934 4.56066C8.62868 5 9.33579 5 10.75 5H11.75C13.1642 5 13.8713 4.56066 14.3107 4.56066C14.75 4.12132 14.75 3.41421 14.75 2Z" />
      <path d="M7.25 15H11.25M7.25 11H15.25" />
      <path d="M21.25 17L18.75 19.5M18.75 19.5L16.25 22M18.75 19.5L21.25 22M18.75 19.5L16.25 17" />
    </svg>
  );
}

/**
 * Task completed clipboard-check outline SVG icon.
 */
export function TaskCompletedIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "2"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect height="4" rx="1" ry="1" width="8" x="8" y="2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

/**
 * Vision Provider picture/image outline SVG icon.
 */
export function VisionProviderIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle
        cx="7.5"
        cy="7.5"
        r="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" />
      <path d="M5 21C9.37246 15.775 14.2741 8.88406 21.4975 13.5424" />
    </svg>
  );
}

/**
 * Account circle user round outline SVG icon.
 */
export function AccountIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? "2"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M17.925 20.056a6 6 0 0 0-11.851.001" />
      <circle cx="12" cy="11" r="4" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

/**
 * Notification bell solid SVG icon.
 */
export function NotificationBellIcon({
  className,
  fill = "currentColor",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={fill}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M168,224a8,8,0,0,1-8,8H96a8,8,0,1,1,0-16h64A8,8,0,0,1,168,224Zm53.85-32A15.8,15.8,0,0,1,208,200H48a16,16,0,0,1-13.8-24.06C39.75,166.38,48,139.34,48,104a80,80,0,1,1,160,0c0,35.33,8.26,62.38,13.81,71.94A15.89,15.89,0,0,1,221.84,192ZM208,184c-7.73-13.27-16-43.95-16-80a64,64,0,1,0-128,0c0,36.06-8.28,66.74-16,80Z" />
    </svg>
  );
}

/**
 * Worktree branching SVG icon.
 */
export function WorktreeIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      color="currentColor"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? "1.5"}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M6 8C7.10457 8 8 7.10457 8 6C8 4.89543 7.10457 4 6 4C4.89543 4 4 4.89543 4 6C4 7.10457 4.89543 8 6 8Z" />
      <path d="M12 20C13.1046 20 14 19.1046 14 18C14 16.8954 13.1046 16 12 16C10.8954 16 10 16.8954 10 18C10 19.1046 10.8954 20 12 20Z" />
      <path d="M18 8C19.1046 8 20 7.10457 20 6C20 4.89543 19.1046 4 18 4C16.8954 4 16 4.89543 16 6C16 7.10457 16.8954 8 18 8Z" />
      <path
        d="M6.01734 8.74067C6.01734 10.4142 5.77537 12.1995 9.22051 11.9855H12.0053M17.9929 8.57617C18.1259 11.9855 16.9199 11.7648 15.7861 11.9855H12.0053M12.0053 15.7001V11.9855"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Tabler pencil / pen outline SVG icon.
 */
export function PenIcon({
  className,
  strokeWidth = 1.5,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M3.49977 18.9853V20.5H5.01449C6.24074 20.5 6.85387 20.5 7.40518 20.2716C7.9565 20.0433 8.39004 19.6097 9.25713 18.7426L19.1211 8.87868C20.0037 7.99612 20.4449 7.55483 20.4937 7.01325C20.5018 6.92372 20.5018 6.83364 20.4937 6.74411C20.4449 6.20253 20.0037 5.76124 19.1211 4.87868C18.2385 3.99612 17.7972 3.55483 17.2557 3.50605C17.1661 3.49798 17.0761 3.49798 16.9865 3.50605C16.4449 3.55483 16.0037 3.99612 15.1211 4.87868L5.25713 14.7426C4.39004 15.6097 3.9565 16.0433 3.72813 16.5946C3.49977 17.1459 3.49977 17.759 3.49977 18.9853Z" />
      <path d="M13.5 6.5L17.5 10.5" />
    </svg>
  );
}

export { PenIcon as PencilIcon };

/**
 * Tabler adjustments-cog outline SVG icon.
 */
export function AdjustmentsCogIcon({
  className,
  strokeWidth = 2,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" stroke="none" />
      <path d="M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M6 4v4" />
      <path d="M6 12v8" />
      <path d="M13.199 14.399a2 2 0 1 0 -1.199 3.601" />
      <path d="M12 4v10" />
      <path d="M12 18v2" />
      <path d="M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M18 4v1" />
      <path d="M18 9v2.5" />
      <path d="M17.001 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M19.001 15.5v1.5" />
      <path d="M19.001 21v1.5" />
      <path d="M22.032 17.25l-1.299 .75" />
      <path d="M17.27 20l-1.3 .75" />
      <path d="M15.97 17.25l1.3 .75" />
      <path d="M20.733 20l1.3 .75" />
    </svg>
  );
}
