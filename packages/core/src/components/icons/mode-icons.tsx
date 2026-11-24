"use client";

import { StaticIcon } from "@workspace/core/components/common/static-icon";
import { cn } from "@workspace/ui/lib/utils";

export interface ModeIconProps {
  className?: string;
}

export function TerminalModeIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-4 object-contain icon-ink", className)}
      src="/icons/terminal-static.png"
    />
  );
}

export function PreviewModeIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-4 object-contain icon-ink", className)}
      src="/icons/preview-static.png"
    />
  );
}

export function BoardModeIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-4 object-contain icon-ink", className)}
      src="/icons/board-static.png"
    />
  );
}

export function ChangesModeIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-4 object-contain icon-ink", className)}
      src="/icons/changes-static.png"
    />
  );
}

export function ProcessesModeIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-4 object-contain icon-ink", className)}
      src="/icons/gear-orbit-processes-static.svg"
    />
  );
}

export function TerminalWindowIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/terminal-window-static.png"
    />
  );
}

export function AdjustIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/adjust-static.png"
    />
  );
}

export function KanbanListViewIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/list-static.png"
    />
  );
}

export function NotificationBellIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/notification-bell-static.png"
    />
  );
}

export function ExportIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/export-static.png"
    />
  );
}

export function SettingsIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-4 object-contain icon-ink", className)}
      src="/icons/settings-static.png"
    />
  );
}

export function TrashIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/trash-static.png"
    />
  );
}

export function KanbanBoardViewIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt=""
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/board-static.png"
    />
  );
}

export function KeyIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt="API Key"
      className={cn("size-4 object-contain icon-ink", className)}
      src="/icons/key-static.png"
    />
  );
}

export function SystemHealthIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt="System Health"
      className={cn("size-4 object-contain icon-ink", className)}
      src="/icons/system-health-static.png"
    />
  );
}

export function DuplicateIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt="Duplicate"
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/duplicate-static.png"
    />
  );
}

export function PinIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt="Pin"
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/pin-static.png"
    />
  );
}

export function RenameIcon({ className }: ModeIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3.49977 18.9853V20.5H5.01449C6.24074 20.5 6.85387 20.5 7.40518 20.2716C7.9565 20.0433 8.39004 19.6097 9.25713 18.7426L19.1211 8.87868C20.0037 7.99612 20.4449 7.55483 20.4937 7.01325C20.5018 6.92372 20.5018 6.83364 20.4937 6.74411C20.4449 6.20253 20.0037 5.76124 19.1211 4.87868C18.2385 3.99612 17.7972 3.55483 17.2557 3.50605C17.1661 3.49798 17.0761 3.49798 16.9865 3.50605C16.4449 3.55483 16.0037 3.99612 15.1211 4.87868L5.25713 14.7426C4.39004 15.6097 3.9565 16.0433 3.72813 16.5946C3.49977 17.1459 3.49977 17.759 3.49977 18.9853Z" />
      <path d="M13.5 6.5L17.5 10.5" />
    </svg>
  );
}

export function InspectIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt="Inspect"
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/inspect-static.png"
    />
  );
}

export function DevtoolsIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt="DevTools"
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/devtools-static.png"
    />
  );
}

export function ReloadIcon({ className }: ModeIconProps) {
  return (
    <StaticIcon
      alt="Reload"
      className={cn("size-3.5 object-contain icon-ink", className)}
      src="/icons/reload-static.png"
    />
  );
}

export function HookCustomizationIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M5.062 13C3.83229 13.6824 3 14.994 3 16.5C3 18.7091 4.79086 20.5 7 20.5C9.20914 20.5 11 18.7091 11 16.5H17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.5L15.0571 13.0027C15.6323 12.6825 16.2949 12.5 17 12.5C19.2091 12.5 21 14.2909 21 16.5C21 18.7091 19.2091 20.5 17 20.5C16.0541 20.5 15.1848 20.1716 14.5 19.6227"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 8.5C12.5523 8.5 13 8.05228 13 7.5C13 6.94772 12.5523 6.5 12 6.5M12 8.5C11.4477 8.5 11 8.05228 11 7.5C11 6.94772 11.4477 6.5 12 6.5M12 8.5V6.5" />
      <path d="M7 17.5C7.55228 17.5 8 17.0523 8 16.5C8 15.9477 7.55228 15.5 7 15.5M7 17.5C6.44772 17.5 6 17.0523 6 16.5C6 15.9477 6.44772 15.5 7 15.5M7 17.5V15.5" />
      <path d="M17 17.5C17.5523 17.5 18 17.0523 18 16.5C18 15.9477 17.5523 15.5 17 15.5M17 17.5C16.4477 17.5 16 17.0523 16 16.5C16 15.9477 16.4477 15.5 17 15.5M17 17.5V15.5" />
      <path
        d="M16 7.5C16 5.29086 14.2091 3.5 12 3.5C9.79086 3.5 8 5.29086 8 7.5C8 9.004 8.83007 10.3141 10.0571 10.9973L7 16.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RuntimeEngineIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M20 14.5V6.5C20 4.61438 20 3.67157 19.4142 3.08579C18.8284 2.5 17.8856 2.5 16 2.5H8C6.11438 2.5 5.17157 2.5 4.58579 3.08579C4 3.67157 4 4.61438 4 6.5V14.5" />
      <path d="M3.49762 15.5154L4.01953 14.5H19.9518L20.5023 15.5154C21.9452 18.177 22.3046 19.5077 21.7561 20.5039C21.2077 21.5 19.7536 21.5 16.8454 21.5L7.15462 21.5C4.24642 21.5 2.79231 21.5 2.24387 20.5039C1.69543 19.5077 2.05474 18.177 3.49762 15.5154Z" />
      <path d="M15.5 7L16.4199 7.79289C16.8066 8.12623 17 8.29289 17 8.5C17 8.70711 16.8066 8.87377 16.4199 9.20711L15.5 10" />
      <path d="M8.5 7L7.58009 7.79289C7.19337 8.12623 7 8.29289 7 8.5C7 8.70711 7.19336 8.87377 7.58009 9.20711L8.5 10" />
      <path d="M13 6L11 11" />
    </svg>
  );
}

export function NewVersionIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M11.5143 2.09327C11.8265 1.96891 12.1735 1.96891 12.4857 2.09327C13.4921 2.49406 13.6887 4.03744 14.8762 4.12336C15.7124 4.18386 16.533 3.48677 17.3721 3.69574C17.7105 3.78003 18.0028 3.99579 18.186 4.29657C18.7472 5.21824 18.0229 6.57292 18.9383 7.33768C19.5743 7.86877 20.6251 7.80004 21.178 8.4511C21.4108 8.72534 21.5252 9.08303 21.4953 9.4437C21.4068 10.5166 20.0389 11.1876 20.3395 12.3439C20.5475 13.1443 21.4253 13.707 21.4953 14.5563C21.5252 14.917 21.4108 15.2747 21.178 15.5489C20.4832 16.3669 18.9808 16.0975 18.5476 17.2062C18.2434 17.9844 18.634 18.9677 18.186 19.7034C18.0028 20.0042 17.7105 20.22 17.3721 20.3043C16.3302 20.5637 15.2727 19.4445 14.2701 20.0758C13.5543 20.5264 13.2978 21.5835 12.4857 21.9067C12.1735 22.0311 11.8265 22.0311 11.5143 21.9067C10.7022 21.5835 10.4457 20.5264 9.72989 20.0758C8.73971 19.4524 7.65213 20.5593 6.62791 20.3043C6.28947 20.22 5.9972 20.0042 5.81405 19.7034C5.25286 18.7818 5.97704 17.427 5.0617 16.6623C4.42582 16.1312 3.37494 16.2 2.82204 15.5489C2.58921 15.2747 2.47484 14.917 2.50465 14.5563C2.57485 13.707 3.4524 13.1443 3.6605 12.3439C3.95808 11.1997 2.59204 10.5009 2.50465 9.4437C2.47484 9.08303 2.58921 8.72534 2.82204 8.4511C3.51676 7.63284 5.01899 7.90253 5.45238 6.79383C5.75662 6.0156 5.36608 5.03227 5.81405 4.29657C5.9972 3.99579 6.28947 3.78003 6.62791 3.69574C7.46705 3.48677 8.28757 4.18387 9.12378 4.12336C10.3113 4.03746 10.5079 2.49406 11.5143 2.09327Z" />
      <path
        d="M9 13.3333C9 13.3333 9.875 13.3333 10.75 15C10.75 15 13.5294 10.8333 16 10"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ReviewGeneratedIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M19 10.5V10C19 6.22876 19 4.34315 17.8284 3.17157C16.6569 2 14.7712 2 11 2C7.22876 2 5.34315 2 4.17157 3.17157C3 4.34315 3 6.22876 3 10V16C3 17.8638 3 18.7956 3.30448 19.5307C3.71046 20.5108 4.48915 21.2895 5.46927 21.6955C6.20435 22 7.13623 22 9 22"
        strokeLinejoin="round"
      />
      <path d="M7 7H15M7 11H11" />
      <path
        d="M15.2825 19.0044C15.2235 18.1157 15.118 17.1658 14.6817 16.0917C14.3095 15.1756 14.4132 13.0205 16.5 13.0205C18.5868 13.0205 18.6664 15.1756 18.2942 16.0917C17.8578 17.1658 17.7765 18.1157 17.7175 19.0044M21 22H12V20.7543C12 20.3078 12.2664 19.9154 12.6528 19.7928L14.9076 19.077C15.0684 19.0259 15.2348 19 15.4021 19H17.5979C17.7652 19 17.9316 19.0259 18.0924 19.077L20.3472 19.7928C20.7336 19.9154 21 20.3078 21 20.7543V22Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReviewApprovedIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M13 2.5V3C13 5.82843 13 7.24264 13.8787 8.12132C14.7574 9 16.1716 9 19 9H19.5" />
      <path d="M10 21.9913C7.52043 21.9554 6.11466 21.7715 5.17157 20.8284C4 19.6569 4 17.7712 4 14V9.45584C4 6.21082 4 4.58831 4.88607 3.48933C5.06508 3.26731 5.26731 3.06508 5.48933 2.88607C6.58831 2 8.21082 2 11.4558 2C12.1614 2 12.5141 2 12.8372 2.11401C12.9044 2.13772 12.9702 2.165 13.0345 2.19575C13.3436 2.34355 13.593 2.593 14.0919 3.09188L18.8284 7.82843C19.4065 8.40649 19.6955 8.69552 19.8478 9.06306C20 9.4306 20 9.83935 20 10.6569V13" />
      <path d="M14 20C14 20 15 20.5 15.75 22C15.75 22 18.5294 17.8333 21 17" />
    </svg>
  );
}

export function CodeReviewIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M11 18.75C11.4142 18.75 11.75 18.4142 11.75 18C11.75 17.5858 11.4142 17.25 11 17.25V18V18.75ZM9 13.25C8.58579 13.25 8.25 13.5858 8.25 14C8.25 14.4142 8.58579 14.75 9 14.75V14V13.25ZM9 21.25C8.58579 21.25 8.25 21.5858 8.25 22C8.25 22.4142 8.58579 22.75 9 22.75V22V21.25ZM3 17.25C2.58579 17.25 2.25 17.5858 2.25 18C2.25 18.4142 2.58579 18.75 3 18.75V18V17.25ZM5 22.75C5.41421 22.75 5.75 22.4142 5.75 22C5.75 21.5858 5.41421 21.25 5 21.25V22V22.75ZM5 14.75C5.41421 14.75 5.75 14.4142 5.75 14C5.75 13.5858 5.41421 13.25 5 13.25V14V14.75ZM10 15H9.25V17H10H10.75V15H10ZM10 17H9.25C9.25 17.9665 10.0335 18.75 11 18.75V18V17.25C10.8619 17.25 10.75 17.1381 10.75 17H10ZM9 14V14.75C9.13807 14.75 9.25 14.8619 9.25 15H10H10.75C10.75 14.0335 9.9665 13.25 9 13.25V14ZM10 21H10.75V19H10H9.25V21H10ZM10 19H10.75C10.75 18.8619 10.8619 18.75 11 18.75V18V17.25C10.0335 17.25 9.25 18.0335 9.25 19H10ZM9 22V22.75C9.9665 22.75 10.75 21.9665 10.75 21H10H9.25C9.25 21.1381 9.13807 21.25 9 21.25V22ZM4 17H3.25C3.25 17.1381 3.13807 17.25 3 17.25V18V18.75C3.9665 18.75 4.75 17.9665 4.75 17H4ZM4 19H4.75C4.75 18.0335 3.9665 17.25 3 17.25V18V18.75C3.13807 18.75 3.25 18.8619 3.25 19H4ZM4 21H4.75V19H4H3.25V21H4ZM4 15H3.25V17H4H4.75V15H4ZM5 22V21.25C4.86193 21.25 4.75 21.1381 4.75 21H4H3.25C3.25 21.9665 4.0335 22.75 5 22.75V22ZM5 14V13.25C4.0335 13.25 3.25 14.0335 3.25 15H4H4.75C4.75 14.8619 4.86193 14.75 5 14.75V14Z"
        fill="currentColor"
      />
      <path
        d="M14 2.5V3C14 5.82843 14 7.24264 14.8787 8.12132C15.7574 9 17.1716 9 20 9H20.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M14 21.9991C17.1143 21.99 18.7653 21.8915 19.8284 20.8284C21 19.6569 21 17.7712 21 14V10.6569C21 9.83935 21 9.4306 20.8478 9.06306C20.6955 8.69552 20.4065 8.40649 19.8284 7.82843L15.0919 3.09188C14.593 2.593 14.3436 2.34355 14.0345 2.19575C13.9702 2.165 13.9044 2.13772 13.8372 2.11401C13.5141 2 13.1614 2 12.4558 2C9.21082 2 7.58831 2 6.48933 2.88607C6.26731 3.06508 6.06508 3.26731 5.88607 3.48933C5 4.58831 5 6.21082 5 9.45584V10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function TaskUpdatedIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M19 11.9999V7.99994C19 5.17151 19 3.7573 18.1213 2.87862C17.2426 1.99994 15.8284 1.99994 13 1.99994H9C6.17157 1.99994 4.75736 1.99994 3.87868 2.87862C3 3.7573 3 5.17151 3 7.99994V15.9999C3 18.8284 3 20.2426 3.87868 21.1213C4.75736 21.9999 6.17157 21.9999 9 21.9999H11" />
      <path d="M14.5 1.99994H7.5C7.5 3.41415 7.5 4.12126 7.93934 4.5606C8.37868 4.99994 9.08579 4.99994 10.5 4.99994H11.5C12.9142 4.99994 13.6213 4.99994 14.0607 4.5606C14.5 4.12126 14.5 3.41415 14.5 1.99994Z" />
      <path d="M7 14.9999H11M7 10.9999H15" />
      <path d="M15.7367 21.6526L14 21.9999L14.3473 20.2633C14.4179 19.9105 14.5913 19.5866 14.8456 19.3322L18.9111 15.2668C19.2668 14.911 19.8437 14.911 20.1995 15.2668L20.7332 15.8005C21.0889 16.1563 21.0889 16.7331 20.7332 17.0889L16.6677 21.1543C16.4134 21.4087 16.0894 21.5821 15.7367 21.6526Z" />
    </svg>
  );
}

export function TaskCompletedIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M13.498 2H8.49805C7.66962 2 6.99805 2.67157 6.99805 3.5C6.99805 4.32843 7.66962 5 8.49805 5H13.498C14.3265 5 14.998 4.32843 14.998 3.5C14.998 2.67157 14.3265 2 13.498 2Z" />
      <path d="M6.99805 15H10.4266M6.99805 11H14.998" />
      <path d="M18.9981 13.5V9.48263C18.9981 6.65424 18.9981 5.24004 18.1194 4.36137C17.4781 3.72007 16.5515 3.54681 14.9981 3.5M11.998 21.9995L8.99805 21.9995C6.16963 21.9995 4.75541 21.9995 3.87674 21.1208C2.99806 20.2421 2.99805 18.8279 2.99805 15.9995L2.99806 9.48269C2.99805 6.65425 2.99805 5.24004 3.87673 4.36136C4.51802 3.72007 5.44456 3.54681 6.99795 3.5" />
      <path d="M13.998 20C13.998 20 14.998 20 15.998 22C15.998 22 18.1745 17 20.998 16" />
    </svg>
  );
}

export function TaskIssueIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M13.498 2H8.49805C7.66962 2 6.99805 2.67157 6.99805 3.5C6.99805 4.32843 7.66962 5 8.49805 5H13.498C14.3265 5 14.998 4.32843 14.998 3.5C14.998 2.67157 14.3265 2 13.498 2Z" />
      <path d="M6.99805 15H10.4266M6.99805 11H14.998" />
      <path d="M18.998 13.9995L18.9981 9.48263C18.9981 6.65424 18.9981 5.24004 18.1194 4.36137C17.4781 3.72007 16.5515 3.54681 14.9981 3.5M12.998 21.9995L8.99805 21.9995C6.16963 21.9995 4.75541 21.9995 3.87674 21.1208C2.99806 20.2421 2.99805 18.8279 2.99805 15.9995L2.99806 9.48269C2.99805 6.65425 2.99805 5.24004 3.87673 4.36136C4.51802 3.72007 5.44456 3.54681 6.99795 3.5" />
      <path d="M20.998 17L18.498 19.5M18.498 19.5L15.998 22M18.498 19.5L20.998 22M18.498 19.5L15.998 17" />
    </svg>
  );
}

export function ResponseNeededIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M7.5 8.5H16.5M7.5 12.5H13" />
      <path d="M22 10.5C22 9.72921 21.9865 8.97679 21.9609 8.2503C21.8772 5.87683 21.8353 4.69009 20.8699 3.71745C19.9046 2.74481 18.6843 2.6926 16.2438 2.58819C14.9048 2.5309 13.4791 2.5 12 2.5C10.5209 2.5 9.09517 2.5309 7.7562 2.58819C5.3157 2.6926 4.09545 2.74481 3.13007 3.71745C2.16469 4.69009 2.12282 5.87683 2.03909 8.2503C2.01346 8.97679 2 9.72921 2 10.5C2 11.2708 2.01346 12.0232 2.03909 12.7497C2.12282 15.1232 2.16469 16.3099 3.13007 17.2826C4.09545 18.2552 5.31573 18.3074 7.7563 18.4118C8.4902 18.4432 9.25016 18.4667 10.0307 18.4815C10.7718 18.4955 11.1424 18.5026 11.468 18.6266C11.7936 18.7506 12.0675 18.9855 12.6155 19.4553L14.795 21.3242C14.9273 21.4376 15.0958 21.5 15.2701 21.5C15.6732 21.5 16 21.1732 16 20.7701V18.4219C16.0816 18.4186 16.1629 18.4153 16.2438 18.4118C18.6843 18.3074 19.9046 18.2552 20.8699 17.2825C21.8353 16.3099 21.8772 15.1232 21.9609 12.7497C21.9865 12.0232 22 11.2708 22 10.5Z" />
    </svg>
  );
}

export function SecurityAuditClearedIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M18.7088 3.49534C16.8165 2.55382 14.5009 2 12 2C9.4991 2 7.1835 2.55382 5.29116 3.49534C4.36318 3.95706 3.89919 4.18792 3.4496 4.91378C3 5.63965 3 6.34248 3 7.74814V11.2371C3 16.9205 7.54236 20.0804 10.173 21.4338C10.9067 21.8113 11.2735 22 12 22C12.7265 22 13.0933 21.8113 13.8269 21.4338C16.4576 20.0804 21 16.9205 21 11.2371L21 7.74814C21 6.34249 21 5.63966 20.5504 4.91378C20.1008 4.18791 19.6368 3.95706 18.7088 3.49534Z" />
      <path d="M9 11.5C9 11.5 10.4079 11.7519 11 13.5C11 13.5 12.5 10.5 15 9.5" />
    </svg>
  );
}
