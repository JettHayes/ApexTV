import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'mobile-landscape': {
          raw: '(orientation: landscape) and (max-height: 700px)',
        },
      },
      fontFamily: {
        primary: ['Inter', ...defaultTheme.fontFamily.sans],
        // 书名/小节标题用的"书卷"衬线：拉丁走 Georgia，中文依次落到宋体系。
        book: [
          'Georgia',
          '"Songti SC"',
          '"Noto Serif CJK SC"',
          '"Noto Serif SC"',
          'STSong',
          'SimSun',
          ...defaultTheme.fontFamily.serif,
        ],
        // 音乐模块「唱片店」用的三副字。变量由 src/app/music/layout.tsx 里的
        // next/font 注入（和 Inter 同一套机制，构建期自托管，不发运行时外链）。
        // 中文没有窄体/等宽的正经对应，落到系统黑体——数字和拉丁才是这几副字的主场：
        // 名次、时长、音源键名这些"要排成轴"的地方才是它们干活的地方。
        'music-display': [
          'var(--font-music-display)',
          '"Archivo Narrow"',
          ...defaultTheme.fontFamily.sans,
        ],
        'music-body': [
          'var(--font-music-body)',
          'Archivo',
          ...defaultTheme.fontFamily.sans,
        ],
        'music-mono': [
          'var(--font-music-mono)',
          ...defaultTheme.fontFamily.mono,
        ],
      },
      colors: {
        apex: {
          action: 'rgb(var(--apex-action-rgb) / <alpha-value>)',
          'action-ink': 'rgb(var(--apex-action-ink-rgb) / <alpha-value>)',
          accent: 'rgb(var(--apex-accent-rgb) / <alpha-value>)',
          'accent-on-soft':
            'rgb(var(--apex-accent-on-soft-rgb) / <alpha-value>)',
          selected: 'rgb(var(--apex-selected-rgb) / <alpha-value>)',
          line: 'rgb(var(--apex-line-rgb) / <alpha-value>)',
          text: 'rgb(var(--apex-text-rgb) / <alpha-value>)',
          'media-panel': 'rgb(var(--apex-media-panel-rgb) / <alpha-value>)',
          'media-high': 'rgb(var(--apex-media-high-rgb) / <alpha-value>)',
          'media-accent': 'rgb(var(--apex-action-rgb) / <alpha-value>)',
          'media-muted': 'rgb(var(--apex-media-muted-rgb) / <alpha-value>)',
        },
        // 阅读界面复用 ApexTV 语义色，封面覆盖文字单独保留。
        library: {
          action: 'rgb(var(--apex-action-rgb) / <alpha-value>)',
          'action-ink': 'rgb(var(--apex-action-ink-rgb) / <alpha-value>)',
          paper: 'rgb(var(--apex-page-rgb) / <alpha-value>)',
          card: 'rgb(var(--apex-panel-rgb) / <alpha-value>)',
          edge: 'rgb(var(--apex-line-rgb) / <alpha-value>)',
          ink: 'rgb(var(--apex-text-rgb) / <alpha-value>)',
          muted: 'rgb(var(--apex-muted-rgb) / <alpha-value>)',
          // 封面覆盖层上的纯白（角标文字、图标）。永远是纯白，不随明暗模式走——
          // 它压在封面图上，换成墨色反而会糊进画面。必须是自有令牌而非 bg-white /
          // text-white，否则会被管理端主题层的 [class*="bg-white"] !important 染掉。
          chip: 'rgb(var(--apex-media-text-rgb) / <alpha-value>)',
          ochre: 'rgb(var(--apex-accent-rgb) / <alpha-value>)',
          'ochre-hover': 'rgb(var(--apex-action-hover-rgb) / <alpha-value>)',
          'ochre-tint': 'rgb(var(--apex-selected-rgb) / <alpha-value>)',
          night: 'rgb(var(--apex-page-rgb) / <alpha-value>)',
          'night-card': 'rgb(var(--apex-panel-rgb) / <alpha-value>)',
          'night-edge': 'rgb(var(--apex-line-rgb) / <alpha-value>)',
          'night-ink': 'rgb(var(--apex-text-rgb) / <alpha-value>)',
          'night-muted': 'rgb(var(--apex-muted-rgb) / <alpha-value>)',
          'night-ochre': 'rgb(var(--apex-accent-rgb) / <alpha-value>)',
          'night-ochre-tint': 'rgb(var(--apex-selected-rgb) / <alpha-value>)',
        },
        // 音乐与全站共享配色，唱片封套和音轨元素保留独立排版。
        music: {
          paper: 'rgb(var(--apex-page-rgb) / <alpha-value>)',
          card: 'rgb(var(--apex-panel-rgb) / <alpha-value>)',
          'card-2': 'rgb(var(--apex-soft-rgb) / <alpha-value>)',
          edge: 'rgb(var(--apex-line-rgb) / <alpha-value>)',
          ink: 'rgb(var(--apex-text-rgb) / <alpha-value>)',
          'ink-soft': 'rgb(var(--apex-muted-on-soft-rgb) / <alpha-value>)',
          muted: 'rgb(var(--apex-muted-rgb) / <alpha-value>)',
          // 无封面时的卡纸色：比套面深一档，让"这里本该有张图"读得出来。
          art: 'rgb(var(--apex-soft-rgb) / <alpha-value>)',
          // 方向自带的石墨：热搜名次这类非交互的"次序"记号，不跟主题走。
          // 刻意留成一支中性暖灰而不是强调色——排名 4 名往后全刷成橘色会吵。
          graphite: 'rgb(var(--apex-muted-rgb) / <alpha-value>)',
          // 方向自带的强调：套面正中那个大号目录号。它不是控件，不跟主题走，
          // 和 theme 是两回事——换了站内主题，套面不该整体变色。
          accent: 'rgb(var(--apex-accent-rgb) / <alpha-value>)',
          // 主题色（可操作控件）。见上方注释，兜底不可省。
          theme: 'rgb(var(--apex-action-rgb) / <alpha-value>)',
          'action-ink': 'rgb(var(--apex-action-ink-rgb) / <alpha-value>)',
          'theme-hover': 'rgb(var(--apex-action-hover-rgb) / <alpha-value>)',
          // 压在图上的纯白（图标、封面上的字）。永远是纯白，不随明暗走——
          // 它压在封面图上，换成墨色反而糊进画面。必须是自有令牌，否则会被
          // 管理端主题层的 [class*="bg-white"] !important 染掉。
          chip: 'rgb(var(--apex-media-text-rgb) / <alpha-value>)',
          night: 'rgb(var(--apex-page-rgb) / <alpha-value>)',
          'night-card': 'rgb(var(--apex-panel-rgb) / <alpha-value>)',
          'night-card-2': 'rgb(var(--apex-soft-rgb) / <alpha-value>)',
          'night-edge': 'rgb(var(--apex-line-rgb) / <alpha-value>)',
          'night-ink': 'rgb(var(--apex-text-rgb) / <alpha-value>)',
          'night-ink-soft': 'rgb(var(--apex-muted-rgb) / <alpha-value>)',
          'night-muted': 'rgb(var(--apex-muted-rgb) / <alpha-value>)',
          'night-art': 'rgb(var(--apex-soft-rgb) / <alpha-value>)',
          'night-graphite': 'rgb(var(--apex-muted-rgb) / <alpha-value>)',
          'night-accent': 'rgb(var(--apex-accent-rgb) / <alpha-value>)',
          'night-theme': 'rgb(var(--apex-action-rgb) / <alpha-value>)',
          'night-theme-hover':
            'rgb(var(--apex-action-hover-rgb) / <alpha-value>)',
        },
        primary: {
          50: 'rgb(var(--apex-selected-rgb) / <alpha-value>)',
          100: 'rgb(var(--apex-selected-rgb) / <alpha-value>)',
          200: 'rgb(var(--apex-line-rgb) / <alpha-value>)',
          300: 'rgb(var(--apex-action-rgb) / <alpha-value>)',
          400: 'rgb(var(--apex-action-rgb) / <alpha-value>)',
          500: 'rgb(var(--apex-accent-rgb) / <alpha-value>)',
          600: 'rgb(var(--apex-accent-rgb) / <alpha-value>)',
          700: 'rgb(var(--apex-accent-rgb) / <alpha-value>)',
          800: 'rgb(var(--apex-media-panel-rgb) / <alpha-value>)',
          900: 'rgb(var(--apex-media-bg-rgb) / <alpha-value>)',
        },
        dark: 'rgb(var(--apex-media-bg-rgb) / <alpha-value>)',
      },
      keyframes: {
        flicker: {
          '0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100%': {
            opacity: '0.99',
            filter: 'var(--ptv-loading-glow)',
          },
          '20%, 21.999%, 63%, 63.999%, 65%, 69.999%': {
            opacity: '0.4',
            filter: 'none',
          },
        },
        shimmer: {
          '0%': {
            backgroundPosition: '-700px 0',
          },
          '100%': {
            backgroundPosition: '700px 0',
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        flicker: 'flicker 3s linear infinite',
        shimmer: 'shimmer 1.3s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-in-out',
        'slide-down': 'slideDown 0.3s ease-in-out',
        'slide-in-from-right': 'slideInFromRight 0.3s ease-out',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        // 黑胶盘面：细密的同心圆纹路打底（压出来的槽），上面叠几道深浅不一的
        // 弧形，拼出"反光在盘上走"的错觉。两层写进同一个值里——它们是同一条
        // background-image 的两个图层，拆成两个 bg-* 类只会互相顶掉。
        //
        // 盘面是烧焦的深棕而不是纯黑：压在暖色的套面旁边，纯黑会读成"一块洞"。
        // 两档取自乙的 --app-disc-lo / --app-disc-hi。
        'music-vinyl': 'var(--ptv-vinyl-texture)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
} satisfies Config;

export default config;
