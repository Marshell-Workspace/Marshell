import { siteConfig } from "@workspace/core/config/site";
import type { Metadata, Viewport } from "next";
import { Lexend, Plus_Jakarta_Sans, Sacramento } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-content-loaded",
});

const fontDisplay = Lexend({
  subsets: ["latin"],
  variable: "--font-heading-loaded",
});

const fontScript = Sacramento({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-script-loaded",
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/main_logo.png", media: "(prefers-color-scheme: dark)" },
      { url: "/main_logo_light.png", media: "(prefers-color-scheme: light)" },
    ],
    apple: "/main_logo.png",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      className={`dark ${fontSans.variable} ${fontDisplay.variable} ${fontScript.variable}`}
      data-theme="dark"
      lang="en"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning={true}
    >
      <head suppressHydrationWarning={true}>
        <Script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var mode=localStorage.getItem('marshell-theme');var s=null;try{s=JSON.parse(localStorage.getItem('marshell-general-settings')||'{}');}catch(_){}if(!mode&&s&&s.state&&s.state.theme)mode=s.state.theme;if(!mode||mode==='system'||(mode!=='light'&&mode!=='dark')){mode=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',mode);if(mode==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}var acc=localStorage.getItem('marshell-accent');if(!acc&&s&&s.state&&s.state.accent)acc=s.state.accent;if(!acc)acc='mint';document.documentElement.setAttribute('data-accent',acc);if(acc==='custom'){var chex=localStorage.getItem('marshell-custom-accent')||(s&&s.state&&s.state.customAccentHex)||'#38bdf8';var num=parseInt(chex.replace('#',''),16);if(!isNaN(num)){var r=(num>>16)&255,g=(num>>8)&255,b=num&255;document.documentElement.style.setProperty('--accent-fill',chex);document.documentElement.style.setProperty('--accent-ink',chex);document.documentElement.style.setProperty('--accent-rgb',r+', '+g+', '+b);}}var c=localStorage.getItem('marshell-contrast');if(!c&&s&&s.state&&s.state.contrast)c=s.state.contrast;if(c==='low'||c==='high')document.documentElement.setAttribute('data-contrast',c);}catch(_){}})();",
          }}
          id="marshell-theme-prepaint"
          strategy="beforeInteractive"
        />
        <Script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){document.addEventListener('contextmenu',function(e){var t=e.target;if(t&&t.closest&&(t.closest('[data-workspace-item]')||t.closest('[data-slot=\"context-menu-trigger\"]')||t.closest('[data-context-menu-trigger]')||t.closest('[data-radix-menu-content]'))){return;}e.preventDefault();},true);function isTauriResourceError(err){if(!err)return false;var m=typeof err==='string'?err:(err.message||String(err));return m.indexOf('The resource id')!==-1||m.indexOf('ResourceNotFound')!==-1||m.indexOf('Request cancelled')!==-1||(m.indexOf('resource id')!==-1&&m.indexOf('invalid')!==-1);}window.addEventListener('unhandledrejection',function(e){if(isTauriResourceError(e&&e.reason)){e.preventDefault();if(e.stopImmediatePropagation)e.stopImmediatePropagation();if(e.stopPropagation)e.stopPropagation();}},true);function patchInvoke(){try{if(typeof window==='undefined'||!window.__TAURI_INTERNALS__)return;var orig=window.__TAURI_INTERNALS__.invoke;if(!orig||orig.__stalePatched)return;window.__TAURI_INTERNALS__.invoke=function(cmd,args,opts){return orig.apply(this,arguments).catch(function(err){if(isTauriResourceError(err)){if(cmd==='plugin:http|fetch_cancel_body'||cmd==='plugin:http|fetch_cancel'||cmd==='plugin:resources|close'||cmd==='plugin:event|unlisten'){return;}}throw err;});};window.__TAURI_INTERNALS__.invoke.__stalePatched=true;}catch(_){}}if(typeof window!=='undefined'){if(window.__TAURI_INTERNALS__){patchInvoke();}else{var _ti;try{Object.defineProperty(window,'__TAURI_INTERNALS__',{configurable:true,enumerable:true,get:function(){return _ti;},set:function(v){_ti=v;patchInvoke();}});}catch(_){}}}})();",
          }}
          id="marshell-tauri-init"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className="overflow-hidden font-sans antialiased"
        suppressHydrationWarning={true}
      >
        {children}
      </body>
    </html>
  );
}
