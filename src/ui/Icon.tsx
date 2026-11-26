// Свой набор иконок: тонкие линии с круглыми концами, один стиль на всё приложение.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'dumbbell' | 'list' | 'chart' | 'clock' | 'gear' | 'plus' | 'minus' | 'check' | 'close' | 'chevron' | 'back'
  | 'play' | 'pause' | 'timer' | 'info' | 'trash' | 'edit' | 'up' | 'down' | 'share' | 'import' | 'search'
  | 'flame' | 'trophy' | 'scale' | 'video' | 'more' | 'swap' | 'calendar' | 'file' | 'link';

export function Icon({ name, size = 22, color, strokeWidth = 2 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(() => {
        switch (name) {
          case 'dumbbell': return <Path {...p} d="M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12" />;
          case 'list': return <><Rect {...p} x={4} y={3} width={16} height={18} rx={3} /><Path {...p} d="M8 8h8M8 12h8M8 16h5" /></>;
          case 'chart': return <Path {...p} d="M4 20V11M10 20V5M16 20v-6M3 20h18" />;
          case 'clock': return <><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M12 7v5l3 2" /></>;
          case 'gear': return <><Circle {...p} cx={12} cy={12} r={3} /><Path {...p} d="M12 2.5v3M12 18.5v3M4.2 6l2.6 1.5M17.2 16.5l2.6 1.5M4.2 18l2.6-1.5M17.2 7.5 19.8 6" /></>;
          case 'plus': return <Path {...p} d="M12 5v14M5 12h14" />;
          case 'minus': return <Path {...p} d="M5 12h14" />;
          case 'check': return <Path {...p} d="m5 12.5 4.5 4.5L19 7.5" />;
          case 'close': return <Path {...p} d="M6 6l12 12M18 6 6 18" />;
          case 'chevron': return <Path {...p} d="m9 5 7 7-7 7" />;
          case 'back': return <Path {...p} d="m15 5-7 7 7 7" />;
          case 'up': return <Path {...p} d="m6 15 6-6 6 6" />;
          case 'down': return <Path {...p} d="m6 9 6 6 6-6" />;
          case 'play': return <Path {...p} d="M8 5.5v13l10-6.5z" />;
          case 'pause': return <Path {...p} d="M9 5.5v13M15 5.5v13" />;
          case 'timer': return <><Circle {...p} cx={12} cy={13.5} r={7.5} /><Path {...p} d="M12 13.5V9.5M10 2.5h4M18.5 6.5l1.5-1.5" /></>;
          case 'info': return <><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M12 11v6M12 7.5v.01" /></>;
          case 'trash': return <Path {...p} d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />;
          case 'edit': return <Path {...p} d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />;
          case 'share': return <Path {...p} d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5V20h14v-7.5" />;
          case 'import': return <Path {...p} d="M12 3.5V15M7.5 10.5 12 15l4.5-4.5M5 12.5V20h14v-7.5" />;
          case 'search': return <><Circle {...p} cx={11} cy={11} r={6.5} /><Path {...p} d="m16 16 4.5 4.5" /></>;
          case 'flame': return <Path {...p} d="M12 21c4 0 6.5-2.6 6.5-6.2 0-4.3-4-6.3-4.5-10.3-2.6 1.6-4 4.3-3.7 7.3-1.3-.6-2-1.8-2.2-3.1C6.6 10.3 5.5 12.3 5.5 14.8 5.5 18.4 8 21 12 21z" />;
          case 'trophy': return <Path {...p} d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20h7M10 17h4" />;
          case 'scale': return <><Rect {...p} x={3.5} y={4} width={17} height={16} rx={4} /><Path {...p} d="M9 9.5a4 4 0 0 1 6 0M12 9.5l1.2-1.6" /></>;
          case 'video': return <><Rect {...p} x={3} y={6} width={13} height={12} rx={2.5} /><Path {...p} d="m16 10.5 5-3v9l-5-3" /></>;
          case 'more': return <Path {...p} strokeWidth={3} d="M5.5 12h.01M12 12h.01M18.5 12h.01" />;
          case 'swap': return <Path {...p} d="M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20M20.5 16.5h-13" />;
          case 'calendar': return <><Rect {...p} x={3.5} y={5} width={17} height={15.5} rx={3} /><Path {...p} d="M3.5 10h17M8 3v4M16 3v4" /></>;
          case 'file': return <Path {...p} d="M6 3h8l4.5 4.5V21H6zM14 3v4.5h4.5" />;
          case 'link': return <Path {...p} d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />;
        }
      })()}
    </Svg>
  );
}
